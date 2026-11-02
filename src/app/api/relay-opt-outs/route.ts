import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { secretsMatch } from '@/lib/secret-compare'

// Not for browsers. Called server-to-server by the GRIP Discord bot (gripbot) once an hour
// to learn which creators have opted out of the Discord bridge, so its pingsync never pings
// one of them.
//
// WHY THIS ROUTE EXISTS INSTEAD OF AN ANON GRANT. Migration 034 closed anon reads of
// profiles.discord_bridge_opted_out on purpose, and pingsync's old read (the publishable key
// against /rest/v1/profiles?discord_bridge_opted_out=is.true) has answered 42501 since. The
// fix proposed in PR #125 was to grant anon SELECT on that column again, which would let anyone
// on the internet list the usernames of everyone who opted out. This route gives the bot the
// same list through the admin client instead, behind the same shared secret the bot already
// holds for /api/relay-identity, so the column stays closed to anon.
//
// The response is only ids, the same shape the bot already reads (select=id), so the change on
// its side is the URL and one header. A creator's username, display name and avatar are not
// returned: the bot only needs to know who not to ping, and it already has the ids.
//
// relay-identity's design note says its lookups "never enumerate". This route does return a
// list, on purpose, because the list is the whole job; every other constraint there still
// holds (shared secret, constant-time compare, rate limited, never reachable from client code).

export const runtime = 'nodejs'

function getValidSecrets(): string[] {
  const secrets = [process.env.DISCORD_RELAY_SECRET]
  return secrets.filter((s): s is string => typeof s === 'string' && s.length > 0)
}

function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get('x-relay-secret')
  if (!provided) return false
  return getValidSecrets().some((valid) => secretsMatch(provided, valid))
}

// One caller, hourly. The limit is far above that and exists so a leaked secret cannot be used
// to hammer the database. In-memory, reset on cold start, same trade-off relay-identity records.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 12
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

// PostgREST caps a single response (1000 rows by default) and says nothing when it truncates.
// A silently short list here means a pinged creator who opted out, which is the failure this
// whole list exists to prevent, so the read pages until a page comes back short.
const PAGE_SIZE = 1000
const MAX_PAGES = 50

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    // Same response whether the secret is missing, malformed or wrong, and whether the secret
    // is unset on the server, so the answer cannot be used to probe.
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (isRateLimited()) {
    return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 })
  }

  const admin = createAdminClient()
  const ids: string[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await admin
      .from('profiles')
      .select('id')
      .eq('discord_bridge_opted_out', true)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[relay-opt-outs] opt-out read failed:', error)
      return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 })
    }

    const rows = (data ?? []) as { id: string }[]
    for (const row of rows) ids.push(row.id)
    if (rows.length < PAGE_SIZE) {
      return NextResponse.json({ ok: true, ids }, { headers: { 'Cache-Control': 'no-store' } })
    }
  }

  // Fifty full pages is fifty thousand opted-out creators. Failing is safer than a list the
  // caller would treat as complete when it is not.
  console.error('[relay-opt-outs] opt-out list exceeded the page limit, refusing to return a partial list')
  return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 })
}
