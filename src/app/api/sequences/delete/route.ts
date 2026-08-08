import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fireSequenceDeletedRelay } from '@/lib/relay'

// Sequence deletion used to happen entirely client-side (a direct
// supabase.from('sequences').delete() call from SequencePageClient.tsx),
// which meant there was no server-side moment to compute how many
// published sequences the author has left, and no server-side moment to
// tell Sataana's gripbot a deletion happened at all.
//
// Sataana needs sequences_remaining specifically to know whether to revoke
// Forgemaster (only on an explicit 0, never guessed, never defaulted). That
// count has to be taken BEFORE the delete for the authorization/proceed
// decision below, or it's wrong -- counting after the row is already gone
// just tells you how many were left excluding the one that's now missing
// anyway, which happens to be the same number only by coincidence of query
// timing, not by design. Getting this backwards quietly would produce
// exactly the kind of bug Sataana flagged: someone with five sequences
// losing their role over one deletion.
//
// 2026-08-08: what actually goes out over the relay is now computed
// separately by relay.ts at send time (see getSequencesRemaining below),
// not taken from this initial count. A live run showed the initial count
// go stale in the gap between the delete happening and the relay actually
// being delivered -- see relay.ts for the full explanation. The count
// below is still required and still guards the delete itself; it's just no
// longer assumed to still be accurate by the time the network call fires.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function countRemainingPublished(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  excludeSequenceId: string,
): Promise<number | null> {
  const { count, error } = await admin
    .from('sequences')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId)
    .eq('status', 'published')
    .neq('id', excludeSequenceId)

  if (error) {
    console.error('[delete-sequence] Failed to count remaining sequences:', error)
    return null
  }

  // count is number | null from Supabase's typing. A null here with no
  // error is still an unknown count, not a zero -- treat it the same as an
  // error rather than letting a caller default it to 0. See the 8-sequence
  // account this almost mis-fired for on 2026-08-08.
  return count
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let raw: Record<string, unknown>
  try {
    raw = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const sequenceId = raw.sequence_id
  if (typeof sequenceId !== 'string' || !UUID_RE.test(sequenceId)) {
    return NextResponse.json({ ok: false, error: 'Invalid sequence_id' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up the sequence first: confirms it exists, gets slug/title for the
  // relay payload, and -- critically -- confirms author_id server-side
  // rather than trusting a client-supplied value, since this is the actual
  // authorization check (matching the .eq('author_id', user.id) the old
  // client-side delete relied on, now enforced here instead).
  const { data: sequence, error: fetchError } = await admin
    .from('sequences')
    .select('id, slug, title, author_id, status')
    .eq('id', sequenceId)
    .single()

  if (fetchError || !sequence) {
    return NextResponse.json({ ok: false, error: 'Sequence not found' }, { status: 404 })
  }

  if (sequence.author_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Initial count, taken before the delete, purely to decide whether we can
  // proceed and report on this delete at all. Do not proceed with a delete
  // we can't accurately report on -- Sataana's contract treats
  // sequences_remaining as required and load-bearing for a role revocation
  // decision, and sending a wrong or missing count is worse than failing
  // this request and asking the user to retry.
  const initialRemaining = await countRemainingPublished(admin, user.id, sequenceId)
  if (initialRemaining === null) {
    return NextResponse.json({ ok: false, error: 'Could not verify remaining sequence count' }, { status: 500 })
  }

  const { error: deleteError } = await admin
    .from('sequences')
    .delete()
    .eq('id', sequenceId)
    .eq('author_id', user.id)

  if (deleteError) {
    console.error('[delete-sequence] Delete failed:', deleteError)
    return NextResponse.json({ ok: false, error: 'Delete failed' }, { status: 500 })
  }

  // Only relay for sequences that were actually published -- a draft never
  // had a Discord thread or a Forgemaster grant tied to it, so there is
  // nothing on Sataana's side to react to.
  if (sequence.status === 'published') {
    // Scheduled with after() rather than left as a floating promise. The full
    // reasoning is in the matching comment in notify-discord's route; the
    // short version is that work still pending when the response is returned
    // can be discarded along with the serverless invocation, and this wrapper
    // awaits TWO Supabase round trips before its outbound fetch ever goes
    // out (the initial count here, then the send-time recompute inside
    // relay.ts). after() keeps the invocation alive until the promise settles
    // without blocking or delaying this response.
    after(() =>
      fireSequenceDeletedRelay({
        slug: sequence.slug,
        title: sequence.title,
        userId: user.id,
        // Re-queried fresh by relay.ts immediately before every send attempt,
        // including retries, rather than relying on initialRemaining staying
        // accurate until delivery. This is deliberately a NEW query each
        // call, not a closure returning initialRemaining -- the whole point
        // is that this can differ from initialRemaining if time has passed
        // and the author published or deleted something else in the gap.
        getSequencesRemaining: () => countRemainingPublished(admin, user.id, sequenceId),
      }).catch((err) => {
        console.error('[delete-sequence] Unexpected error firing delete relay:', err)
      }),
    )
  }

  return NextResponse.json({ ok: true })
}
