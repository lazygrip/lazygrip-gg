import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CONTENT_TYPE_LABELS: Record<string, string> = {
  mythic_plus: 'Mythic+',
  raid: 'Raid',
  leveling: 'Leveling',
  open_world: 'Open World',
  pvp: 'PvP',
}
const CLASS_COLORS: Record<string, number> = {
  'Death Knight': 0xC41E3A,
  'Demon Hunter': 0xA330C9,
  'Druid':        0xFF7C0A,
  'Evoker':       0x33937F,
  'Hunter':       0xAAD372,
  'Mage':         0x3FC7EB,
  'Monk':         0x00FF98,
  'Paladin':      0xF48CBA,
  'Priest':       0xFFFFFF,
  'Rogue':        0xFFF468,
  'Shaman':       0x0070DD,
  'Warlock':      0x8788EE,
  'Warrior':      0xC69B3A,
}

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 500 })
  }

  try {
    const { title, slug, className, specName, contentType, authorUsername, heroTalent, isUpdate, isEdit } = await req.json()

    if (!slug) {
      return NextResponse.json({ ok: false, error: 'Missing slug' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Look up any existing Discord thread for this sequence.
    const { data: sequenceRow, error: lookupError } = await admin
      .from('sequences')
      .select('discord_thread_id')
      .eq('slug', slug)
      .single()

    if (lookupError) {
      console.error('[notify-discord] Failed to look up sequence:', lookupError)
      // Don't hard-fail the notification just because the lookup failed --
      // fall back to posting a new thread rather than losing the notification entirely.
    }

    const existingThreadId = sequenceRow?.discord_thread_id ?? null

    const color = CLASS_COLORS[className] ?? 0x1D9E75
    const specPart = specName ? `${specName} ` : ''
    const heroTalentPart = heroTalent ? ` — ${heroTalent}` : ''
    const contentLabel = CONTENT_TYPE_LABELS[contentType] ?? contentType
    const url = `https://lazygrip.net/sequences/${slug}`

    let embedTitle = title
    if (isEdit) embedTitle = `📝 ${title}`
    else if (isUpdate) embedTitle = `🔄 ${title}`

    const embed = {
      title: embedTitle,
      url,
      color,
      description: `**${specPart}${className}${heroTalentPart}** — ${contentLabel}`,
      author: {
        name: 'LazyGrip.net',
        url: 'https://lazygrip.net',
      },
      footer: {
        text: `Posted by ${authorUsername} · lazygrip.net`,
      },
      timestamp: new Date().toISOString(),
    }

    // Build the target URL: post into the existing thread if we have one,
    // otherwise post fresh (which creates a new thread, named via thread_name).
    const postUrl = existingThreadId
      ? `${webhookUrl}?thread_id=${existingThreadId}&wait=true`
      : `${webhookUrl}?wait=true`

    const body: Record<string, unknown> = {
      embeds: [embed],
      username: 'LazyGrip',
    }

    if (!existingThreadId) {
      const threadPrefix = isEdit ? 'Edit: ' : isUpdate ? 'Updated: ' : 'New: '
      body.thread_name = `${threadPrefix}${title}`
    }

    const res = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[notify-discord] Discord rejected webhook:', res.status, text)
      return NextResponse.json({ ok: false, error: 'Discord rejected the webhook' }, { status: 502 })
    }

    const responseData = await res.json()

    // If this was a brand-new thread, capture its ID so future edits reuse it.
    const newThreadId = !existingThreadId ? (responseData?.channel_id ?? responseData?.id ?? null) : null

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

    if (updateError) {
      console.error('[notify-discord] Failed to write back thread id:', updateError)
      // Notification already succeeded from Discord's perspective -- don't fail the request over this.
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify-discord] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}