// src/app/api/cron/patch-reminder/route.ts
//
// Vercel Cron target. Checks how long it's been since current_patch was last
// updated in site_config, and if it's crossed the threshold, pings a dedicated
// Discord webhook as a reminder to check whether a new WoW patch has shipped.
//
// This does NOT know whether a WoW patch actually happened — there's no reliable
// structured source for that (Wowhead has no real API, Blizzard doesn't expose one
// either). It only knows how long current_patch has sat untouched, and nudges a
// human to go check. The actual patch-version update stays manual, via
// set_current_patch() or a future admin UI field.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretsMatch } from '@/lib/secret-compare'

const STALE_REMINDER_DAYS = 14

// The runtime is pinned to nodejs because the secret comparison below uses
// node:crypto, the same reason admin/sequence-thread and the three
// relay/discord-comment* routes pin it. It is the default for route handlers,
// but this route breaks rather than degrades if that ever changes.
export const runtime = 'nodejs'

export async function GET(request: Request) {
  // A ROUTE WHOSE SECRET IS UNSET MUST NOT FALL OPEN, and until 2026-09-17
  // this one did. The check was a single comparison against the template
  // `Bearer ${process.env.CRON_SECRET}`, which when CRON_SECRET is absent
  // evaluates to the literal string "Bearer undefined" -- so anyone sending
  // that exact header passed the guard and reached the Discord webhook below.
  //
  // Vercel does not auto-generate CRON_SECRET; it has to be set by hand, and it
  // is absent from .env.example, so "unset" is a reachable deployment state
  // rather than a theoretical one. Whether it is in fact set in the Vercel
  // project was never resolved, because the only request that distinguishes set
  // from unset is the exploit itself, and firing it would have posted a real
  // reminder into Discord (the staleness threshold has been crossed since
  // 2026-08-25). Failing closed removes the question instead of answering it.
  //
  // 503 and not 401: the caller is not unauthorized, the route is
  // unconfigured. Same shape and same status as
  // admin/sequence-thread:133-137 and relay/discord-comment:126-130, which
  // have always refused this way. This route was the only secret-gated one
  // that did not.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/patch-reminder] CRON_SECRET not configured, refusing all calls')
    return NextResponse.json({ error: 'route not configured' }, { status: 503 })
  }

  // Vercel Cron sends a bearer token matching CRON_SECRET — verify it so this
  // route can't be triggered by anyone who finds the URL.
  //
  // Constant-time, via the shared helper, for the reason set out in
  // src/lib/secret-compare.ts. The `!==` this replaced was the one remaining
  // secret gate in the app comparing with a short-circuiting operator.
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !secretsMatch(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const webhookUrl = process.env.DISCORD_PATCH_REMINDER_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('DISCORD_PATCH_REMINDER_WEBHOOK_URL is not set')
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 })
  }

  // Service role client — this route runs server-side only, never exposed to the browser.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: config, error } = await supabase
    .from('site_config')
    .select('current_patch, current_patch_updated_at')
    .single()

  if (error || !config) {
    console.error('Failed to fetch site_config:', error)
    return NextResponse.json({ error: 'failed to fetch config' }, { status: 500 })
  }

  // If it's never been set, that's worth a reminder immediately too.
  const lastUpdated = config.current_patch_updated_at ? new Date(config.current_patch_updated_at) : null
  const daysSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const shouldRemind = daysSinceUpdate === null || daysSinceUpdate >= STALE_REMINDER_DAYS

  if (!shouldRemind) {
    return NextResponse.json({ skipped: true, daysSinceUpdate })
  }

  const message = config.current_patch
    ? `**Patch check-in:** \`current_patch\` is still set to \`${config.current_patch}\`, last confirmed ${daysSinceUpdate} days ago. Still accurate? If a new WoW patch has shipped, update it via \`set_current_patch()\`.`
    : `**Patch check-in:** \`current_patch\` has never been set. Run \`set_current_patch()\` with the current WoW patch version.`

  const discordRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  })

  if (!discordRes.ok) {
    console.error('Discord webhook failed:', await discordRes.text())
    return NextResponse.json({ error: 'discord webhook failed' }, { status: 502 })
  }

  return NextResponse.json({ reminded: true, daysSinceUpdate })
}
