import { NextRequest, NextResponse, after } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { fireSequencePublishedRelay } from '@/lib/relay'
import { isUnsafePublicUsername, publicName } from '@/lib/public-name'
import {
  buildImportMessage,
  buildSequenceEmbed,
  cleanText,
  postImportMessage,
  resolveAppliedTags,
  SLUG_RE,
  SNOWFLAKE_RE,
  THREAD_NAME_MAX,
} from '@/lib/discord-embed'
import { decodeExport } from '@/lib/workshop'

// Operator-only route that gives one published sequence a Discord forum
// thread, posted as if its REAL AUTHOR had published it. Design doc section
// 14.4 and 14.6. Added 2026-08-09.
//
// WHY IT EXISTS. The bridge currently reaches 14 percent of the conversation
// happening on lazygrip.net: 58 published sequences, 18 with a Discord thread,
// 40 without, and 76 of the site's 88 comments sitting on the 40 that were
// never bridged. Those 40 sequences were published before the bridge existed,
// so nothing will ever create their threads on its own.
//
// WHY NOT JUST CALL notify-discord 40 TIMES. Because that route authenticates
// with supabase.auth.getUser() and builds the embed footer, and the relay's
// author, from user.id -- THE CALLER. Driven by an operator it would attribute
// all 40 threads to whoever ran the backfill instead of to Slowdog, Kohtas,
// MFDOOM and Anubikk, and it would send Sataana's bot 40 role-grant events
// naming the wrong person. This route exists precisely to break that coupling:
// the identity it posts under comes off the sequence row, and the caller's
// identity is never used for anything except deciding whether the call is
// allowed at all.
//
// ONE SEQUENCE PER CALL. No array, no loop, no batch. Two reasons, both
// practical. A partial failure part-way through 37 sequences is unreadable in
// a single response -- you cannot tell which ones got threads, which ones got
// threads but no database link, and which ones were never reached. And pacing
// belongs to the caller, because only the caller can see what Discord's rate
// limiter is doing to it; a server-side loop would guess.
//
// The runtime is pinned to nodejs because the secret comparison below uses
// node:crypto. It is the default for route handlers, but this route breaks
// rather than degrades if that ever changes, so it says so out loud.
export const runtime = 'nodejs'

// Timing-safe comparison, not ===. A shared secret in a header is compared on
// every call, and === bails at the first differing byte, which leaks the
// length of the matching prefix to anyone willing to measure. timingSafeEqual
// takes constant time for equal-length inputs.
//
// It THROWS on inputs of different length, so the length check has to come
// first, and that check is inherently not constant time. That is fine and
// unavoidable: the only thing it leaks is the length of the configured secret,
// which is not the secret.
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  // GUARD ORDER BELOW IS THE SECURITY PROPERTY, NOT A STYLE CHOICE:
  //
  //   1. secret configured
  //   2. secret matches
  //   3. webhook configured
  //   4. read body
  //   5. validate body
  //   6. act
  //
  // The body is never parsed until the caller has proven it holds the secret.
  // An unauthenticated request must reach as little of this route as possible,
  // and JSON parsing of an attacker-supplied payload is real work done on an
  // attacker's behalf.

  // 1. A route whose secret is unset must not fall open. It answers 503 and
  // does nothing, the same shape relay.ts uses when DISCORD_RELAY_SECRET is
  // missing: refuse to act rather than act unguarded. A misconfigured deploy
  // that quietly accepted every caller would be strictly worse than this route
  // not existing at all, because it would look like it was working.
  const expectedSecret = process.env.LAZYGRIP_ADMIN_TASK_SECRET
  if (!expectedSecret) {
    console.error('[admin/sequence-thread] LAZYGRIP_ADMIN_TASK_SECRET not configured, refusing all calls')
    return NextResponse.json({ ok: false, error: 'Route not configured' }, { status: 503 })
  }

  // 2. No Supabase session is involved anywhere in this route. There is no
  // human logged in when a backfill runs, and inventing one would mean an
  // operator account whose identity would then be tempting to use for
  // attribution -- the exact bug this route exists to avoid.
  const providedSecret = req.headers.get('X-Admin-Task-Secret')
  if (!providedSecret || !secretMatches(providedSecret, expectedSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // 3. Checked here, before the body is read, to keep the guard order above
  // fixed. A repoint (see below) never posts to Discord and so does not
  // strictly need the webhook, but the mode is not known until the body is
  // parsed, and reordering these two to save a repoint from a 503 would mean
  // parsing an unauthenticated-in-shape body to decide a configuration
  // question. Anyone running this route has the webhook configured anyway.
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('[admin/sequence-thread] DISCORD_WEBHOOK_URL not configured')
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 503 })
  }

  try {
    // 4. A body that is not JSON at all lands as null and falls straight into
    // the slug check below, which answers 400. That is the honest answer: a
    // request with no parseable body has no valid slug in it.
    const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null

    // 5. Same SLUG_RE and SNOWFLAKE_RE notify-discord validates against, now
    // imported from src/lib/discord-embed.ts by both routes rather than
    // declared twice.
    const slugRaw = raw?.slug
    if (typeof slugRaw !== 'string' || !SLUG_RE.test(slugRaw)) {
      return NextResponse.json({ ok: false, error: 'Invalid slug' }, { status: 400 })
    }
    const slug = slugRaw

    const threadIdRaw = raw?.threadId
    const threadIdProvided = threadIdRaw !== undefined && threadIdRaw !== null
    if (threadIdProvided && (typeof threadIdRaw !== 'string' || !SNOWFLAKE_RE.test(threadIdRaw))) {
      return NextResponse.json({ ok: false, error: 'Invalid threadId' }, { status: 400 })
    }
    const repointThreadId = threadIdProvided ? (threadIdRaw as string) : null

    const admin = createAdminClient()

    // One read serves both modes: it proves the sequence exists, it carries
    // the thread id both modes have to refuse over, and in create mode it
    // carries everything the embed, the tags, the import message and the relay
    // need.
    //
    // wow_build IS IN THIS LIST AS OF MIGRATION 019. It was deliberately absent
    // until then: the column did not exist, and PostgREST rejects the WHOLE
    // query on a single unknown column with a 42703, so naming it early would
    // not have degraded this route, it would have broken every call to it
    // including the repoint mode that reads no build context at all. 019 adds
    // the column to public.sequences and public.sequence_versions, teaches
    // every write path to carry it, and backfills the 28 published rows whose
    // exports carry a build.
    //
    // The column is the FALLBACK here, not the source; see the precedence note
    // further down. It only answers for a row whose export has no envelope.
    const { data: sequence, error: lookupError } = await admin
      .from('sequences')
      .select(
        'id, slug, title, author_id, class_name, spec_name, hero_talent, content_type, status, discord_thread_id, spec_id, talent_string, grip_string, grip_version, patch_version, wow_build, created_at, updated_at',
      )
      .eq('slug', slug)
      .single()

    if (lookupError || !sequence) {
      console.error('[admin/sequence-thread] No sequence for slug:', slug, lookupError)
      return NextResponse.json({ ok: false, error: 'No such sequence' }, { status: 404 })
    }

    // Deliberately stricter than notify-discord's version of this test.
    // notify-discord treats a stored value that fails SNOWFLAKE_RE as "no
    // thread" and posts a new one, which is right for a publish: the publish
    // has to reach Discord somehow. Here, ANY non-null value refuses. This
    // route's entire job is creating threads that do not exist yet, so a
    // column holding something unexpected is a reason to stop and have a human
    // look, never a reason to create a second thread for a sequence that may
    // already have one.
    const existingThreadId =
      typeof sequence.discord_thread_id === 'string' && sequence.discord_thread_id.trim()
        ? sequence.discord_thread_id.trim()
        : sequence.discord_thread_id ?? null

    if (existingThreadId) {
      return NextResponse.json(
        { ok: false, error: 'Sequence already has a Discord thread id' },
        { status: 409 },
      )
    }

    // ======================================================================
    // REPOINT MODE. threadId was supplied, so the thread already exists.
    // ======================================================================
    //
    // This mode is for three orphaned threads that are already sitting in the
    // forum holding real human conversation. They do not need a new thread and
    // they do not need a message; the only thing missing is the database
    // knowing they exist, so that comments posted on the site from now on
    // relay into the thread the conversation is already in.
    //
    // It therefore posts NOTHING to Discord and fires NO relay. Firing
    // fireSequencePublishedRelay here would tell Sataana's bot that a sequence
    // published weeks ago has just been published, which would hand out a
    // role-grant event for an event that did not happen.
    //
    // The 409 above applies to this mode too, and it matters most here:
    // repointing over an existing link silently orphans whatever thread the
    // column used to name, and no caller of this route should ever want that.
    // The status column is deliberately NOT checked in this mode -- a repoint
    // records a fact about a thread that already exists in the forum and
    // publishes nothing, so a sequence whose status has moved on since is
    // still better off with a correct link than a missing one.
    if (repointThreadId) {
      const { error: repointError } = await admin
        .from('sequences')
        .update({ discord_thread_id: repointThreadId })
        .eq('slug', slug)

      if (repointError) {
        console.error('[admin/sequence-thread] Failed to write repointed thread id:', repointError)
        return NextResponse.json(
          { ok: false, error: 'Could not save the thread link' },
          { status: 500 },
        )
      }

      return NextResponse.json({ ok: true, mode: 'repointed', threadId: repointThreadId })
    }

    // ======================================================================
    // CREATE MODE. No threadId supplied, so this route creates the thread.
    // ======================================================================

    if (sequence.status !== 'published') {
      return NextResponse.json(
        { ok: false, error: 'Sequence is not published' },
        { status: 409 },
      )
    }

    // THE LINE THIS WHOLE ROUTE IS ABOUT. The author is read off the sequence
    // row. There is no caller identity in this function to read instead --
    // that is the design, not an omission -- so there is nothing here that
    // could accidentally attribute the thread to the operator.
    const authorId = typeof sequence.author_id === 'string' ? sequence.author_id : null
    if (!authorId) {
      // Refuse rather than post an unattributed thread. A thread whose footer
      // says "a LazyGrip member" and whose relay names nobody is worse than no
      // thread: it looks bridged, so nobody ever comes back to fix it.
      console.error('[admin/sequence-thread] Sequence has no author_id, refusing:', slug)
      return NextResponse.json(
        { ok: false, error: 'Sequence has no author_id, cannot attribute a thread' },
        { status: 409 },
      )
    }

    // The author's profile, keyed on the SEQUENCE's author_id. Same three
    // columns and the same publicName call notify-discord makes, so the footer
    // on a backfilled thread is indistinguishable from the footer the publish
    // path would have produced at the time.
    //
    // No email is passed, and publicName's input type allows that. This route
    // has no session, so there is no user.email to pass -- and reading the
    // author's address out of auth.users to feed the guard would mean pulling
    // an email address into a code path whose entire purpose is posting to a
    // public forum. The email is only ever used to SUPPRESS a username that
    // equals its local part, so its absence can only make the guard more
    // permissive in one narrow case: an author whose username is their email
    // local part AND who has no display_name. The battletag and placeholder
    // checks are unaffected, and the 40 affected authors are known people with
    // real display names.
    const { data: authorProfile, error: profileLookupError } = await admin
      .from('profiles')
      .select('display_name, username, battletag')
      .eq('id', authorId)
      .single()

    if (profileLookupError) {
      console.error('[admin/sequence-thread] Failed to look up author profile:', profileLookupError)
    }

    const nameInput = {
      displayName: authorProfile?.display_name,
      username: authorProfile?.username,
      battletag: authorProfile?.battletag,
    }

    if (isUnsafePublicUsername(authorProfile?.username, nameInput)) {
      console.warn('[admin/sequence-thread] Suppressed a username matching a BattleTag, an email local part or a placeholder')
    }

    const authorName: string = publicName(nameInput)

    // Normalised once, used three times -- embed title, thread name, relay
    // payload -- exactly as notify-discord does it, with the same helper.
    const title = cleanText(sequence.title, 200) || 'Untitled sequence'

    // ======================================================================
    // BUILD CONTEXT, AND THE ONE PRECEDENCE RULE THAT GOVERNS IT
    // ======================================================================
    //
    // THE EXPORT ENVELOPE WINS. THE DATABASE COLUMN IS THE FALLBACK.
    //
    // The envelope is what the addon itself stamped into the export at export
    // time, so it is a measurement of the client that produced the sequence.
    // The column is a form field. On 25 of the 30 published rows that carry
    // both, the two DISAGREE, and the export is the correct one: the column
    // says 2.1.20 where the export says 2.3.10, because src/app/post/page.tsx
    // writes the WIRE FORMAT version into grip_version rather than the addon
    // version. That form bug belongs to PR 2 and is deliberately not fixed
    // here -- this route only reads, and reading the better of two sources
    // costs nothing, needs no migration, and does not touch the write path.
    //
    // The 31 rows with no envelope keep the column, which is why the fallback
    // exists at all rather than the column simply being dropped.
    let envelopeEmsVersion: string | null = null
    let envelopeWowPatch: string | null = null
    let envelopeWowBuild: string | null = null
    let exportTalentString: string | null = null

    if (typeof sequence.grip_string === 'string' && sequence.grip_string.trim()) {
      // decodeExport THROWS rather than returning an error result on an
      // unknown or encrypted prefix, and GSE3_ENCRYPTED is a real format the
      // site stores and cannot read. A decode failure must never stop a thread
      // being created -- the card is worth posting without a version line, and
      // this route's whole reason for existing is that these 40 sequences have
      // no thread. So: log once, carry on with no build context, and let the
      // columns answer instead.
      try {
        const decoded = decodeExport(sequence.grip_string)
        const envelope = decoded?.meta?.envelope
        const exportMeta = decoded?.meta?.exportMeta
        envelopeEmsVersion =
          typeof envelope?.addonVersion === 'string' ? envelope.addonVersion : null
        envelopeWowPatch = typeof envelope?.wowPatch === 'string' ? envelope.wowPatch : null
        envelopeWowBuild = typeof envelope?.wowBuild === 'string' ? envelope.wowBuild : null
        exportTalentString =
          typeof exportMeta?.talentString === 'string' ? exportMeta.talentString : null
      } catch (err) {
        console.warn('[admin/sequence-thread] Could not decode grip_string for build context:', slug, err)
      }
    }

    const emsVersion =
      envelopeEmsVersion || (typeof sequence.grip_version === 'string' ? sequence.grip_version : '')
    const wowPatch =
      envelopeWowPatch || (typeof sequence.patch_version === 'string' ? sequence.patch_version : '')

    // wow_build now falls back exactly as the other two do, because migration
    // 019 gave it a column to fall back to. Until 019 this line read
    // `envelopeWowBuild || ''` with a comment saying there was nowhere else to
    // look, and for the 31 rows whose export carries no envelope that meant no
    // build on the card at all.
    const wowBuild =
      envelopeWowBuild || (typeof sequence.wow_build === 'string' ? sequence.wow_build : '')

    // THE TALENT STRING RUNS THE OTHER WAY ROUND, and the asymmetry is
    // deliberate rather than an oversight. The column is what the AUTHOR chose
    // to publish on the site, so where it holds something it is the thing they
    // meant to show, and the export is only filling a gap. It fills a real
    // one: 10 rows carry a talent string in the export that never reached the
    // column, and on those the card would otherwise have no Talent Build field
    // even though the data was sitting inside the string it already decoded.
    const columnTalentString =
      typeof sequence.talent_string === 'string' ? sequence.talent_string.trim() : ''
    const talentString = columnTalentString || exportTalentString || ''

    // isEdit and isUpdate are both false: a backfill is the publish that
    // should have happened at the time, so the card carries no pencil and no
    // cycle glyph.
    //
    // created_at and updated_at go in so the card is stamped with the
    // SEQUENCE's time rather than the backfill's. Without them every one of
    // these 40 cards would claim its sequence was published on the day the
    // backfill ran, and a webhook message cannot be edited afterwards with a
    // bot token, so that claim would be permanent.
    const embed = buildSequenceEmbed({
      slug,
      title,
      className: sequence.class_name,
      specName: sequence.spec_name,
      heroTalent: sequence.hero_talent,
      contentType: sequence.content_type,
      specId: sequence.spec_id,
      talentString,
      emsVersion,
      wowPatch,
      wowBuild,
      createdAt: sequence.created_at,
      updatedAt: sequence.updated_at,
      authorName,
      isEdit: false,
      isUpdate: false,
    })

    // ?wait=true so Discord returns the created message, which is the only way
    // to learn the new thread's id: for a forum webhook post, the message's
    // channel_id IS the thread that was created for it.
    //
    // The bare sequence title, no prefix. notify-discord dropped its "New: " /
    // "Updated: " / "Edit: " thread-name prefixes on 2026-08-09 and all 18
    // pre-existing threads were renamed to their bare titles the same day; a
    // backfill that reintroduced prefixes on 40 more would undo that on the
    // spot.
    // CAPPED AT 100 FOR THE THREAD NAME ONLY, the same slice notify-discord
    // applies at both of its own thread-creating sites. `title` above is
    // cleanText(sequence.title, 200), which is the right cap for the embed
    // title and for the relay payload and is TWICE what Discord accepts in a
    // thread_name: over 100 it answers 400 and refuses the whole post, so this
    // route would produce no thread at all for that sequence rather than a
    // slightly shortened name. This route reads the same title column through
    // the same helper as notify-discord, so it carries exactly the same
    // exposure and takes exactly the same fix.
    //
    // No live title is near it -- the longest measured 2026-08-13 was 83
    // characters -- so this changes nothing about the backfill as it stands.
    const createBody: Record<string, unknown> = {
      embeds: [embed],
      username: 'LazyGrip',
      thread_name: title.slice(0, THREAD_NAME_MAX),
    }

    // FORUM TAGS, AND THE ONLY MOMENT THEY CAN BE SET FROM HERE. applied_tags
    // is accepted on the post that CREATES the thread; changing them later
    // means a bot-token PATCH on the thread, which is a different credential
    // and a different build. So the 40 backfilled threads get their class and
    // content tags now or they get them by hand.
    //
    // The key is sent only when the array is non-empty. Discord accepts
    // applied_tags: [] and does exactly nothing with it, so this changes no
    // thread; it keeps the payload honest, and it means a row whose class name
    // and content type both failed to resolve produces a post indistinguishable
    // from the one this route sent before tags existed.
    const appliedTags = resolveAppliedTags(sequence.class_name, sequence.content_type)
    if (appliedTags.length > 0) {
      createBody.applied_tags = appliedTags
    }

    const res = await fetch(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[admin/sequence-thread] Discord rejected webhook:', res.status, text)
      return NextResponse.json({ ok: false, error: 'Discord rejected the webhook' }, { status: 502 })
    }

    const responseData = await res.json()
    const candidate = responseData?.channel_id
    if (typeof candidate !== 'string' || !SNOWFLAKE_RE.test(candidate)) {
      // The thread very likely exists at this point, but without a valid id
      // there is nothing to save and nothing meaningful to relay, and guessing
      // one would be worse than saying so. 502 because the failure is in what
      // Discord sent back, not in the request.
      console.error(
        '[admin/sequence-thread] Webhook response missing a valid channel_id:',
        responseData,
      )
      return NextResponse.json(
        { ok: false, error: 'Discord response had no usable thread id' },
        { status: 502 },
      )
    }
    const newThreadId = candidate

    // Only discord_thread_id is written. last_discord_notified_at is left
    // alone on purpose: this is a retroactive bridge for a sequence published
    // weeks ago, not a notification about something that just happened, and
    // the column should keep meaning what it says.
    let warning: string | null = null
    const { error: updateError } = await admin
      .from('sequences')
      .update({ discord_thread_id: newThreadId })
      .eq('slug', slug)

    if (updateError) {
      console.error('[admin/sequence-thread] Failed to write back thread id, retrying once:', updateError)

      const { error: retryUpdateError } = await admin
        .from('sequences')
        .update({ discord_thread_id: newThreadId })
        .eq('slug', slug)

      if (retryUpdateError) {
        console.error('[admin/sequence-thread] Retry also failed to write back thread id:', retryUpdateError)
        // DO NOT RETURN HERE. The thread exists in Discord at this point
        // whatever Supabase did, so the relay below still has to fire -- the
        // bot's view of who owns which thread is a separate concern from this
        // site's copy of the link. An early return exactly here is what made a
        // real publish invisible to Sataana's bot on 2026-08-08 with nothing
        // in any log: the relay sat downstream of the return, so it never ran
        // and never wrote to relay_failures either. Record the warning, keep
        // going, and let the caller re-link this one by hand with a repoint
        // call naming the thread id below.
        warning = `Thread ${newThreadId} was created but the site could not save the link. Re-run this route in repoint mode with that threadId.`
      }
    }

    // ======================================================================
    // THE IMPORT STRING, AS A SECOND MESSAGE IN THE NEW THREAD
    // ======================================================================
    //
    // Placed exactly here on purpose: after newThreadId is established, after
    // the site has stored the link, and before the relay.
    //
    // A FAILURE HERE MUST NOT FAIL THE ROUTE. By this line the thread exists
    // in Discord and the database knows about it, so the two things this route
    // is responsible for have both happened; returning a 502 now would tell
    // the caller to retry a call that can only answer 409, and the operator
    // would then have to work out from the message that a repoint was needed.
    // A missing second message is a minute of manual posting instead. So the
    // failure is logged and travels back as a warning string, the same shape
    // the write-back retry above uses, and the response stays ok.
    const importMessage = buildImportMessage(sequence.grip_string, slug)
    if (importMessage) {
      try {
        await postImportMessage(webhookUrl, newThreadId, importMessage)
      } catch (err) {
        console.error('[admin/sequence-thread] Could not post the import string into the thread:', slug, err)
        const importWarning = `Thread ${newThreadId} was created but the import string could not be posted into it.`
        warning = warning ? `${warning} ${importWarning}` : importWarning
      }
    }

    // userId is the SEQUENCE's author_id, never the caller's. This is what
    // makes Sataana's bot ping the person who actually wrote the sequence and
    // count it toward their role, which is the decision recorded in design doc
    // section 14.2 under pacing.
    //
    // after(), not a floating promise, for the reason notify-discord and the
    // comments route both carry at their own relay calls: on a serverless
    // platform the invocation can be frozen the moment the response returns,
    // and fireSequencePublishedRelay awaits a Supabase round trip (the
    // discord_id lookup) before its outbound fetch. A bare call would reach
    // that first await, the response would return, and the request would never
    // leave the process -- with nothing in relay_failures either, since that
    // insert sits downstream of the fetch that never happened. after() hands
    // the promise to the platform's waitUntil without delaying this response.
    after(() =>
      fireSequencePublishedRelay({
        event: 'published',
        slug,
        title,
        userId: authorId,
        threadId: newThreadId,
        threadCreated: true,
      }).catch((err) => {
        // fireSequencePublishedRelay handles and logs its own failures; this
        // catch only guards against a truly unexpected throw so it can never
        // affect the response below.
        console.error('[admin/sequence-thread] Unexpected error firing sequence relay:', err)
      }),
    )

    if (warning) {
      return NextResponse.json({ ok: true, mode: 'created', threadId: newThreadId, warning })
    }

    return NextResponse.json({ ok: true, mode: 'created', threadId: newThreadId })
  } catch (err) {
    console.error('[admin/sequence-thread] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
