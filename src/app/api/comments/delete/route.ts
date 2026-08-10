import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Server-side comment soft delete.
//
// WHY THIS ROUTE EXISTS AT ALL, AND IT IS NOT A SECURITY CHANGE. Until now
// SequencePageClient's deleteComment wrote straight to Supabase from the
// browser, under RLS, exactly as the three comment INSERT call sites did
// before api/comments/route.ts took them over. That works and RLS still
// enforces it. What a browser write cannot do is invalidate the cached page:
// there is no server moment to hang revalidatePath off, so the raw HTML kept
// serving a comment its author had already removed for up to an hour, to
// crawlers and to any no-JS client. This route is that missing server moment
// and nothing more.
//
// It is the fifth and last comment write path. The other four -- the web
// insert, and the three inbound relay routes -- were already server-side and
// gained their revalidate in the same change. Fixing four of five would have
// left the class four fifths closed while reading as closed.
//
// THE AUTHORIZATION IS NOT REINVENTED HERE, WHICH IS THE ENTIRE POINT. The
// update below uses the SESSION client, so migration 002's comments UPDATE
// policy decides this write precisely as it decided the browser's:
//
//   using (auth.uid() = author_id)
//
// The admin client is deliberately NOT used. An admin-client delete would be a
// brand new authorization surface -- this route would then have to re-derive
// ownership by hand and own that check forever -- in a change whose whole
// purpose is that there is no new authorization at all. A zero-row result below
// is RLS refusing the write, and that is the check.
//
// NO OUTBOUND DISCORD RELAY FIRES FROM HERE. A comment deleted on the site has
// never been relayed to Discord in either direction, and adding it under a
// caching fix would be a new bridge feature smuggled in. The opt-out flag from
// migration 017 is therefore irrelevant to this route: it gates the bridge, and
// there is no bridge on this path.

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

    // Soft delete, matching what the client did: the row stays so replies keep
    // their parent, and migration 004 keeps is_deleted rows away from anon.
    //
    // sequence_id is selected because it is the only way to reach the slug for
    // the revalidate below, and the row is about to stop being readable to a
    // second query anyway.
    const { data: updated, error: updateError } = await supabase
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', commentId)
      .select('sequence_id')
      .maybeSingle()

    if (updateError) {
      console.error('[comments/delete] Update failed:', updateError)
      return NextResponse.json({ ok: false, error: 'Could not delete comment' }, { status: 500 })
    }

    // ZERO ROWS MEANS RLS REFUSED IT, NOT THAT SOMETHING BROKE. An UPDATE whose
    // USING clause excludes the row matches nothing and reports no error, so
    // this is what "you do not own that comment" looks like from here. 403
    // rather than 500 for the same reason api/comments/route.ts answers 403 on
    // 42501: it is a policy decision about this user, and the client can tell
    // the difference. A comment id that does not exist lands here too, and
    // giving those two the same answer is correct rather than sloppy -- telling
    // a caller apart "not yours" from "no such row" would leak which comment
    // ids exist.
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Not allowed to delete that comment' }, { status: 403 })
    }

    // Same session client, no elevation. AN EARLIER VERSION OF THIS COMMENT
    // SAID THE sequences SELECT POLICY IS PUBLIC. IT IS NOT, and a file whose
    // whole argument is that it adds no authorization surface does not get to
    // be wrong about the policies it leans on. Migration 002 gives the table
    // two permissive SELECT policies, which OR together:
    //
    //   002:186   using (status = 'published'::sequence_status)
    //   002:190   using (auth.uid() = author_id)
    //
    // The real policy is the STRONGER justification for reading this here, not
    // a weakened one. The only reason this route reads the slug at all is to
    // invalidate a cached PUBLIC page. A sequence satisfying neither policy is
    // not published AND is not owned by this caller, so it has no public page
    // to invalidate. The one case the policy hides is therefore exactly the
    // case with nothing to do, and the zero-row path below -- log it, leave
    // slug empty, skip the revalidate -- is the correct outcome rather than a
    // silent failure.
    const { data: sequenceRow, error: sequenceError } = await supabase
      .from('sequences')
      .select('slug')
      .eq('id', updated.sequence_id)
      .single()

    if (sequenceError) {
      console.error('[comments/delete] Failed to look up sequence for revalidate:', sequenceError)
    }

    // try/catch and log only. The delete is committed; a cache-invalidation
    // failure must not be reported to the client as a delete that did not
    // happen, because the client's optimistic update has already removed it
    // from view and a false failure would be the confusing outcome.
    const slug = sequenceRow?.slug ?? ''
    if (slug) {
      try {
        revalidatePath(`/sequences/${slug}`)
      } catch (err) {
        console.error('[comments/delete] revalidatePath failed:', err)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[comments/delete] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
