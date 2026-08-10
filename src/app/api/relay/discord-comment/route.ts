import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { SLUG_RE, SNOWFLAKE_RE } from '@/lib/discord-embed'

// INBOUND relay: a message posted in a sequence's Discord thread becomes a
// comment on lazygrip.net. Design doc section 14.10, which is the settled
// contract this file implements. Called server-to-server by gripbot on
// Jesper's box, never by a browser.
//
// WHY THIS IS NOT A COPY OF src/app/api/comments/route.ts, WHICH IS THE
// OBVIOUS THING TO REACH FOR. That route inserts through the SESSION client
// so the RLS policy from migration 009 decides the write:
//
//   auth.uid() = author_id
//   and public.is_verified_poster(author_id)
//   and public.has_completed_onboarding(author_id)
//
// A session client cannot work here. This caller carries a shared secret and
// no cookies, so auth.uid() is NULL, and the first conjunct is then false for
// every author_id in existence. A session-client insert from this route does
// not fail sometimes, it fails always.
//
// So the insert below goes through the ADMIN client, RLS does not apply, and
// THIS ROUTE OWES THE DATABASE THE POLICY THAT RLS IS NO LONGER APPLYING.
// That debt is paid in three places, one per conjunct:
//
//   auth.uid() = author_id      No author_id, profile id or user id is ever
//                               accepted from the request body. The caller
//                               supplies a discord_id and this route resolves
//                               it itself through lookup_profile_by_discord_id
//                               (migration 013), so a bot that is buggy or
//                               compromised can only post as whoever genuinely
//                               owns that Discord account. This is strictly
//                               stronger than checking a supplied id against
//                               anything.
//   is_verified_poster          Called explicitly below, refused on false.
//                               display_name set, confirmed email or completed
//                               OAuth, account older than 60 minutes
//                               (migration 007). 007 exists because an
//                               unverified account published a taunting
//                               sequence through the normal flow; a relay that
//                               skipped this check would be a second front
//                               door for exactly that account class.
//   has_completed_onboarding    Called explicitly below, refused on false.
//                               Migration 014 revoked this one from anon and
//                               granted it to service_role, which is what
//                               makes it callable from here at all.
//
// Both RPCs take a parameter named check_user_id. That was probed live against
// the running database on 2026-08-09, not read off a migration.
//
// THIS ROUTE MUST NEVER FIRE THE OUTBOUND RELAY. comments/route.ts ends by
// handing the site-to-Discord comment relay to the platform's deferred-work
// hook. There is deliberately no equivalent anywhere in this file. That
// absence, plus source='discord' on the inserted row, is the entire loop
// prevention: relaying this comment back to Discord would re-post the message
// that created it. Copying the tail of comments/route.ts along with its head
// is the single easiest way to build an infinite loop.
//
// parent_id is ignored on purpose. Discord thread replies are flat, and the
// design records that as a decision rather than an omission.
//
// The runtime is pinned to nodejs because the secret comparison below uses
// node:crypto, the same reason admin/sequence-thread pins it. It is the
// default for route handlers, but this route breaks rather than degrades if
// that ever changes, so it says so out loud.
export const runtime = 'nodejs'

// Copied from src/app/api/relay-identity/route.ts rather than reimplemented.
// timingSafeEqual throws on length mismatch rather than returning false, and
// comparing lengths first is not itself a timing leak worth avoiding here
// since secret length is not sensitive, only its value is.
function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

// Minimal in-memory rate limit, same shape and same reasoning as
// relay-identity: this is a low-volume server-to-server route (one bot,
// bursts around comment activity), not a public endpoint needing durable
// cross-instance limiting. It resets on cold start / deploy, which is
// acceptable at this volume. The budget is per module, so the three relay
// routes do not share one; that is deliberate, since a burst of edits should
// not be able to starve new comments.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60
const requestLog: number[] = []

function isRateLimited(): boolean {
  const now = Date.now()
  while (requestLog.length > 0 && now - requestLog[0] > RATE_LIMIT_WINDOW_MS) {
    requestLog.shift()
  }
  if (requestLog.length >= RATE_LIMIT_MAX) return true
  requestLog.push(now)
  return false
}

export async function POST(req: NextRequest) {
  // GUARD ORDER BELOW IS THE SECURITY PROPERTY, NOT A STYLE CHOICE:
  //
  //   a. secret configured
  //   b. secret matches
  //   c. rate limit
  //   d. read body
  //   e. validate body
  //   f. resolve the sequence
  //   g. resolve the author from discord_id, never from the body
  //   h. run the two posting gates
  //   i. insert
  //
  // The body is never parsed until the caller has proven it holds the secret,
  // because JSON parsing of an attacker-supplied payload is real work done on
  // an attacker's behalf. The rate limit sits AFTER the secret check so an
  // unauthenticated caller cannot consume the budget and lock the real bot out.

  // a. A route whose secret is unset must not fall open. 503 and do nothing,
  // the same shape admin/sequence-thread and relay.ts use. A misconfigured
  // deploy that quietly accepted every caller would be strictly worse than
  // this route not existing, because it would look like it was working.
  const expectedSecret = process.env.DISCORD_RELAY_SECRET
  if (!expectedSecret) {
    console.error('[relay/discord-comment] DISCORD_RELAY_SECRET not configured, refusing all calls')
    return NextResponse.json({ ok: false, error: 'Route not configured' }, { status: 503 })
  }

  // b. Deliberately identical response whether the secret is missing,
  // malformed, or simply wrong -- do not distinguish, so a caller cannot use
  // response differences to probe for a near-correct secret.
  const providedSecret = req.headers.get('x-relay-secret')
  if (!providedSecret || !timingSafeEqualStrings(providedSecret, expectedSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // c.
  if (isRateLimited()) {
    return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 })
  }

  try {
    // d.
    let raw: Record<string, unknown>
    try {
      raw = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    // e. THE ONLY IDENTITY THIS ROUTE ACCEPTS IS A DISCORD ID. There is no
    // author_id, user_id or profile field read from raw anywhere in this file,
    // and there must never be one.
    const discordIdRaw = raw.discord_id
    if (typeof discordIdRaw !== 'string' || !SNOWFLAKE_RE.test(discordIdRaw)) {
      return NextResponse.json({ ok: false, error: 'Invalid discord_id' }, { status: 400 })
    }
    const discordId = discordIdRaw

    const messageIdRaw = raw.discord_message_id
    if (typeof messageIdRaw !== 'string' || !SNOWFLAKE_RE.test(messageIdRaw)) {
      return NextResponse.json({ ok: false, error: 'Invalid discord_message_id' }, { status: 400 })
    }
    const discordMessageId = messageIdRaw

    // NOT length-capped, deliberately, for the reason comments/route.ts spells
    // out at length: comments.body has no constraint in the schema and the
    // browser insert it replaced had none either, so a cap added here would be
    // a new restriction smuggled in under a plumbing change. Discord's own
    // 2000-character limit already bounds anything arriving through this route.
    const bodyRaw = raw.body
    if (typeof bodyRaw !== 'string' || !bodyRaw.trim()) {
      return NextResponse.json({ ok: false, error: 'Comment body is required' }, { status: 400 })
    }
    const body = bodyRaw.trim()

    // f. Exactly one way of naming the sequence per call, the same way
    // relay-identity refuses an ambiguous lookup rather than guessing which
    // one the caller meant. The bot knows the thread id it read the message
    // from; the slug is there for callers that have it instead.
    const slugRaw = raw.slug
    const threadIdRaw = raw.discord_thread_id
    const hasSlug = typeof slugRaw === 'string' && slugRaw.length > 0
    const hasThreadId = typeof threadIdRaw === 'string' && threadIdRaw.length > 0

    if (hasSlug === hasThreadId) {
      return NextResponse.json(
        { ok: false, error: 'Provide exactly one of slug or discord_thread_id' },
        { status: 400 },
      )
    }

    if (hasSlug && !SLUG_RE.test(slugRaw as string)) {
      return NextResponse.json({ ok: false, error: 'Invalid slug' }, { status: 400 })
    }
    if (hasThreadId && !SNOWFLAKE_RE.test(threadIdRaw as string)) {
      return NextResponse.json({ ok: false, error: 'Invalid discord_thread_id' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: sequence, error: sequenceError } = hasSlug
      ? await admin.from('sequences').select('id, slug').eq('slug', slugRaw as string).single()
      : await admin
          .from('sequences')
          .select('id, slug')
          .eq('discord_thread_id', threadIdRaw as string)
          .single()

    if (sequenceError || !sequence) {
      console.error(
        '[relay/discord-comment] No sequence for',
        hasSlug ? `slug ${slugRaw as string}` : `thread ${threadIdRaw as string}`,
        sequenceError,
      )
      return NextResponse.json({ ok: false, error: 'No such sequence' }, { status: 404 })
    }

    // g. OBLIGATION 1. The author is resolved here, from the Discord id, and
    // nowhere else. Goes through the same SECURITY DEFINER RPC relay-identity
    // uses (migration 013) rather than querying auth.identities directly, since
    // the service role has no SELECT on auth.identities through PostgREST and
    // granting it would expose more than this one lookup needs.
    const { data: profileRows, error: lookupError } = await admin.rpc(
      'lookup_profile_by_discord_id',
      { p_discord_id: discordId },
    )

    if (lookupError) {
      console.error('[relay/discord-comment] Discord identity lookup failed:', lookupError)
      return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 })
    }

    const profile = Array.isArray(profileRows) ? profileRows[0] : null

    // AN UNLINKED COMMENTER IS NOT AN ERROR. Most people in the Discord have
    // never connected a lazygrip.net account, and their messages are simply not
    // relayed. 200 with linked:false so the bot reacts with a link prompt
    // instead of treating this as a failure and retrying forever.
    if (!profile) {
      return NextResponse.json({ ok: true, linked: false })
    }

    const authorId = typeof profile.id === 'string' ? profile.id : null
    if (!authorId) {
      console.error('[relay/discord-comment] Identity lookup returned a row with no id')
      return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 })
    }

    // h. OBLIGATIONS 2 AND 3. These two calls are the RLS policy, run by hand
    // because the admin client means Postgres will not run it for us. Both take
    // check_user_id, and both are given the RESOLVED id, never anything off the
    // request. A false from either is a policy decision about this account, not
    // a fault, so it answers 403 with a reason the bot can tell apart from the
    // 401 it gets for a bad secret.
    const { data: isVerified, error: verifiedError } = await admin.rpc('is_verified_poster', {
      check_user_id: authorId,
    })

    if (verifiedError) {
      console.error('[relay/discord-comment] is_verified_poster failed:', verifiedError)
      return NextResponse.json({ ok: false, error: 'Gate check failed' }, { status: 500 })
    }

    if (isVerified !== true) {
      return NextResponse.json(
        { ok: false, error: 'Not allowed to comment', reason: 'not_verified_poster' },
        { status: 403 },
      )
    }

    const { data: hasOnboarded, error: onboardingError } = await admin.rpc(
      'has_completed_onboarding',
      { check_user_id: authorId },
    )

    if (onboardingError) {
      console.error('[relay/discord-comment] has_completed_onboarding failed:', onboardingError)
      return NextResponse.json({ ok: false, error: 'Gate check failed' }, { status: 500 })
    }

    if (hasOnboarded !== true) {
      return NextResponse.json(
        { ok: false, error: 'Not allowed to comment', reason: 'onboarding_incomplete' },
        { status: 403 },
      )
    }

    // i. source is 'discord' so the outbound relay in comments/route.ts can
    // tell this row apart from one typed into the site and never send it back
    // where it came from (design doc section 3.3). discord_message_id is what
    // the edit and delete routes locate this row by later.
    const { data: comment, error: insertError } = await admin
      .from('comments')
      .insert({
        sequence_id: sequence.id,
        author_id: authorId,
        body,
        source: 'discord',
        discord_message_id: discordMessageId,
      })
      .select('id')
      .single()

    if (insertError) {
      // j. A GATEWAY REPLAY IS A NORMAL EVENT, NOT A FAULT. Migration 012 put a
      // UNIQUE index partial on non-null discord_message_id precisely so a
      // reconnecting bot re-delivering a message cannot double-post it. 23505
      // means that index did its job, so answer 200 with a duplicate marker: a
      // 500 here would make the bot retry the replay forever.
      if (insertError.code === '23505') {
        return NextResponse.json({ ok: true, linked: true, duplicate: true })
      }
      console.error('[relay/discord-comment] Insert failed:', insertError)
      return NextResponse.json({ ok: false, error: 'Could not post comment' }, { status: 500 })
    }

    // NOTHING FOLLOWS THE INSERT. No deferred work, no outbound relay call of
    // any kind. See the header: that absence is the loop prevention.
    return NextResponse.json({
      ok: true,
      linked: true,
      duplicate: false,
      comment_id: comment?.id ?? null,
    })
  } catch (err) {
    console.error('[relay/discord-comment] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
