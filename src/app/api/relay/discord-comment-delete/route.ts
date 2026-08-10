import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { SNOWFLAKE_RE } from '@/lib/discord-embed'

// INBOUND relay, delete half: a Discord message that was relayed in as a
// comment is deleted on Discord, so the comment it produced is soft-deleted.
// Design doc section 14.10.2. Called server-to-server by gripbot, never by a
// browser.
//
// SOFT DELETE, NEVER A HARD ONE. is_deleted is set and the row stays. That
// column and the RLS around it are what migration 004 exists for, and every
// other delete path on the site works this way, so a Discord-driven delete
// must not be the one that removes rows nobody else can remove. It also means
// a delete driven by a mis-fired gateway event is recoverable by flipping one
// boolean rather than by going to a backup.
//
// The row is located by discord_message_id and by nothing else, and the source
// check is here for the same reason it is on the edit route: it costs one
// comparison and it means a future bug that mis-populates that column cannot
// turn into a Discord client deleting somebody's web comment. 409 rather than
// 404, because the row exists and the refusal is about what it is.
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

// Same in-memory limiter as the other two relay routes, with its own budget.
// Resets on cold start / deploy, which is acceptable for a low-volume
// server-to-server route.
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
  // Guard order matches the other two relay routes exactly: secret configured,
  // secret matches, rate limit, read body, validate body, act. The body is
  // never parsed until the caller has proven it holds the secret, and the rate
  // limit sits after the secret check so an unauthenticated caller cannot
  // consume the budget.
  const expectedSecret = process.env.DISCORD_RELAY_SECRET
  if (!expectedSecret) {
    console.error('[relay/discord-comment-delete] DISCORD_RELAY_SECRET not configured, refusing all calls')
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

    const admin = createAdminClient()

    const { data: existing, error: lookupError } = await admin
      .from('comments')
      .select('id, source')
      .eq('discord_message_id', discordMessageId)
      .single()

    if (lookupError || !existing) {
      // A message the site never relayed in the first place. Normal on a bot
      // that sees every deletion in the forum, so it is a 404 the bot can
      // ignore rather than something to retry.
      return NextResponse.json({ ok: false, error: 'No such comment' }, { status: 404 })
    }

    if (existing.source !== 'discord') {
      console.error(
        '[relay/discord-comment-delete] Refusing to delete a non-discord comment:',
        existing.id,
        existing.source,
      )
      return NextResponse.json(
        { ok: false, error: 'Comment did not originate on Discord' },
        { status: 409 },
      )
    }

    // Setting is_deleted twice is harmless, so a replayed delete event is
    // idempotent without needing a marker of its own the way the insert route
    // needs one for 23505.
    const { error: deleteError } = await admin
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', existing.id)

    if (deleteError) {
      console.error('[relay/discord-comment-delete] Soft delete failed:', deleteError)
      return NextResponse.json({ ok: false, error: 'Could not delete comment' }, { status: 500 })
    }

    // No outbound relay here either, for the reason the insert route's header
    // gives: relaying this deletion back to Discord would delete the message
    // that caused it.
    return NextResponse.json({ ok: true, comment_id: existing.id })
  } catch (err) {
    console.error('[relay/discord-comment-delete] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
