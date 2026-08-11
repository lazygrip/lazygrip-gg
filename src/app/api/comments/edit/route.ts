import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Server-side comment edit (web-originated only).
//
// THIS ROUTE FOLLOWS api/comments/delete/route.ts's SHAPE EXACTLY, ON
// PURPOSE. Same reasoning applies here as there: a browser write straight to
// Supabase would be authorized identically (migration 002's "Authors can
// update their own comments" UPDATE policy, using auth.uid() = author_id on
// both USING and WITH CHECK, already permits editing body -- confirmed
// directly against pg_policy on 2026-08-11, not assumed), but a browser
// write has no server moment to hang revalidatePath off, so an edit would
// sit invisible in cached HTML the same way an undeleted comment used to.
// This route is that missing server moment and nothing more. It does not
// reinvent authorization: the session client makes this write, so RLS
// decides it exactly as it would decide a browser write, and a zero-row
// result means RLS refused it, not that something broke.
//
// SOURCE GUARD: only source = 'web' comments may be edited here. A comment
// relayed in from Discord (source = 'discord') is edited by
// api/relay/discord-comment-edit/route.ts instead, which is the inbound half
// of this same feature and enforces the mirror-image restriction (source =
// 'discord' only, migration 012). Without this guard a site-side edit could
// silently rewrite a comment whose canonical copy lives on Discord, leaving
// the two permanently out of sync with no trace of why.
//
// NO OUTBOUND DISCORD RELAY FIRES FROM HERE YET. Symmetry with the inbound
// edit path (Discord edit -> site comment updates) would mean this route
// also pushes an edited 'web' comment's new body out to Discord. That is a
// cross-system contract change gripbot's side needs to be ready for --
// rate limits, handling a Discord message that was itself since deleted,
// embed edit permissions -- and is deliberately left as a follow-up rather
// than guessed at here. See the isolated stub below: wiring it on later is
// meant to be a one-line change at the marked call site, not a rewrite of
// this route.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const raw = (await req.json()) as Record<string, unknown>

    const commentId = raw.commentId
    if (typeof commentId !== 'string' || !commentId) {
      return NextResponse.json({ ok: false, error: 'Invalid commentId' }, { status: 400 })
    }

    // Same non-length-cap reasoning as api/comments/route.ts: comments.body
    // has no constraint in the schema, and a cap smuggled in here under an
    // edit-plumbing change would be a new restriction the insert path never
    // had either.
    const rawBody = raw.body
    if (typeof rawBody !== 'string' || !rawBody.trim()) {
      return NextResponse.json({ ok: false, error: 'Comment body is required' }, { status: 400 })
    }
    const body = rawBody.trim()

    // Read-before-write to apply the source guard. This costs a round trip
    // the delete route doesn't pay, but delete has no equivalent guard to
    // check -- is_deleted doesn't care where the comment originated, body
    // content does, since only one side of the bridge may be the source of
    // truth for it at a time.
    const { data: existing, error: lookupError } = await supabase
      .from('comments')
      .select('id, source, sequence_id')
      .eq('id', commentId)
      .maybeSingle()

    if (lookupError) {
      console.error('[comments/edit] Lookup failed:', lookupError)
      return NextResponse.json({ ok: false, error: 'Could not edit comment' }, { status: 500 })
    }

    // Zero rows here means either no such comment, or RLS's SELECT policy
    // hid it (migration 004: visible if not deleted, or if you're the
    // author). Same non-distinguishing reasoning as the delete route: telling
    // "not yours" apart from "no such row" would leak which comment ids
    // exist, so both get the same answer.
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not allowed to edit that comment' }, { status: 403 })
    }

    if (existing.source !== 'web') {
      console.error(
        `[comments/edit] Refused to edit non-web comment ${existing.id}, source=${existing.source}`,
      )
      return NextResponse.json(
        { ok: false, error: 'This comment originated on Discord and can only be edited there' },
        { status: 409 },
      )
    }

    // The actual write. auth.uid() = author_id on both USING and WITH CHECK
    // means this can only ever match and update the caller's own row -- a
    // zero-row result below is that policy refusing it, exactly as it would
    // refuse the read above for someone else's comment if is_deleted were
    // true, and exactly as the delete route's UPDATE is refused.
    const { data: updated, error: updateError } = await supabase
      .from('comments')
      .update({ body })
      .eq('id', commentId)
      .select('id, sequence_id, body, updated_at')
      .maybeSingle()

    if (updateError) {
      console.error('[comments/edit] Update failed:', updateError)
      return NextResponse.json({ ok: false, error: 'Could not edit comment' }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Not allowed to edit that comment' }, { status: 403 })
    }

    // Same slug lookup and best-effort revalidate as delete/route.ts, same
    // reasoning: the session client's own sequences SELECT policy already
    // decides what's safe to read here, and a failure here must not be
    // reported as an edit that didn't happen, since the write is already
    // committed by this point.
    const { data: sequenceRow, error: sequenceError } = await supabase
      .from('sequences')
      .select('slug')
      .eq('id', updated.sequence_id)
      .single()

    if (sequenceError) {
      console.error('[comments/edit] Failed to look up sequence for revalidate:', sequenceError)
    }

    const slug = sequenceRow?.slug ?? ''
    if (slug) {
      try {
        revalidatePath(`/sequences/${slug}`)
      } catch (err) {
        console.error('[comments/edit] revalidatePath failed:', err)
      }
    }

    // OUTBOUND RELAY STUB. Intentionally not called yet -- see the file
    // header. Wiring it on once gripbot's ready should mean uncommenting a
    // call to this function at this line, not touching anything above it.
    //
    // await fireCommentEditRelay({ commentId: updated.id, body: updated.body })

    return NextResponse.json({ ok: true, comment: updated })
  } catch (err) {
    console.error('[comments/edit] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
