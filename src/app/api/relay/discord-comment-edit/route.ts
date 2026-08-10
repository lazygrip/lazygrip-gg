import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { SNOWFLAKE_RE } from '@/lib/discord-embed'

// INBOUND relay, edit half: a Discord message that was relayed in as a comment
// gets edited on Discord, so the comment it produced follows. Design doc
// section 14.10.2. Called server-to-server by gripbot, never by a browser.
//
// THE ROW IS LOCATED BY discord_message_id AND BY NOTHING ELSE. No comment id
// and no author identity is accepted from the caller, for the same reason the
// insert route accepts no author_id: the only thing a Discord client is
// allowed to name is the Discord message, and the mapping from that message to
// a row is this route's to make. Discord itself already guarantees that only
// the message author can edit their own message, so the identity question is
// answered upstream; the shared secret is what says this caller is gripbot at
// all.
//
// THE source CHECK IS NOT REDUNDANT. Today a discord_message_id could only
// ever be attached to a relayed row, so the predicate can never fire. It costs
// one comparison and it means a future bug that mis-populates that column
// cannot turn into a Discord client rewriting somebody's web comment. 409
// rather than 404, because the row exists and the refusal is about what it is.
//
// updated_at is deliberately not set here. Whatever the table already does
// with it -- trigger, default, nothing -- is what a site edit does, and an
// edit arriving from Discord should not be a second, divergent answer to that
// question.
//
// The runtime is pinned to nodejs because the secret comparison below uses
// node:crypto, the same reason admin/sequence-thread pins it.
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

// Same in-memory limiter as the insert route, with its own budget so a burst
// of edits cannot starve new comments. Resets on cold start / deploy, which is
// acceptable for a low-volume server-to-server route.
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
  // Guard order matches the insert route exactly: secret configured, secret
  // matches, rate limit, read body, validate body, act. The body is never
  // parsed until the caller has proven it holds the secret, and the rate limit
  // sits after the secret check so an unauthenticated caller cannot consume
  // the budget.
  const expectedSecret = process.env.DISCORD_RELAY_SECRET
  if (!expectedSecret) {
    console.error('[relay/discord-comment-edit] DISCORD_RELAY_SECRET not configured, refusing all calls')
    return NextResponse.json({ ok: false, error: 'Route not configured' }, { status: 503 })
  }

  const providedSecret = req.headers.get('x-relay-secret')
  if (!providedSecret || !timingSafeEqualStrings(providedSecret, expectedSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (isRateLimited()) {
    return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 })
  }

  try {
    let raw: Record<string, unknown>
    try {
      raw = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const messageIdRaw = raw.discord_message_id
    if (typeof messageIdRaw !== 'string' || !SNOWFLAKE_RE.test(messageIdRaw)) {
      return NextResponse.json({ ok: false, error: 'Invalid discord_message_id' }, { status: 400 })
    }
    const discordMessageId = messageIdRaw

    // NOT length-capped, deliberately, for the reason comments/route.ts spells
    // out: comments.body has no constraint in the schema, so a cap added here
    // would be a new restriction smuggled in under a plumbing change. It would
    // also be a strange one on this route in particular, where refusing the
    // edit would leave the site showing text the author has already changed.
    const bodyRaw = raw.body
    if (typeof bodyRaw !== 'string' || !bodyRaw.trim()) {
      return NextResponse.json({ ok: false, error: 'Comment body is required' }, { status: 400 })
    }
    const body = bodyRaw.trim()

    const admin = createAdminClient()

    const { data: existing, error: lookupError } = await admin
      .from('comments')
      .select('id, source')
      .eq('discord_message_id', discordMessageId)
      .single()

    if (lookupError || !existing) {
      // A message the site never relayed in the first place. Normal enough on
      // a bot that sees every edit in the forum, including edits to messages
      // posted before the bridge existed or by unlinked accounts, so it is a
      // 404 the bot can ignore rather than something to retry.
      return NextResponse.json({ ok: false, error: 'No such comment' }, { status: 404 })
    }

    if (existing.source !== 'discord') {
      console.error(
        '[relay/discord-comment-edit] Refusing to edit a non-discord comment:',
        existing.id,
        existing.source,
      )
      return NextResponse.json(
        { ok: false, error: 'Comment did not originate on Discord' },
        { status: 409 },
      )
    }

    const { error: updateError } = await admin
      .from('comments')
      .update({ body })
      .eq('id', existing.id)

    if (updateError) {
      console.error('[relay/discord-comment-edit] Update failed:', updateError)
      return NextResponse.json({ ok: false, error: 'Could not edit comment' }, { status: 500 })
    }

    // No outbound relay here either, for the reason the insert route's header
    // gives: relaying this edit back to Discord would edit the message that
    // caused it.
    return NextResponse.json({ ok: true, comment_id: existing.id })
  } catch (err) {
    console.error('[relay/discord-comment-edit] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
