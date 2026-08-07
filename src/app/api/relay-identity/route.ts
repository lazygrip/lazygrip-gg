import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual } from 'crypto'

// This endpoint is not for browsers. It is called server-to-server by the
// GRIP Discord bot (gripbot, on Jesper's box) to resolve the mapping between
// a Discord account and a lazygrip.net account, in both directions:
//
//   discord_id -> profile   used for granting the Forgemaster role on
//                            publish, and for attributing a relayed Discord
//                            message to a real site comment author
//   user_id -> discord_id   used so the site's outbound comment relay can
//                            tell the bot which Discord user (if any) is
//                            the author of a given comment, e.g. for future
//                            features that need to @-mention the original
//                            poster on Discord
//
// Design constraints (see design doc section 4.2), enforced below:
//   MUST     accept only an authenticated caller (shared secret, constant-time compare)
//   MUST     answer only the specific lookup asked, never enumerate
//   MUST     be rate limited
//   MUST NOT ever return a Discord id to a browser or any public route --
//            this route itself is the boundary; nothing here should ever be
//            called from client-side code
//   MUST NOT accept a Discord id and return the account without also
//            requiring authentication for the reverse direction -- both
//            directions are gated identically below

// Supports multiple valid secrets so a new caller or a rotated secret can be
// added without changing the comparison logic -- just extend this list (or,
// longer-term, move it to a table if there end up being several distinct
// callers with different rate-limit needs).
function getValidSecrets(): string[] {
  const secrets = [process.env.DISCORD_RELAY_SECRET]
  return secrets.filter((s): s is string => typeof s === 'string' && s.length > 0)
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  // timingSafeEqual throws on length mismatch rather than returning false,
  // and comparing lengths first is not itself a timing leak worth avoiding
  // here since secret length is not sensitive, only its value is.
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get('x-relay-secret')
  if (!provided) return false
  return getValidSecrets().some((valid) => timingSafeEqualStrings(provided, valid))
}

// Minimal in-memory rate limit. Resets on cold start / deploy, which is
// acceptable here: this is a low-volume, server-to-server route (one bot,
// bursts around publishes and comment activity), not a public endpoint
// needing durable cross-instance limiting. If call volume grows enough for
// that gap to matter, move this to a Supabase table or Upstash.
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

const SNOWFLAKE_RE = /^\d{17,20}$/

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    // TEMP DEBUG (remove before considering this endpoint finished): reveals
    // only whether DISCORD_RELAY_SECRET is set server-side and its length --
    // never the value itself -- so a mismatch (missing var vs. wrong value)
    // can be diagnosed without exposing the secret in the response.
    const configured = process.env.DISCORD_RELAY_SECRET
    const provided = req.headers.get('x-relay-secret')
    return NextResponse.json({
      ok: false,
      error: 'Unauthorized',
      debug: {
        secret_is_set_on_server: typeof configured === 'string' && configured.length > 0,
        secret_length_on_server: configured?.length ?? 0,
        provided_header_present: !!provided,
        provided_header_length: provided?.length ?? 0,
      },
    }, { status: 401 })
  }

  if (isRateLimited()) {
    return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 })
  }

  let raw: Record<string, unknown>
  try {
    raw = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const discordId = raw.discord_id
  const userId = raw.user_id

  // Exactly one lookup direction per call. Answer only what was asked --
  // never return more than the single matching record, and never expose a
  // way to list or enumerate identities.
  const hasDiscordId = typeof discordId === 'string' && discordId.length > 0
  const hasUserId = typeof userId === 'string' && userId.length > 0

  if (hasDiscordId === hasUserId) {
    // Both provided, or neither provided -- reject rather than guessing
    // which one the caller meant.
    return NextResponse.json(
      { ok: false, error: 'Provide exactly one of discord_id or user_id' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  if (hasDiscordId) {
    if (!SNOWFLAKE_RE.test(discordId as string)) {
      return NextResponse.json({ ok: false, error: 'Invalid discord_id' }, { status: 400 })
    }

    // Goes through a SECURITY DEFINER RPC (migration 013) rather than
    // querying auth.identities directly -- the service role does not have
    // SELECT on auth.identities via PostgREST by default, and adding it
    // there would expose more than this one lookup needs.
    const { data: rows, error: lookupError } = await admin.rpc(
      'lookup_profile_by_discord_id',
      { p_discord_id: discordId },
    )

    if (lookupError) {
      console.error('[relay-identity] Discord identity lookup failed:', lookupError)
      return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 })
    }

    const profile = Array.isArray(rows) ? rows[0] : null

    if (!profile) {
      return NextResponse.json({ ok: true, linked: false })
    }

    return NextResponse.json({
      ok: true,
      linked: true,
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
    })
  }

  // hasUserId branch
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(userId as string)) {
    return NextResponse.json({ ok: false, error: 'Invalid user_id' }, { status: 400 })
  }

  const { data: discordId2, error: lookupError } = await admin.rpc(
    'lookup_discord_id_by_user_id',
    { p_user_id: userId },
  )

  if (lookupError) {
    console.error('[relay-identity] User identity lookup failed:', lookupError)
    return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 })
  }

  if (!discordId2) {
    return NextResponse.json({ ok: true, linked: false })
  }

  return NextResponse.json({
    ok: true,
    linked: true,
    discord_id: discordId2,
  })
}
