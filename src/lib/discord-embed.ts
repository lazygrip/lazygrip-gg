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
//
// WHAT ELSE THIS MODULE OWNS AS OF 2026-08-11, AND WHY IT IS ALL ONE FILE. The
// card grew from seven things to sixteen: an embed FIELD block (class, spec,
// role, hero talent, content, EMS version, WoW patch and build, created and
// updated), a fenced Talent Build field, a forum TAG pair, and a second message
// carrying the import string. The last two are not embed shapes at all, and
// they live here for the reason the two regexes do -- both callers need the
// identical decision, and the alternative to one module is two copies that
// drift.
//
// The forcing function is that A WEBHOOK-CREATED MESSAGE CANNOT BE EDITED WITH
// A BOT TOKEN. Forty published sequences get their first thread in a single
// backfill run, and whatever those forty cards say is what they say for good.
// A card that ships wrong stays wrong until something else is built to repair
// it, so the cost of the two callers disagreeing here is not a cosmetic diff --
// it is forty permanent messages.

import { WOW_CLASSES } from '@/lib/wow-data'

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

// ROLE IS DERIVED FROM THE SPEC ID, NEVER FROM THE SPEC NAME. Spec names are
// not unique across classes and never have been. Of the 40 specs in
// WOW_CLASSES, 8 share a name with a spec of another class: Frost is Mage 64
// and Death Knight 251, Restoration is Druid 105 and Shaman 264, Holy is
// Paladin 65 and Priest 257, Protection is Paladin 66 and Warrior 73. A
// name-keyed map cannot hold both halves of any of those pairs; it silently
// keeps whichever was written last.
//
// It is worth being exact about how much that costs TODAY, because the honest
// answer is nothing: all four colliding pairs happen to agree on role, so a
// name lookup would currently be right by luck for every one of the 61
// published rows. Luck is the problem. The next collision Blizzard ships does
// not have to agree -- Devourer and Annihilator arrived in 12.0 and the table
// has moved before -- and the failure mode when it does not is a card
// confidently labelling a healer as dps with nothing anywhere reporting it. An
// id is unique by construction and costs the same lookup.
//
// The map is built ONCE at module scope, not per call. WOW_CLASSES is the
// site's own spec table and already carries a role for every spec, so this is
// a projection of data the site maintains anyway rather than a second copy
// with its own staleness: a spec added there arrives here for free.
const ROLE_LABELS: Record<'tank' | 'healer' | 'dps', string> = {
  tank: 'Tank',
  healer: 'Healer',
  dps: 'DPS',
}

const SPEC_ROLE_BY_ID = new Map<number, string>(
  WOW_CLASSES.flatMap((wowClass) =>
    wowClass.specs.map((spec) => [spec.id, ROLE_LABELS[spec.role]] as [number, string]),
  ),
)

// Forum tag ids read from the LIVE sequence-sharing forum, channel
// 1518689613496058016, on 2026-08-11. A forum tag is a per-channel object with
// its own snowflake, so these ids mean nothing in any other channel, and there
// is no name-resolution step at post time either: applied_tags takes ids.
//
// THE FORUM IS AT DISCORD'S HARD CAP OF 20 TAGS. All twenty are listed below,
// so a twenty-first cannot be created -- an addition requires DELETING an
// existing tag first, and deleting a tag STRIPS IT FROM EVERY THREAD THAT
// CARRIES IT. There is no undo and no migration; the threads simply lose it.
// Adding a row here is therefore a decision about the whole forum's history,
// not a line of code.
const FORUM_TAG_IDS: Record<string, string> = {
  'Warrior': '1535812989566058496',
  'Hunter': '1535813011762061322',
  'Priest': '1535813033476100158',
  'Mage': '1535813051155226624',
  'Monk': '1535813067009425428',
  'Demon Hunter': '1535813085137211452',
  'Evoker': '1535813101927272480',
  'Paladin': '1535813121124602015',
  'Rogue': '1535813142133608499',
  'Shaman': '1535813156285452368',
  'Warlock': '1535813176728359112',
  'Druid': '1535813193765752862',
  'Death Knight': '1535813214674092032',
  'Leveling': '1535813233145942047',
  'Open World': '1535813247205380127',
  'Feat. Request / Bug': '1535813262757593088',
  'Raid': '1535813336485339227',
  'M+': '1535813349353459813',
  'LazyGRIP': '1535813445910401024',
  'PVP': '1535813492156665866',
}

// The site's content_type keys mapped to a forum TAG NAME, which is then
// resolved to an id through FORUM_TAG_IDS above. Two keys deliberately share
// one tag: solo and leveling both land on Leveling, because the forum has no
// Solo tag and there are only twenty slots to have one in.
//
// THE CLASS SIDE NEEDS NO SECOND TABLE. All 13 class tag names equal the
// site's class_name byte for byte, two-word classes included, so class_name is
// looked up in FORUM_TAG_IDS directly. That is a checkable claim rather than a
// hope: the 13 class keys above are the same 13 strings CLASS_COLORS is keyed
// by, and a mismatch in either direction produces the console.warn in
// resolveAppliedTags rather than a wrongly tagged thread.
const CONTENT_TYPE_TAGS: Record<string, string> = {
  mythic_plus: 'M+',
  raid: 'Raid',
  solo: 'Leveling',
  pvp: 'PVP',
  leveling: 'Leveling',
  open_world: 'Open World',
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

// Discord's hard cap on a THREAD NAME. It is SMALLER than the 200 both callers
// hand cleanText for the embed title, and neither number is a typo for the
// other: they are two different limits on two different surfaces of the same
// post. An embed title of 150 characters renders fine. A thread_name of 150 is
// a 400 that fails the WHOLE webhook post, which on the publish path means the
// card never lands, the thread is never created, and the publish itself fails
// -- for a title that was merely long.
//
// Nothing is currently over it: the longest live title measured 2026-08-13 was
// 83 characters, so applying this changes no existing thread name. It is here
// so that the first 101-character title costs a truncation instead of a
// publish.
export const THREAD_NAME_MAX = 100

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
// The seven fields added on 2026-08-11 are typed `unknown` for exactly the
// reason the original four are, and the reason applies harder to them. specId
// is a nullable Supabase integer column that is null on 1 of the 61 published
// rows. talentString, emsVersion, wowPatch and wowBuild each have TWO possible
// origins that disagree -- a database column the site's post form wrote, and
// the export envelope the addon itself produced -- and resolving between them
// is the caller's job, not the builder's, because only the caller can decode
// the export. createdAt and updatedAt are ISO strings off timestamptz columns
// and are the same shape of promise nothing can make: `string | null` at best,
// and whatever JSON happened to arrive at worst.
export interface SequenceEmbedInput {
  slug: string
  title: string
  className?: unknown
  specName?: unknown
  heroTalent?: unknown
  contentType?: unknown
  specId?: unknown
  talentString?: unknown
  emsVersion?: unknown
  wowPatch?: unknown
  wowBuild?: unknown
  createdAt?: unknown
  updatedAt?: unknown
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

// A spec id that is null, absent or not in WOW_CLASSES yields the EMPTY
// STRING, and buildSequenceEmbed then omits the Role field entirely rather
// than emitting "Unknown". spec_id is null on exactly 1 of the 61 published
// rows, and a card that announces it does not know the role is strictly worse
// than a card that does not mention the role: the first reads as a data error
// to a player, the second reads as a card.
//
// A numeric string is accepted alongside a number because the two callers
// disagree about what they hold. sequence-thread reads spec_id off a Supabase
// integer column and gets a number; notify-discord's row read gets the same,
// but nothing in this module's contract promises either, and Number() on a
// value that is neither leaves NaN, which fails the integer test below.
function roleLabel(specId: unknown): string {
  const id =
    typeof specId === 'number' ? specId : typeof specId === 'string' ? Number(specId) : Number.NaN
  if (!Number.isInteger(id)) return ''
  return SPEC_ROLE_BY_ID.get(id) ?? ''
}

// Date.parse rather than `new Date(value)`, because the latter answers with an
// Invalid Date object that stringifies to "Invalid Date" and would happily be
// interpolated into a card. Anything unparseable yields the empty string and
// the caller omits the field.
function parsedMs(value: unknown): number | null {
  if (typeof value !== 'string' || value === '') return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

// Discord renders <t:SECONDS:R> in each reader's OWN timezone and language --
// the same message reads "3 months ago" in Stockholm and in Sydney without
// either reader working out what a UTC date string means where they are. That
// matters most on the forty backfilled cards, which are months old the moment
// they are posted: a literal date on those would be the single most confusing
// thing on the card.
function relativeTimestamp(value: unknown): string {
  const ms = parsedMs(value)
  if (ms === null) return ''
  return `<t:${Math.floor(ms / 1000)}:R>`
}

// Normalised ISO for the embed's own `timestamp` property, which is a
// different thing from the two relative fields above: Discord renders it in
// the footer line rather than in the body, and it wants an ISO 8601 string
// rather than the <t:...> markup.
function isoTimestamp(value: unknown): string {
  const ms = parsedMs(value)
  if (ms === null) return ''
  return new Date(ms).toISOString()
}

// The forum tags to hand Discord as applied_tags on a thread-creating post.
// At most two: one class, one content type, in that order. Either side that
// does not resolve is simply left out, so a thread can carry two tags, one, or
// none, and never a wrong one.
//
// THE WARN SHAPE IS DELIBERATELY THE SAME as the two narrowings in
// buildSequenceEmbed, and for the same reason: a stale table has to announce
// itself somewhere a developer sees it and a player does not. A value only
// earns a line if it is a NON-EMPTY string that failed its lookup -- absent,
// null and empty are the ordinary shapes of an optional column, not evidence
// that FORUM_TAG_IDS or CONTENT_TYPE_TAGS has gone stale, and a warning that
// fires for them is a warning nobody reads.
//
// Note what this cannot do: a tag id that is valid-looking but wrong, or one
// that has been deleted from the forum since 2026-08-11, is invisible here and
// makes Discord reject the WHOLE post with a 400. Both callers treat that as a
// webhook failure, which is the right outcome -- an untagged thread is
// recoverable by hand, a thread created under a mistaken payload is not.
export function resolveAppliedTags(className: unknown, contentType: unknown): string[] {
  const tags: string[] = []

  if (typeof className === 'string' && className !== '') {
    const classTagId = FORUM_TAG_IDS[className]
    if (typeof classTagId === 'string') {
      tags.push(classTagId)
    } else {
      console.warn(`[discord-embed] No forum tag for className, posting without a class tag: ${logValue(className)}`)
    }
  }

  if (typeof contentType === 'string' && contentType !== '') {
    const tagName = CONTENT_TYPE_TAGS[contentType]
    const contentTagId = typeof tagName === 'string' ? FORUM_TAG_IDS[tagName] : undefined
    if (typeof contentTagId === 'string') {
      tags.push(contentTagId)
    } else {
      console.warn(`[discord-embed] No forum tag for contentType, posting without a content tag: ${logValue(contentType)}`)
    }
  }

  return tags
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

  // THE DESCRIPTION LINE STAYS EXACTLY AS IT WAS, fields or no fields. It is
  // the one-line summary -- the thing a reader takes in without stopping --
  // and the field block below is the detail they read only if the summary
  // interested them. Folding the description into the fields would leave the
  // card with no line that reads as a sentence, and it would change how all 18
  // existing threads' first messages look next to the 40 new ones.

  // Every entry is inline, so Discord lays them out three to a row, and every
  // entry is OMITTED WHEN EMPTY rather than emitted with a placeholder. There
  // is no "Unknown", no "N/A" and no em dash standing in for a missing value:
  // 61 published rows have wildly uneven coverage -- 30 carry an export
  // envelope and 31 do not, 1 has no spec_id at all -- and a card that lists
  // what it does not know about a sequence reads as a broken record, while a
  // card that simply lists what it knows reads as a card. The empty case is
  // real and has to look deliberate.
  const fields: Array<Record<string, unknown>> = []
  const addField = (name: string, value: string) => {
    if (value) fields.push({ name, value, inline: true })
  }

  // Build context. emsVersion is the addon version that produced the export;
  // it is capped short because a version string that is not a version string
  // is junk, and 32 characters is already four times the longest real one.
  const emsVersion = cleanText(input.emsVersion, 32)
  const wowPatch = cleanText(input.wowPatch, 20)
  const wowBuild = cleanText(input.wowBuild, 20)

  // A build with no patch produces NOTHING, not a bare "(build 68974)". The
  // field is named WoW Patch, so a value that contains no patch does not
  // belong under it, and the build number alone tells a player nothing they
  // can act on.
  const patchValue = wowPatch ? (wowBuild ? `${wowPatch} (build ${wowBuild})` : wowPatch) : ''

  // Both timestamps are compared as RENDERED MARKUP rather than as raw ISO
  // strings, which is the same comparison at one-second granularity. That is
  // the comparison that matters: two values that differ by 300 milliseconds
  // render as the identical "3 months ago" on the card, and printing that
  // string twice under two different labels is noise, not information.
  // updated_at is set to created_at on insert for most rows, so this omission
  // fires constantly and is the difference between nine fields and ten.
  const createdField = relativeTimestamp(input.createdAt)
  const updatedField = relativeTimestamp(input.updatedAt)

  addField('Class', className)
  addField('Spec', specName)
  addField('Role', roleLabel(input.specId))
  addField('Hero Talent', heroTalent)
  addField('Content', contentLabel)
  addField('EMS Version', emsVersion)
  addField('WoW Patch', patchValue)
  addField('Created', createdField)
  addField('Updated', updatedField === createdField ? '' : updatedField)

  // THE ONLY NON-INLINE FIELD, and the only one that is fenced. A talent
  // string is copied, not read, so it gets a full-width row and a code block
  // that Discord renders with a copy button, so a player can take it straight
  // out of the thread instead of leaving for the site to fetch it.
  //
  // The 1000 is a GUARD AGAINST DISCORD'S 1024-CHARACTER FIELD CAP, not a
  // claim about the data. Measured on 2026-08-11, talent strings run 97 to 124
  // characters, so the guard has roughly eight times the headroom it needs and
  // exists only so that a future format change overflows into a missing field
  // rather than into a rejected post. The fence adds 8 characters of its own,
  // which is why the threshold is 1000 rather than 1024.
  //
  // No fence-escaping is done and none is needed: a Blizzard talent loadout
  // string is base64 over A-Z, a-z, 0-9, + and /, none of which can close a
  // code fence. The value is trimmed and otherwise passed through byte for
  // byte, because an import string that is not byte-exact is not an import
  // string.
  const talentString = typeof input.talentString === 'string' ? input.talentString.trim() : ''
  if (talentString && talentString.length <= 1000) {
    fields.push({
      name: 'Talent Build',
      value: '```\n' + talentString + '\n```',
      inline: false,
    })
  }

  // THE SEQUENCE'S OWN TIME, NOT THE POST'S. This line read
  // `new Date().toISOString()` unconditionally until 2026-08-11, which is
  // correct for a publish happening right now and wrong for every one of the
  // 40 backfilled threads: a sequence published in May would have carried
  // today's date in the footer of its very first card. A webhook-created
  // message cannot be edited with a bot token, so that date would then have
  // been permanent. updatedAt first, createdAt next, and now() only when the
  // caller supplied neither -- which is the publish path's ordinary case and
  // the only reason the old expression survives at all.
  const embedTimestamp =
    isoTimestamp(input.updatedAt) || isoTimestamp(input.createdAt) || new Date().toISOString()

  const embed: Record<string, unknown> = {
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
    timestamp: embedTimestamp,
  }

  // The key is omitted entirely rather than sent as []. Discord accepts an
  // empty array and renders nothing, so this changes no card; it keeps the
  // payload honest, the same way applied_tags is omitted rather than sent
  // empty at both call sites.
  if (fields.length > 0) {
    embed.fields = fields
  }

  return embed
}

// ===========================================================================
// THE IMPORT STRING, WHICH IS A SECOND MESSAGE AND NOT A FIELD
// ===========================================================================
//
// It cannot be a field, and the numbers say so rather than a preference.
// Measured across all 61 published rows on 2026-08-11: grip_string runs 595 to
// 3942 characters with a median of 1450, and 56 of the 61 are longer than
// Discord's 1024-character embed FIELD cap. A field would therefore fail for
// 92 percent of the catalogue, and truncating an import string is worse than
// omitting it -- a truncated one looks copyable and then fails on paste.
//
// So it goes into a second message posted into the thread, which is capped at
// 2000 characters instead of 1024, and that is why there are two shapes below
// rather than one.
//
// RE-MEASURED against 62 published rows with the final 44-character header
// below: 8 of the 62 do not fit inline and take the attachment, and exactly 1
// of the 40 backfill targets does. The second-largest backfill target body is
// 1870 characters against a 1947 inline ceiling, so there are 77 characters of
// headroom in the header wording -- lengthen IMPORT_HEADER by more than that
// and a second backfill target silently becomes an attachment.
const DISCORD_MESSAGE_LIMIT = 2000
// PLAYER-FACING TEXT, so it obeys the two rules the rest of this module's
// strings do and its comments do not: no em dash and no double hyphen. The
// previous wording used a double hyphen as a sentence separator, which reads
// as a typo in a Discord message. And the name matches the site: the sequence
// page's own h2 calls this thing a GRIP import string, so a player who has
// seen one surface has seen the other.
const IMPORT_HEADER = '**GRIP import string.** Paste into GRIP-EMS.'
const IMPORT_HEADER_ATTACHED =
  '**GRIP import string.** Attached: too long for one message.'

// A content shape is sent as ordinary JSON; a file shape is sent as multipart.
// Both carry `content`, so the caller never branches on which header to use --
// only on how to put the body on the wire.
export type ImportMessage =
  | { kind: 'content'; content: string }
  | { kind: 'file'; content: string; filename: string; body: string }

// Returns null when there is nothing to post, which is not an error: a row
// with no grip_string simply gets a card and no second message.
//
// SPLITTING THE FENCE ACROSS TWO MESSAGES IS DELIBERATELY NOT AN OPTION, and
// it is the obvious third shape, so here is why it is absent. An import string
// has to be copied BYTE EXACT to work at all. A reader handed two code blocks
// has to select both, concatenate them, and not pick up the newline Discord
// puts between them -- and the failure mode when they get it wrong is an
// import that errors with no clue that the cause was the copy rather than the
// sequence. A file is one click and pastes whole.
//
// The string is trimmed and otherwise untouched. Trimming is safe -- no import
// format carries meaning in leading or trailing whitespace, and the site's own
// importer trims -- and it is what stops a stored trailing newline from
// pushing a 1998-character message over the cap into a needless attachment.
export function buildImportMessage(gripString: unknown, slug: string): ImportMessage | null {
  if (typeof gripString !== 'string') return null
  const trimmed = gripString.trim()
  if (!trimmed) return null

  // Assembled and then MEASURED, rather than compared against a precomputed
  // budget. The header is 44 characters, and with the two newlines and the two
  // fence markers the overhead is 53, which leaves 1947 as the largest body
  // that still fits inline.
  //
  // NEITHER NUMBER IS A CONSTANT AND NEITHER SHOULD BECOME ONE. They are a
  // reader's note about the shape below, not an input to it -- the code
  // measures the assembled string, which is why rewording the header a moment
  // ago moved the overhead from 49 to 53 and broke nothing. A budget constant
  // is exactly the thing nobody updates when the wording changes next.
  const inline = `${IMPORT_HEADER}\n\`\`\`\n${trimmed}\n\`\`\``
  if (inline.length <= DISCORD_MESSAGE_LIMIT) {
    return { kind: 'content', content: inline }
  }

  // The slug, which both callers have already validated against SLUG_RE, so it
  // is 1 to 120 characters of lowercase, digits and hyphens -- a filename that
  // needs no escaping and identifies the sequence in a downloads folder.
  return {
    kind: 'file',
    content: IMPORT_HEADER_ATTACHED,
    filename: `${slug}.txt`,
    body: trimmed,
  }
}

// Posts the import message into an existing thread. Shared rather than copied
// for the reason in the module header: both routes need it, and the multipart
// assembly below is exactly the kind of fiddly shape that gets fixed in one
// copy and not the other.
//
// THROWS on a transport failure or a non-2xx, and both callers catch. That is
// the contract the callers need: by the time this runs the thread exists and
// the site has already saved the link, so a failure here must degrade the
// message and never the route.
export async function postImportMessage(
  webhookUrl: string,
  threadId: string,
  message: ImportMessage,
): Promise<void> {
  // Discord's Execute Webhook docs say that when wait is false the endpoint
  // answers 204 before the message is persisted, and that a message which is
  // not saved does not return an error. A 400 for a malformed body still
  // surfaces either way, so the multipart shape is checked regardless. What
  // wait=true adds is that a message dropped after acceptance becomes a
  // non-2xx, which is the only way the try/catch around this call and the
  // warning it raises can ever fire for that case. The created message object
  // is discarded; it is the acknowledgement that is wanted, not the payload.
  const url = `${webhookUrl}?thread_id=${threadId}&wait=true`

  let res: Response
  if (message.kind === 'content') {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message.content, username: 'LazyGrip' }),
    })
  } else {
    // Discord's documented form for a webhook attachment: a multipart body
    // whose payload_json part is the message it would otherwise have been sent
    // as JSON, and whose files[N] parts are the files.
    //
    // THE Content-Type HEADER IS DELIBERATELY NOT SET. fetch generates it from
    // the FormData, including the multipart boundary, and a hand-written
    // 'multipart/form-data' header omits that boundary and produces a body
    // Discord answers 400 to.
    const form = new FormData()
    form.append('payload_json', JSON.stringify({ content: message.content, username: 'LazyGrip' }))
    form.append('files[0]', new Blob([message.body], { type: 'text/plain' }), message.filename)
    res = await fetch(url, { method: 'POST', body: form })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Discord rejected the import-string message: ${res.status} ${text.slice(0, 200)}`)
  }
}

// ===========================================================================
// RENAMING AND RETAGGING A THREAD THAT ALREADY EXISTS
// ===========================================================================
//
// thread_name and applied_tags are honoured ONLY on the webhook post that
// CREATES a thread. Discord silently ignores both when the webhook targets an
// existing thread -- notify-discord says exactly that at its own thread_name
// assignment. So an author who renames a sequence, or changes its class or its
// content type, leaves the forum thread permanently wrong and nothing anywhere
// reports the divergence.
//
// MEASURED LIVE 2026-08-13: 65 published sequences, all 65 linked to a thread,
// and 1 name had already drifted -- thread 1536904149231472641 read "12.0.7
// MFDOOM - Protection Warrior" against a row reading "12.1.0 MFDOOM -
// Protection Warrior". It was renamed by hand the same day. Tag drift was 0, so
// the tag half is the same bug with no live instance yet.
//
// THIS NEEDS A BOT TOKEN AND THERE IS NO WORKAROUND. A webhook cannot rename
// the thread it created. Only PATCH /channels/{id} carrying a bot Authorization
// header can, and that is a different credential from DISCORD_WEBHOOK_URL.
//
// THIS IS NOT THE ONLY IMPLEMENTATION, AND THAT IS DELIBERATE. Jesper's bot
// runs the identical comparison as an hourly reconcile over the whole published
// catalogue. This one is the FAST PATH: it corrects a rename within seconds of
// the publish that caused it. The sweep is the safety net that catches whatever
// this drops. Do not add a retry ladder here on the grounds that a failure goes
// unhandled -- it is handled, an hour later, somewhere else.
//
// NO RETRY, AND THE RATE LIMIT IS WHY. PATCH /channels/{id} that changes a name
// or a topic is limited to 2 requests per 10 MINUTES PER CHANNEL, undocumented
// but long established, and a 429 on it can carry a retry_after approaching 600
// seconds. Retrying inside a serverless invocation would spend the function's
// whole duration budget waiting on work the reconcile does for free.
//
// THE TOKEN IS NEVER LOGGED and never reaches an exception message. Every log
// line below carries a status, a thread id or a caller-supplied string put
// through logValue; none of them carries a header.
export async function syncThreadMetadata(
  threadId: string,
  name: string,
  appliedTags: string[],
): Promise<'skipped' | 'match' | 'synced' | 'failed'> {
  // WRAPPED WHOLE so this can never throw at its caller. It is scheduled with
  // after() on a route whose actual job is publishing a sequence, and a
  // cosmetic metadata failure must not be able to reach that route's error
  // path however it fails -- a DNS error, a body that is not JSON, anything.
  try {
    const token = process.env.DISCORD_BOT_TOKEN
    if (!token) {
      // A CONFIGURATION FACT, NOT AN ERROR, which is why this is console.info
      // and not warn. This is the state the change merges in and the state
      // production stays in until the variable is set in Vercel, so anything
      // louder would train a reader to scroll past the line that will one day
      // actually mean something.
      console.info(
        '[discord-embed] DISCORD_BOT_TOKEN is not set, skipping the thread metadata sync',
      )
      return 'skipped'
    }

    // The same validation both routes already apply to a thread id before
    // trusting it. Interpolating an unvalidated value into an API path is how
    // a stored null or a stray slug turns into a request against some other
    // channel, and there is no version of that worth attempting.
    if (!SNOWFLAKE_RE.test(threadId)) {
      console.error(
        `[discord-embed] Refusing to sync a thread id that is not a snowflake: ${logValue(threadId)}`,
      )
      return 'failed'
    }

    const url = `https://discord.com/api/v10/channels/${threadId}`
    const headers = {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    }

    // READ BEFORE WRITE, which is the whole reason this is affordable. The
    // GET is an ordinary channel-read bucket; the PATCH is the 2-per-10-minutes
    // one. Comparing first is what keeps an unchanged sequence at zero writes
    // against the expensive bucket, and an unchanged sequence is nearly every
    // publish.
    const current = await fetch(url, { headers })
    if (!current.ok) {
      console.error(
        `[discord-embed] Could not read thread ${threadId} for a metadata sync: ${current.status}`,
      )
      return 'failed'
    }

    const channel = (await current.json()) as { name?: unknown; applied_tags?: unknown }
    const currentName = typeof channel.name === 'string' ? channel.name : ''
    const currentTags = Array.isArray(channel.applied_tags)
      ? channel.applied_tags.map((tag) => String(tag))
      : []

    // THE TAGS ARE COMPARED AS SETS. Discord promises nothing about the ORDER
    // of applied_tags, and there is no reason it should come back in the order
    // resolveAppliedTags builds -- class first, then content type. An array
    // comparison would therefore read "different" for a thread that is already
    // correctly tagged, and would fire a PATCH on every single publish: exactly
    // the traffic the per-channel bucket punishes, in exchange for no change at
    // all.
    const desired = new Set(appliedTags)
    const existing = new Set(currentTags)
    const tagsMatch =
      desired.size === existing.size && Array.from(desired).every((tag) => existing.has(tag))

    // ONLY THE FIELDS THAT DIFFER. A PATCH that re-sends the name it already
    // has still consumes the rename bucket, so sending nothing is not the same
    // as sending the same thing.
    const patch: Record<string, unknown> = {}
    if (currentName !== name) patch.name = name
    if (!tagsMatch) patch.applied_tags = appliedTags

    if (Object.keys(patch).length === 0) return 'match'

    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      // A 429 lands here like any other refusal, and is deliberately not slept
      // off or retried. See the header: the hourly reconcile will make the
      // identical comparison and the identical PATCH.
      console.error(
        `[discord-embed] Thread ${threadId} metadata PATCH failed: ${res.status}`,
      )
      return 'failed'
    }

    return 'synced'
  } catch (err) {
    console.error('[discord-embed] Thread metadata sync failed unexpectedly:', err)
    return 'failed'
  }
}
