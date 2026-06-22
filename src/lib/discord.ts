const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

export interface DiscordSequencePayload {
  title: string
  slug: string
  className: string
  specName: string | null
  contentType: string
  authorUsername: string
  heroTalent?: string | null
}

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

export async function notifyDiscord(payload: DiscordSequencePayload): Promise<void> {
  if (!WEBHOOK_URL) return

  try {
    const color = CLASS_COLORS[payload.className] ?? 0x1D9E75
    const specPart = payload.specName ? `${payload.specName} ` : ''
    const heroTalentPart = payload.heroTalent ? ` — ${payload.heroTalent}` : ''
    const contentLabel = CONTENT_TYPE_LABELS[payload.contentType] ?? payload.contentType
    const url = `https://lazygrip.net/sequences/${payload.slug}`

    const embed = {
      title: payload.title,
      url,
      color,
      description: `**${specPart}${payload.className}${heroTalentPart}** — ${contentLabel}`,
      footer: {
        text: `Posted by ${payload.authorUsername} · lazygrip.net`,
      },
      timestamp: new Date().toISOString(),
      // Source tag for loop prevention — Discord-to-forum leg must filter this out
      author: {
        name: 'LazyGrip.net',
        url: 'https://lazygrip.net',
      },
    }

    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
        username: 'LazyGrip',
        // Source tag carried in the payload for deduplication checks
        content: null,
      }),
    })
  } catch (err) {
    // Never let a Discord failure break a publish
    console.error('[discord] webhook failed:', err)
  }
}
