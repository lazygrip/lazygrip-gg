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

const STALE_REMINDER_DAYS = 14

export async function GET(request: Request) {
  // Vercel Cron sends a bearer token matching CRON_SECRET — verify it so this
  // route can't be triggered by anyone who finds the URL.
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
