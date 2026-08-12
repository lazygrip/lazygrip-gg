import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
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
} from '@/lib/discord-embed'
import { decodeExport } from '@/lib/workshop'

// CONTENT_TYPE_LABELS, CLASS_COLORS, cleanText, SLUG_RE, SNOWFLAKE_RE and the
// embed construction itself all moved to src/lib/discord-embed.ts on
// 2026-08-09. This route stopped being the only thing that posts a sequence
// card to Discord that day: the backfill route at
// src/app/api/admin/sequence-thread/route.ts creates threads for the 40
// published sequences that never got one, and it has to produce a card
// identical to this one. Design doc section 14.6.
//
// Same move, same reasoning, as public-name.ts on the line above -- when a
// second caller shows up for a decision, the decision becomes a module instead
// of a copy. What did NOT move is who the author is: this route still resolves
// that from the authenticated session below, and the backfill route resolves
// it from the sequence row's author_id, which is exactly why the builder takes
// a finished authorName string and does not work it out for itself.

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const raw = (await req.json()) as Record<string, unknown>

    const slug = raw.slug
    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
      return NextResponse.json({ ok: false, error: 'Invalid slug' }, { status: 400 })
    }

    // THE BODY'S TITLE, WHICH IS NO LONGER THE ONE THAT REACHES DISCORD. It is
    // the FALLBACK for `sequenceTitle`, bound further down beside the four
    // other fields that moved onto the sequence row on 2026-08-11.
    //
    // It stays here, and it keeps this name, because it cannot move: the
    // sequence row is not read until the ownership check some eighty lines
    // below, and this line is what gives the route something to say when that
    // read finds nothing. Normalising it here also means the fallback and the
    // row path have both been through the same cleanText call with the same
    // 200-character cap, so whichever of the two wins, the embed title, the
    // thread name and the relay payload are still one identical string.
    const title = cleanText(raw.title, 200) || 'Untitled sequence'

    // Boolean() only so these satisfy the builder's boolean fields. Both were
    // bare `unknown` off the request body before and were read for their
    // truthiness in all three places they are used, so coercing them here is
    // the identical test written once instead of three times.
    const isUpdate = Boolean(raw.isUpdate)
    const isEdit = Boolean(raw.isEdit)
    const admin = createAdminClient()

    // The public name for the embed footer.
    //
    // This used to read `user.user_metadata?.username` and fall back to
    // `user.email`. user_metadata is Supabase AUTH metadata, which is a
    // different field from public.profiles.username and is absent for most
    // accounts, so that fallback published real email addresses into a public
    // Discord forum. Confirmed live on 2026-08-08: "Posted by
    // <address> · lazygrip.net" in #lazygrip-ems-sequence-sharing.
    //
    // The order is display_name, then username, then a generic literal, which
    // matches the expression the site already uses to name someone publicly in
    // src/app/user/[username]/page.tsx (`profile.display_name || profile.username`).
    //
    // The username step is CONDITIONAL, unlike the site's, for the reason set
    // out directly below: the same column can hold a BattleTag or an email
    // local part, and neither may ever be posted publicly. So the literal is
    // reachable in three ways, not one: a missing profile row, a failed query,
    // or an author with no display_name whose username failed the check.
    const { data: authorProfile, error: profileLookupError } = await admin
      .from('profiles')
      .select('display_name, username, battletag')
      .eq('id', user.id)
      .single()

    if (profileLookupError) {
      console.error('[notify-discord] Failed to look up author profile:', profileLookupError)
    }

    // THE SUPPRESSION RULES NOW LIVE IN src/lib/public-name.ts, and this
    // block is a call rather than a copy of them. They were inline here until
    // 2026-08-09, by which point they had been fixed twice in one night (PR
    // 31, then PR 32) and a second caller was arriving: the Discord comment
    // relay needs the identical decision for its webhook username. Keeping
    // two copies of a predicate with that history is how one of them stays
    // wrong. See the module header for what is suppressed and why.
    //
    // One behaviour change comes with the move, deliberately: a user_<hash>
    // placeholder username is now suppressed too. Design doc section 13.2.
    const nameInput = {
      displayName: authorProfile?.display_name,
      username: authorProfile?.username,
      battletag: authorProfile?.battletag,
      email: user.email,
    }

    if (isUnsafePublicUsername(authorProfile?.username, nameInput)) {
      console.warn('[notify-discord] Suppressed a username matching a BattleTag, an email local part or a placeholder')
    }

    const authorUsername: string = publicName(nameInput)

    // WIDENED ON 2026-08-11 TO THE SAME COLUMN LIST THE BACKFILL ROUTE READS.
    // It used to ask for discord_thread_id and author_id only, because the
    // embed was built entirely from the request body. It no longer is; see the
    // block at the buildSequenceEmbed call below for why the row won that
    // argument.
    //
    // This costs nothing. The read already happened on every call for the
    // ownership check directly beneath it, so widening the projection adds
    // columns to a round trip that was being made anyway.
    //
    // wow_build joined this list with migration 019, which created the column.
    // It was held back until then because PostgREST rejects the whole query on
    // one unknown column, and here that would have 500'd every publish on the
    // site rather than only the Discord half of it.
    const { data: sequenceRow, error: lookupError } = await admin
      .from('sequences')
      .select(
        'id, slug, title, author_id, class_name, spec_name, hero_talent, content_type, status, discord_thread_id, spec_id, talent_string, grip_string, grip_version, patch_version, wow_build, created_at, updated_at',
      )
      .eq('slug', slug)
      .single()

    if (lookupError) {
      console.error('[notify-discord] Failed to look up sequence:', lookupError)
    }

    // OWNERSHIP. Everything above this point authenticates the CALLER; nothing
    // above it ties the caller to the sequence they named. The row is fetched
    // by slug alone through the ADMIN client, so RLS does not apply either,
    // and user.id was read for exactly two things: the footer profile lookup
    // and the relay userId. Without this check any logged-in account could
    // post any published sequence's slug and land a card in that sequence's
    // Discord thread under their own name, with a relay firing "published"
    // attributed to them. Worse for a sequence that has no thread yet -- and
    // 37 published sequences are in that state -- the post below CREATES the
    // thread and the write-back at the bottom binds discord_thread_id to it
    // permanently, so somebody else's post becomes that sequence's thread
    // forever. The only caller of this route in the codebase is
    // src/app/post/page.tsx (publish, update and edit), which only ever
    // operates on a sequence the signed-in user owns, so this refuses nothing
    // legitimate.
    //
    // A row that was NOT found keeps the tolerant behaviour it already had. A
    // missing row is a separate pre-existing question and deliberately not
    // answered here.
    if (sequenceRow && sequenceRow.author_id !== user.id) {
      console.warn(`[notify-discord] Refused a notification for a sequence owned by another user: ${slug}`)
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const storedThreadId = sequenceRow?.discord_thread_id ?? null
    const existingThreadId = storedThreadId && SNOWFLAKE_RE.test(storedThreadId) ? storedThreadId : null

    // ======================================================================
    // THE CARD IS BUILT FROM THE ROW, NOT FROM THE REQUEST BODY
    // ======================================================================
    //
    // className, specName, heroTalent and contentType came off `raw` until
    // 2026-08-11. They now come off sequenceRow, and the body is used only
    // when there is no row at all.
    //
    // WHY. The body is client-supplied and unvalidated -- this route's only
    // checks on it are SLUG_RE on the slug and a whitespace-collapse on the
    // title -- so a caller could put any class name, any spec and any content
    // type on the card for a sequence they own, and now that those values also
    // choose the FORUM TAGS, the body would be choosing how the sequence is
    // filed in the forum. The row is truth: it is what the site itself renders
    // on the sequence page, and it is what the backfill route reads.
    //
    // WHY IT COSTS NOTHING. The row was already being read one block above for
    // the ownership check, on every call, so this is a projection widened on a
    // query that was happening anyway -- no extra round trip.
    //
    // WHAT IT CLOSES. Two callers rendering the same sequence differently.
    // notify-discord posting the body and sequence-thread posting the row is a
    // difference that shows up as two cards disagreeing in the same forum with
    // nothing failing to say so, which is the exact drift the shared builder
    // module was extracted to prevent.
    //
    // The fallback keys on the ROW's absence, not on a field being empty: a
    // row that exists and has a null class_name genuinely has no class name,
    // and reaching into the body to fill that in would reintroduce the problem
    // for precisely the rows where the site knows least.
    const className = sequenceRow ? sequenceRow.class_name : raw.className
    const specName = sequenceRow ? sequenceRow.spec_name : raw.specName
    const heroTalent = sequenceRow ? sequenceRow.hero_talent : raw.heroTalent
    const contentType = sequenceRow ? sequenceRow.content_type : raw.contentType

    // THE TITLE BELONGS IN THAT LIST HARDEST OF ALL, and the move above
    // skipped it. It is the one value on this route that is not merely
    // rendered: it becomes the PERMANENT forum thread name, which no later
    // publish can rename because thread_name is only honoured on the post that
    // creates the thread. It is also the embed title and the title the relay
    // hands to Sataana's bot. A body-supplied title therefore let a caller name
    // another surface's permanent object, which is the same argument that moved
    // the four fields above and applies here with the least room to undo it.
    //
    // ONE EXTRA STEP THE OTHER FOUR DO NOT NEED. Those four go to the builder
    // raw, because the builder narrows them itself. The title does not pass
    // through that narrowing, so the row's column is put through the same
    // cleanText(200) the body title went through above -- otherwise a stored
    // title carrying a newline would produce an embed title and a thread name
    // that disagree, which is the precise failure cleanText exists to prevent.
    //
    // The fallback is two-legged rather than one: no row at all, or a row whose
    // title cleans to nothing. The second leg matters because title is NOT NULL
    // in shape but not in practice -- whitespace cleans to the empty string --
    // and an empty thread name is a Discord 400 that would fail the publish.
    //
    // ORDERING IS SAFE. All five notifyDiscord call sites in
    // src/app/post/page.tsx fire after their insert or RPC has resolved, so the
    // row is already current by the time this route reads it and every
    // legitimate publish renders exactly the string the body would have.
    const rowTitle = sequenceRow ? cleanText(sequenceRow.title, 200) : ''
    const sequenceTitle = rowTitle || title

    // BUILD CONTEXT: THE EXPORT ENVELOPE WINS, THE COLUMN IS THE FALLBACK.
    // Identical rule and identical reasoning to the backfill route. The
    // envelope is what the addon stamped at export time; grip_version is a
    // form field that src/app/post/page.tsx currently fills with the WIRE
    // FORMAT version, so on 25 of the 30 rows carrying both, the column says
    // 2.1.20 where the export says 2.3.10. Fixing the form is PR 2's job; this
    // route reads, and reading the better source needs no migration.
    //
    // decodeExport THROWS on an unknown or encrypted prefix, and a decode
    // failure must never fail a publish -- the card and the thread matter far
    // more than the version line on it. Log once, carry on with no build
    // context.
    let envelopeEmsVersion: string | null = null
    let envelopeWowPatch: string | null = null
    let envelopeWowBuild: string | null = null
    let exportTalentString: string | null = null

    const gripString = typeof sequenceRow?.grip_string === 'string' ? sequenceRow.grip_string : ''
    if (gripString.trim()) {
      try {
        const decoded = decodeExport(gripString)
        const envelope = decoded?.meta?.envelope
        const exportMeta = decoded?.meta?.exportMeta
        envelopeEmsVersion =
          typeof envelope?.addonVersion === 'string' ? envelope.addonVersion : null
        envelopeWowPatch = typeof envelope?.wowPatch === 'string' ? envelope.wowPatch : null
        envelopeWowBuild = typeof envelope?.wowBuild === 'string' ? envelope.wowBuild : null
        exportTalentString =
          typeof exportMeta?.talentString === 'string' ? exportMeta.talentString : null
      } catch (err) {
        console.warn('[notify-discord] Could not decode grip_string for build context:', slug, err)
      }
    }

    const emsVersion =
      envelopeEmsVersion ||
      (typeof sequenceRow?.grip_version === 'string' ? sequenceRow.grip_version : '')
    const wowPatch =
      envelopeWowPatch ||
      (typeof sequenceRow?.patch_version === 'string' ? sequenceRow.patch_version : '')

    // Falls back to the column now that migration 019 has created one, the
    // same envelope-first shape as emsVersion and wowPatch above.
    const wowBuild =
      envelopeWowBuild || (typeof sequenceRow?.wow_build === 'string' ? sequenceRow.wow_build : '')

    // The talent string runs the other way round -- column first, export as
    // the gap-filler -- for the reason spelled out at the same lines in the
    // backfill route: the column is what the author chose to publish, and the
    // export only supplies one for the 10 rows where the column is empty.
    const columnTalentString =
      typeof sequenceRow?.talent_string === 'string' ? sequenceRow.talent_string.trim() : ''
    const talentString = columnTalentString || exportTalentString || ''

    // authorUsername is passed in rather than derived inside the builder. The
    // builder is shared with the backfill route, which has no session at all
    // and must attribute its threads to the sequence's own author_id, so the
    // one thing the two callers disagree about is deliberately left to them.
    const embed = buildSequenceEmbed({
      slug,
      title: sequenceTitle,
      className,
      specName,
      heroTalent,
      contentType,
      specId: sequenceRow?.spec_id,
      talentString,
      emsVersion,
      wowPatch,
      wowBuild,
      createdAt: sequenceRow?.created_at,
      updatedAt: sequenceRow?.updated_at,
      authorName: authorUsername,
      isEdit,
      isUpdate,
    })

    // The forum tags for whichever of the two paths below creates a thread.
    // Resolved once here, from the same row-first values the card is built
    // from, so a card and its tags can never disagree about what class a
    // sequence is.
    const appliedTags = resolveAppliedTags(className, contentType)

    const postUrl = existingThreadId
      ? `${webhookUrl}?thread_id=${existingThreadId}&wait=true`
      : `${webhookUrl}?wait=true`

    const body: Record<string, unknown> = {
      embeds: [embed],
      username: 'LazyGrip',
    }

    // THE BARE TITLE, NO PREFIX. This used to read
    //
    //   const threadPrefix = isEdit ? 'Edit: ' : isUpdate ? 'Updated: ' : 'New: '
    //   body.thread_name = `${threadPrefix}${title}`
    //
    // and those prefixes are what made the forum unreadable. A thread name is
    // permanent, so "New: " described a thread's first minute and then stayed
    // there forever, and a sequence that was published, updated and edited
    // ended up with whichever word happened to win the race to create it. All
    // 18 existing threads were renamed in place to the bare sequence title on
    // 2026-08-09; leaving the prefix here means the very next publish
    // reintroduces exactly what was just cleaned up. Do not restore it as a
    // typo fix.
    //
    // Nothing is lost by dropping it, because the prefix was never the signal
    // it looked like. The embed already carries a pencil glyph for an edit and
    // a cycle glyph for an update, and that is where the signal belongs: on
    // the message, which is the thing that is actually new, rather than on the
    // thread's permanent name. Those glyphs are untouched.
    //
    // Note the guard this sits inside: thread_name is only ever sent when
    // there is NO existing thread id, so this affects the creation of new
    // threads only. It cannot rename a thread that already exists -- Discord
    // ignores thread_name when the webhook targets an existing thread, and the
    // only reason we ever send it is to name the thread being created.
    if (!existingThreadId) {
      body.thread_name = sequenceTitle

      // applied_tags rides along with thread_name and only with thread_name,
      // because this is the post that CREATES the thread and Discord accepts
      // the tags only there. Changing a thread's tags afterwards is a
      // bot-token PATCH, which this route does not have. Sent only when
      // non-empty: an empty applied_tags array is accepted and does nothing,
      // and omitting it keeps the payload honest.
      if (appliedTags.length > 0) {
        body.applied_tags = appliedTags
      }
    }

    let res = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    let retriedAsNewThread = false
    if (!res.ok && existingThreadId) {
      const failText = await res.text()
      console.error(
        '[notify-discord] Post into existing thread failed, retrying as new thread:',
        res.status,
        failText,
      )
      const retryBody: Record<string, unknown> = { ...body }
      // Bare title here too, for the reason set out at the other thread_name
      // assignment above. This is the second of the two places the "New: " /
      // "Updated: " / "Edit: " prefix used to be applied, and it is the one
      // that is easy to miss: it fires when a post into a recorded thread
      // fails, which means the thread it names is being created right now and
      // will keep this name permanently, exactly like the first one.
      retryBody.thread_name = sequenceTitle
      // THE SECOND OF THE TWO THREAD-CREATING SITES, and the one that is easy
      // to miss -- it fires when a post into a recorded thread fails, which
      // means a thread is being created right here and will keep whatever tags
      // it is given now, exactly like the first site. `body` cannot already
      // carry applied_tags at this point: the block above only sets them when
      // there is no existing thread id, and this retry only runs when there
      // is.
      if (appliedTags.length > 0) {
        retryBody.applied_tags = appliedTags
      }
      res = await fetch(`${webhookUrl}?wait=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryBody),
      })
      retriedAsNewThread = true
    }

    if (!res.ok) {
      const text = await res.text()
      console.error('[notify-discord] Discord rejected webhook:', res.status, text)
      return NextResponse.json({ ok: false, error: 'Discord rejected the webhook' }, { status: 502 })
    }

    const responseData = await res.json()

    const isNewThread = !existingThreadId || retriedAsNewThread
    let newThreadId: string | null = null
    if (isNewThread) {
      const candidate = responseData?.channel_id
      if (typeof candidate === 'string' && SNOWFLAKE_RE.test(candidate)) {
        newThreadId = candidate
      } else {
        console.error(
          '[notify-discord] New-thread response missing a valid channel_id, not persisting a thread id:',
          responseData,
        )
      }
    }

    const updatePayload: Record<string, unknown> = {
      last_discord_notified_at: new Date().toISOString(),
    }
    if (newThreadId) {
      updatePayload.discord_thread_id = newThreadId
    }

    const { error: updateError } = await admin
      .from('sequences')
      .update(updatePayload)
      .eq('slug', slug)

    let threadLinkWarning: string | null = null
    if (updateError) {
      console.error('[notify-discord] Failed to write back thread id, retrying once:', updateError)

      const { error: retryUpdateError } = await admin
        .from('sequences')
        .update(updatePayload)
        .eq('slug', slug)

      if (retryUpdateError) {
        console.error('[notify-discord] Retry also failed to write back thread id:', retryUpdateError)
        // Do NOT return here. Whether this site's own copy of the thread
        // id got saved is unrelated to whether Sataana's bot should be
        // told the publish happened -- a Discord thread genuinely exists
        // at this point regardless of what Supabase does next. Returning
        // early here previously skipped fireSequencePublishedRelay
        // entirely with no exception and nothing logged to
        // relay_failures, which is exactly the failure mode that made a
        // real publish invisible to Sataana's bot on 2026-08-08 with zero
        // trace in any log. Record the warning and keep going so the
        // relay call below still fires.
        threadLinkWarning =
          'Discord notification sent, but the site could not save the thread link. A future edit may create a duplicate thread.'
      }
    }

    const finalThreadId = newThreadId ?? existingThreadId

    // ======================================================================
    // THE IMPORT STRING, AS A SECOND MESSAGE UNDER THE CARD
    // ======================================================================
    //
    // Posted on EVERY notification, not only on the one that creates the
    // thread. That is deliberate. This route already re-posts the card on
    // every publish, update and edit, so a thread accumulates cards; if the
    // import string were posted once at creation, an updated sequence would
    // end up with a fresh card sitting above a stale string, and a player
    // scrolling to the newest card would copy an import that no longer matches
    // it. Pairing each card with the string that belongs to it is the only
    // arrangement where the newest thing in the thread is also the correct
    // thing.
    //
    // A FAILURE HERE MUST NOT FAIL THE PUBLISH. The card is posted, the thread
    // link is written and the relay still has to fire, so the failure is
    // logged, folded into the same warning string the write-back retry uses,
    // and the response stays ok.
    const importMessage = finalThreadId
      ? buildImportMessage(sequenceRow?.grip_string, slug)
      : null
    if (importMessage && finalThreadId) {
      try {
        await postImportMessage(webhookUrl, finalThreadId, importMessage)
      } catch (err) {
        console.error('[notify-discord] Could not post the import string into the thread:', slug, err)
        const importWarning =
          'Discord notification sent, but the import string could not be posted into the thread.'
        threadLinkWarning = threadLinkWarning
          ? `${threadLinkWarning} ${importWarning}`
          : importWarning
      }
    }

    // Fire the relay to Sataana's gripbot now that we know the resolved
    // thread id and whether it was newly created. This now runs
    // unconditionally after a successful Discord post, regardless of
    // whether the thread-id write-back above succeeded -- those are two
    // independent concerns and a failure in one must never silently
    // suppress the other.
    //
    // SCHEDULED WITH after() RATHER THAN LEFT AS A FLOATING PROMISE. This
    // used to be a bare call whose promise nobody held, immediately followed
    // by the return below. On a serverless platform the invocation can be
    // frozen or torn down the moment the response is returned, and anything
    // still pending goes with it. fireSequencePublishedRelay awaits a
    // Supabase round trip (the discord_id lookup) BEFORE its outbound fetch,
    // so the handler reached its return while the relay was still parked on
    // that first await and the request never left the process. That produces
    // a specific and very confusing signature: nothing arrives at the bot AND
    // nothing is written to relay_failures, because that insert sits
    // downstream of the fetch that never happened. The Discord thread is
    // still created, because that work is awaited above.
    //
    // after() hands the promise to the platform's waitUntil, which keeps the
    // invocation alive until it settles. It does NOT block or delay this
    // response, so the fire-and-forget contract with the bot is unchanged and
    // a slow or unreachable gripbot still cannot fail a publish. The relay
    // helper keeps owning its own retries and failure logging.
    //
    // Note that after() runs within the route's max duration, so the retry
    // ladder in relay.ts (three attempts, 2.5s timeout each, 0.5s and 2s
    // backoff) is bounded by that budget rather than by itself.
    const relayEvent = isEdit ? 'edited' : isUpdate ? 'updated' : 'published'
    after(() =>
      fireSequencePublishedRelay({
        event: relayEvent,
        slug,
        title: sequenceTitle,
        userId: user.id,
        threadId: finalThreadId,
        threadCreated: isNewThread && newThreadId !== null,
      }).catch((err) => {
        // fireSequencePublishedRelay already handles and logs its own
        // failures internally -- this catch only guards against a truly
        // unexpected throw so it can never affect the response below.
        console.error('[notify-discord] Unexpected error firing sequence relay:', err)
      }),
    )

    if (threadLinkWarning) {
      return NextResponse.json({ ok: true, warning: threadLinkWarning })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify-discord] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
