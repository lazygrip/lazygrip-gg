import { NextRequest, NextResponse } from 'next/server'

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
    const { title, slug, className, specName, contentType, authorUsername, heroTalent } = await req.json()

    const color = CLASS_COLORS[className] ?? 0x1D9E75
    const specPart = specName ? `${specName} ` : ''
    const heroTalentPart = heroTalent ? ` — ${heroTalent}` : ''
    const contentLabel = CONTENT_TYPE_LABELS[contentType] ?? contentType
    const url = `https://lazygrip.net/sequences/${slug}`

    const embed = {
      title,
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

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], username: 'LazyGrip' }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[notify-discord] Discord rejected webhook:', res.status, text)
      return NextResponse.json({ ok: false, error: 'Discord rejected the webhook' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify-discord] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
