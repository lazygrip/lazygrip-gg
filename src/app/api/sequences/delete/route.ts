import { NextRequest, NextResponse } from 'next/server'
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
// count has to be taken BEFORE the delete, or it's wrong -- counting after
// the row is already gone just tells you how many were left excluding the
// one that's now missing anyway, which happens to be the same number only
// by coincidence of query timing, not by design. Getting this backwards
// quietly would produce exactly the kind of bug Sataana flagged: someone
// with five sequences losing their role over one deletion.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  // Count this author's OTHER published sequences before deleting this one.
  // This is the number after the delete completes, which is why it excludes
  // the row about to be removed rather than counting all published rows and
  // subtracting one -- excluding it here is equivalent and avoids an
  // off-by-one if this route is ever changed to soft-delete instead.
  const { count: remainingCount, error: countError } = await admin
    .from('sequences')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .eq('status', 'published')
    .neq('id', sequenceId)

  if (countError) {
    // Do not proceed with a delete we can't accurately report on. Sataana's
    // contract treats sequences_remaining as required and load-bearing for
    // a role revocation decision -- sending a wrong or missing count is
    // worse than failing this request and asking the user to retry.
    console.error('[delete-sequence] Failed to count remaining sequences:', countError)
    return NextResponse.json({ ok: false, error: 'Could not verify remaining sequence count' }, { status: 500 })
  }

  // remainingCount is number | null from Supabase's count() typing. A null
  // here with no countError is still an unknown count, not a zero -- `?? 0`
  // would silently turn "count unavailable" into "count is zero", which is
  // the exact shape of bug this whole guard exists to prevent (see the
  // 8-sequence account this almost mis-fired for on 2026-08-08). Treat a
  // null count the same as a countError: refuse the delete rather than
  // guess, per Sataana's "never default to zero" contract.
  if (remainingCount === null) {
    console.error('[delete-sequence] remainingCount was null with no countError -- refusing to guess')
    return NextResponse.json({ ok: false, error: 'Could not verify remaining sequence count' }, { status: 500 })
  }

  const sequencesRemaining = remainingCount

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
    fireSequenceDeletedRelay({
      slug: sequence.slug,
      title: sequence.title,
      userId: user.id,
      sequencesRemaining,
    }).catch((err) => {
      console.error('[delete-sequence] Unexpected error firing delete relay:', err)
    })
  }

  return NextResponse.json({ ok: true })
}
