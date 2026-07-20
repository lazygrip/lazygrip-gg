import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

const SLUG_RE = /^[a-z0-9-]{1,120}$/

// Collapse all whitespace (newlines / tabs included) to single spaces and
// clamp length, so free-text embed fields cannot inject extra lines.
function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 500 })
  }

  // SEC1: require a server-verified Supabase session. The only caller is the
  // client-side notifyDiscord() on the post page, which runs in an
  // authenticated browser context -- a shared secret would be exposed in client
  // JS, so a verified session is the right gate.
  const supabase = createClient()
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

    // SEC1: allowlist / clamp everything that flows into the embed. className
    // and contentType are constrained to the known sets; free-text fields are
    // whitespace-collapsed and length-clamped.
    const classNameRaw = raw.className
    const contentTypeRaw = raw.contentType
    const title = cleanText(raw.title, 200) || 'Untitled sequence'
    const className = typeof classNameRaw === 'string' && classNameRaw in CLASS_COLORS ? classNameRaw : ''
    const specName = cleanText(raw.specName, 60)
    const heroTalent = cleanText(raw.heroTalent, 60)
    const contentType = typeof contentTypeRaw === 'string' && contentTypeRaw in CONTENT_TYPE_LABELS ? contentTypeRaw : ''
    const isUpdate = raw.isUpdate
    const isEdit = raw.isEdit
    // The "Posted by" name comes from the verified session, never the body.
    const metaUsername = user.user_metadata?.username
    const authorUsername: string =
      (typeof metaUsername === 'string' ? metaUsername : user.email) ?? 'unknown'

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