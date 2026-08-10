// The one place that builds the Discord embed for a LazyGrip sequence: the
// card posted into the sequence-sharing forum, carrying the class colour, the
// spec and hero-talent line, the content-type label, the sequence URL and the
// "Posted by <name>" footer.
//
// WHY THIS IS A MODULE AND NOT SIXTY LINES INSIDE notify-discord. It lived
// there until 2026-08-09, and it was fine there for exactly as long as
// notify-discord was the only thing that ever posted a sequence to Discord.
// That stopped being true with the backfill: of 58 published sequences only 18
// have a Discord thread, 40 do not, and 76 of the site's 88 comments sit on
// the 40 that were never bridged. Those 40 threads need the same embed the
// publish path produces, and the second caller that creates them is
// src/app/api/admin/sequence-thread/route.ts. Design doc section 14.6.
//
// The precedent is src/lib/public-name.ts, extracted the same day for the same
// reason: when a second caller arrives for a decision, the decision moves into
// a module rather than getting copied. A copied embed drifts the first time
// somebody changes a colour, a label or a footer in one file and not the
// other, and the two surfaces then disagree about what a sequence card looks
// like with nothing failing to say so.
//
// WHAT THIS BUILDER DELIBERATELY DOES NOT DECIDE: who the author is.
// authorName arrives as a finished string and is dropped into the footer
// as-is. That is not laziness, it is the whole point of the split. The two
// callers disagree about exactly this, and they are both right:
//
//   notify-discord      resolves the name from the AUTHENTICATED USER, because
//                       the person publishing is the person whose sequence it
//                       is, and the session is the trustworthy source.
//
//   sequence-thread     resolves the name from the SEQUENCE ROW's author_id,
//                       because there is no human logged in at all. An
//                       operator runs it, and the thread must be attributed to
//                       Slowdog, Kohtas, MFDOOM or Anubikk -- whoever actually
//                       wrote the sequence -- not to whoever ran the backfill.
//
// A builder that resolved the name itself would need to know which of those
// two callers it was serving, and the branch that answers that question is
// precisely the misattribution bug the backfill route exists to avoid. So the
// resolution stays with the caller, where the caller's own identity model
// lives, and this module only knows how to render a name it is handed.
//
// SLUG_RE and SNOWFLAKE_RE are exported from here too. They are not embed
// concerns, but both callers validate the same two shapes -- a sequence slug
// on the way in and a Discord snowflake on the way back out -- and two private
// copies of a validation regex is the same drift problem one size smaller.

export const SLUG_RE = /^[a-z0-9-]{1,120}$/
export const SNOWFLAKE_RE = /^\d{17,20}$/

// The site's content-type union is raid, mythic_plus, pvp and solo. leveling
// and open_world predate that union and are kept because they cost nothing and
// the current site cannot produce them. An unknown key resolves to no label at
// all and the description simply stops at the closing bold marker, so a stale
// table is invisible on the card BY DESIGN -- that is the conditional
// separator working, not a defect -- and buildSequenceEmbed announces it with
// a console.warn instead, where a developer sees it and a player does not.
// solo was added 2026-08-09, before the backfill, because
// bombaklats-lightsmiths-auto-mqe5fe9j is the only solo row in the published
// catalogue and had never had a thread.
const CONTENT_TYPE_LABELS: Record<string, string> = {
  mythic_plus: 'Mythic+',
  raid: 'Raid',
  leveling: 'Leveling',
  open_world: 'Open World',
  pvp: 'PvP',
  solo: 'Solo / Leveling',
}
const CLASS_COLORS: Record<string, number> = {
  'Death Knight': 0xC41E3A,
  'Demon Hunter': 0xA330C9,
  'Druid': 0xFF7C0A,
  'Evoker': 0x33937F,
  'Hunter': 0xAAD372,
  'Mage': 0x3FC7EB,
  'Monk': 0x00FF98,
  'Paladin': 0xF48CBA,
  'Priest': 0xFFFFFF,
  'Rogue': 0xFFF468,
  'Shaman': 0x0070DD,
  'Warlock': 0x8788EE,
  'Warrior': 0xC69B3A,
}

// Exported, unlike the two tables above, because normalising the TITLE is a
// caller's job rather than the builder's and both callers have to do it with
// the same function. The title is used in three places that must agree exactly
// -- the embed title, the Discord thread name, and the title in the relay
// payload sent to the bot -- so it is normalised once by the caller and the
// identical string is handed to all three. If the builder cleaned it
// internally instead, the embed would say one thing and the thread name
// another the moment a title arrived with a newline or a trailing space in it.
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

// className, specName, heroTalent and contentType are typed `unknown` on
// purpose. They reach the two callers from different places and neither place
// can promise a string: notify-discord takes them off a JSON request body it
// has not validated field by field, and sequence-thread takes them off a
// Supabase row whose columns are nullable. Rather than make each caller
// pre-clean four fields the same way, the builder accepts whatever they have
// and applies the one set of rules: a class name is only honoured if it names
// a real class, a content type is only honoured if it names a real content
// type, and the two free-text fields are whitespace-collapsed and capped.
//
// authorName, by contrast, is a plain required string. See the module header
// for why that one is not the builder's decision to make.
export interface SequenceEmbedInput {
  slug: string
  title: string
  className?: unknown
  specName?: unknown
  heroTalent?: unknown
  contentType?: unknown
  authorName: string
  isEdit?: boolean
  isUpdate?: boolean
}

// A caller-controlled string on its way into a log line, and notify-discord
// takes three of the four it can log straight off an unvalidated request body.
// JSON.stringify quotes it and escapes the newlines that would otherwise let a
// rejected value forge a second log line, and the cap stops a 120-character
// slug's worth of junk from swallowing the one it is on. Not exported: nothing
// outside this module has a reason to log these.
function logValue(value: string): string {
  return JSON.stringify(value).slice(0, 40)
}

// Returns the embed object exactly as Discord's webhook API wants it, ready to
// be dropped into an `embeds: [...]` array. Record<string, unknown> rather
// than a hand-written Discord embed type: this is a payload shape owned by
// Discord, and inventing a local interface for it would invite somebody to
// keep that interface in sync with an API we do not control.
//
// THE GLYPH PREFIXES ARE THE EDIT AND UPDATE SIGNAL, and they belong here
// rather than on the thread name. A pencil or a cycle sits on the MESSAGE, so
// it describes the one post it is attached to and scrolls away with it. The
// thread names used to carry "New: " / "Edit: " / "Updated: " prefixes for the
// same purpose and it did not work, because a thread name is permanent: all 18
// existing threads were renamed to their bare sequence title on 2026-08-09 and
// notify-discord stopped prefixing new ones the same day. Do not move this
// signal back onto the thread name.
//
// THE CONTENT-TYPE SEPARATOR IS CONDITIONAL for the same reason the hero-talent
// one is: a content type that is not a key of CONTENT_TYPE_LABELS is narrowed to
// the empty string above, so contentLabel is either a real label or nothing at
// all, and interpolating a hardcoded separator in front of it ends the
// description with a dangling em dash that advertises a missing value instead of
// hiding it. Building contentPart as separator-plus-label-or-empty keeps every
// known content type byte-identical and lets an unknown one stop cleanly at the
// closing bold marker. This table going stale against the site's content-type
// union is not hypothetical: it happened on 2026-08-09, when solo had been a
// content type on the site for some time and was missing here, and it will
// happen again the first time a sixth type is added without touching this file.
export function buildSequenceEmbed(input: SequenceEmbedInput): Record<string, unknown> {
  const className =
    typeof input.className === 'string' && Object.hasOwn(CLASS_COLORS, input.className)
      ? input.className
      : ''
  const specName = cleanText(input.specName, 60)
  const heroTalent = cleanText(input.heroTalent, 60)
  const contentType =
    typeof input.contentType === 'string' && Object.hasOwn(CONTENT_TYPE_LABELS, input.contentType)
      ? input.contentType
      : ''

  // WHERE A STALE TABLE ANNOUNCES ITSELF. Both narrowings above are silent on
  // the card by design, so the signal goes where a developer sees it and a
  // player does not -- the same place, and the same console.warn shape, both
  // routes already use when publicName suppresses a username. A value only
  // earns a line if it is a non-empty string that failed its membership test:
  // absent, null and empty are the ordinary shapes of an optional field, not
  // evidence that CONTENT_TYPE_LABELS or CLASS_COLORS has gone stale, and a
  // warning that fires for them is a warning nobody reads.
  if (typeof input.className === 'string' && input.className !== '' && className === '') {
    console.warn(`[discord-embed] Unknown className, using the default colour: ${logValue(input.className)}`)
  }
  if (typeof input.contentType === 'string' && input.contentType !== '' && contentType === '') {
    console.warn(`[discord-embed] Unknown contentType, rendering no label: ${logValue(input.contentType)}`)
  }

  // BELT TO THE Object.hasOwn BRACES ABOVE. Both tables are typed
  // Record<string, T>, which promises TypeScript a T for every key and cannot
  // promise it at runtime, so the two lookups are checked for the type they
  // are about to be used as rather than merely for being non-nullish. A colour
  // is used when it is a number and falls back to the site green otherwise; a
  // label is used when it is a string and is nothing otherwise. The label side
  // used to fall back to contentType itself, which could never fire -- the
  // value was already narrowed to a real key or the empty string one line
  // above -- so dropping it changes nothing that was reachable.
  const lookedUpColor = CLASS_COLORS[className]
  const color = typeof lookedUpColor === 'number' ? lookedUpColor : 0x1D9E75
  const specPart = specName ? `${specName} ` : ''
  const heroTalentPart = heroTalent ? ` — ${heroTalent}` : ''
  const lookedUpLabel = CONTENT_TYPE_LABELS[contentType]
  const contentLabel = typeof lookedUpLabel === 'string' ? lookedUpLabel : ''
  const contentPart = contentLabel ? ` — ${contentLabel}` : ''
  const url = `https://lazygrip.net/sequences/${input.slug}`

  let embedTitle = input.title
  if (input.isEdit) embedTitle = `📝 ${input.title}`
  else if (input.isUpdate) embedTitle = `🔄 ${input.title}`

  return {
    title: embedTitle,
    url,
    color,
    description: `**${specPart}${className}${heroTalentPart}**${contentPart}`,
    author: {
      name: 'LazyGrip.net',
      url: 'https://lazygrip.net',
    },
    footer: {
      text: `Posted by ${input.authorName} · lazygrip.net`,
    },
    timestamp: new Date().toISOString(),
  }
}
