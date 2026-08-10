import { NextRequest, NextResponse, after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fireSequenceCommentRelay } from '@/lib/relay'
import { publicName } from '@/lib/public-name'

// Server-side comment insert.
//
// WHY THIS ROUTE EXISTS AT ALL. Until 2026-08-09 every comment on the site
// was written by the browser, straight to Supabase under RLS, from three call
// sites in SequencePageClient.tsx: submitComment, submitReply, and the
// optional note attached to a rating in confirmRating. That works, and it is
// still what RLS enforces. What it cannot do is relay the comment to Discord:
// there was no server-side moment to hang an outbound call off, and asking
// the browser to make that call after inserting would mean a browser that
// skips it relays nothing with nobody the wiser.
//
// So the insert moves here and the browser calls this instead.
//
// THE SECURITY MODEL IS UNCHANGED, WHICH IS THE POINT. The insert below uses
// the SESSION client, not the admin client, so exactly the same RLS policy
// decides it as decided the browser's insert:
//
//   auth.uid() = author_id
//   and public.is_verified_poster(author_id)
//   and public.has_completed_onboarding(author_id)
//
// (migration 009). This route therefore cannot post as somebody else, cannot
// bypass the posting gate, and cannot comment on behalf of an account that
// has not finished onboarding, because it never holds the service role while
// doing the write. The admin client IS used, further down, but only to read
// the sequence's slug and Discord thread id for the relay payload.
//
// The client keeps calling checkGate before it calls this route. That is a UX
// affordance -- it opens the username modal instead of showing an error --
// and it was never the security boundary. Removing it would still be safe and
// would just make the failure uglier.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const raw = (await req.json()) as Record<string, unknown>

    const sequenceId = raw.sequenceId
    if (typeof sequenceId !== 'string' || !sequenceId) {
      return NextResponse.json({ ok: false, error: 'Invalid sequenceId' }, { status: 400 })
    }

    // NOT length-capped, deliberately. comments.body has no constraint in the
    // schema and the browser insert this replaces had none either, so adding
    // one here would be a new restriction smuggled in under a plumbing
    // change. Discord's 2000-character limit is handled by truncating on the
    // way out, in the bot, per design doc section 7.4 -- the comment on the
    // site keeps its full text.
    const rawBody = raw.body
    if (typeof rawBody !== 'string' || !rawBody.trim()) {
      return NextResponse.json({ ok: false, error: 'Comment body is required' }, { status: 400 })
    }
    const body = rawBody.trim()

    const parentIdRaw = raw.parentId
    const parentId = typeof parentIdRaw === 'string' && parentIdRaw ? parentIdRaw : null

    // The same select the browser used, so the row this returns is
    // shape-identical to what the three call sites already put into their
    // optimistic state. Nothing on the client had to learn a new type.
    const { data: comment, error: insertError } = await supabase
      .from('comments')
      .insert({
        sequence_id: sequenceId,
        author_id: user.id,
        body,
        ...(parentId ? { parent_id: parentId } : {}),
      })
      .select('*, author:profiles(*)')
      .single()

    if (insertError || !comment) {
      console.error('[comments] Insert failed:', insertError)
      // 403 rather than 500 when RLS refused it: that is a policy decision
      // about this user, not a fault, and the client can tell the difference.
      const denied = insertError?.code === '42501'
      return NextResponse.json(
        { ok: false, error: denied ? 'Not allowed to comment' : 'Could not post comment' },
        { status: denied ? 403 : 500 },
      )
    }

    // Everything below is for Discord and NONE of it may affect the response.
    // A comment that is in the database has succeeded, whatever the bridge
    // does next.
    const admin = createAdminClient()

    const { data: sequenceRow, error: sequenceLookupError } = await admin
      .from('sequences')
      // author_id joins the select for the opt-out read below. The flag is the
      // SEQUENCE OWNER's, not the commenter's: one setting on the profile
      // covering every sequence that author owns, per design section 21.3.
      .select('slug, discord_thread_id, author_id')
      .eq('id', sequenceId)
      .single()

    if (sequenceLookupError) {
      console.error('[comments] Failed to look up sequence for relay:', sequenceLookupError)
    }

    const slug = sequenceRow?.slug ?? ''

    // Drop the cached sequence page so the raw HTML carries this comment.
    //
    // WHAT THIS BUYS, stated precisely because the obvious story is wrong. The
    // page is NOT visibly broken without it: SequencePageClient's mount effect
    // reconciles comments straight from Supabase on every seeded load, so the
    // author and every other visitor see the new comment a moment after
    // hydration even on a cache HIT. What stays stale without this call is the
    // raw HTML served to crawlers and to any no-JS client -- measured at an
    // x-vercel-cache HIT with age 841s carrying none of the page's three
    // comments -- and the brief pre-reconcile flash of the old list.
    //
    // Inside try/catch because of the invariant stated above: everything from
    // here down is best-effort and none of it may affect the response. A
    // comment that is in the database has succeeded.
    if (slug) {
      try {
        revalidatePath(`/sequences/${slug}`)
      } catch (err) {
        console.error('[comments] revalidatePath failed:', err)
      }
    }

    // The sequence author's bridge opt-out, read explicitly rather than through
    // a PostgREST embed on the sequences select above -- same reasoning as the
    // battletag read further down, where leaning on a wildcard/nested select to
    // carry a field a behaviour depends on is the coupling that breaks silently
    // when somebody narrows the select later.
    //
    // A FAILED LOOKUP MEANS NOT OPTED OUT. This is a preference, not a security
    // gate: refusing to relay because a read failed would silently drop real
    // comments on a transient database error, which is a worse failure than
    // relaying one comment the author would rather not have relayed.
    let authorOptedOut = false
    if (sequenceRow?.author_id) {
      const { data: ownerProfile, error: optOutError } = await admin
        .from('profiles')
        .select('discord_bridge_opted_out')
        .eq('id', sequenceRow.author_id)
        .single()

      if (optOutError) {
        console.error('[comments] Failed to read sequence author bridge opt-out:', optOutError)
      } else {
        authorOptedOut = ownerProfile?.discord_bridge_opted_out === true
      }
    }

    if (slug && authorOptedOut) {
      // The reason token matches the `reason` field the three inbound relay
      // routes return, so one grep for author_opted_out finds all four bridge
      // paths in the source and all four in production logs. This path is the
      // only one of the four with no status to carry it: nothing is refused
      // here, the comment is written and the response is the usual 200.
      console.log(
        `[comments] Outbound relay skipped for comment ${comment.id} on ${slug}, reason=author_opted_out: sequence author has opted out of the Discord bridge`,
      )
    }

    if (slug && !authorOptedOut) {
      // battletag is not read off the row the insert returned. profiles(*)
      // does include it, but leaning on a wildcard select to carry a field
      // the privacy rules depend on is exactly the coupling that breaks
      // silently when somebody narrows the select later. Read it explicitly.
      const { data: authorProfile } = await admin
        .from('profiles')
        .select('display_name, username, battletag, avatar_url')
        .eq('id', user.id)
        .single()

      const displayName = publicName({
        displayName: authorProfile?.display_name,
        username: authorProfile?.username,
        battletag: authorProfile?.battletag,
        email: user.email,
      })

      // after(), not a floating promise. Same lesson notify-discord learned
      // the hard way on 2026-08-08: a bare call whose promise nobody holds
      // can be frozen or torn down by the platform the moment the response
      // returns, and because the relay awaits work before its outbound fetch,
      // the request never leaves the process AND nothing reaches
      // relay_failures either, since that insert sits downstream of the fetch
      // that never happened. after() hands the promise to waitUntil and does
      // not delay this response.
      after(() =>
        fireSequenceCommentRelay({
          commentId: comment.id,
          body,
          parentId,
          slug,
          threadId: sequenceRow?.discord_thread_id ?? null,
          displayName,
          avatarUrl: authorProfile?.avatar_url ?? null,
        }).catch((err) => {
          // fireCommentRelay handles and logs its own failures; this catch
          // only guards against a truly unexpected throw so it can never
          // affect the response.
          console.error('[comments] Unexpected error firing comment relay:', err)
        }),
      )
    }

    return NextResponse.json({ ok: true, comment })
  } catch (err) {
    console.error('[comments] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
