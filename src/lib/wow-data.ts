import { WowClass } from '@/types'

export const WOW_CLASSES: WowClass[] = [
  {
    id: 6, name: 'Death Knight', slug: 'death-knight', color: '#C41E3A',
    specs: [
      { id: 250, name: 'Blood', role: 'tank', heroTalents: ['Deathbringer', 'San\'layn'] },
      { id: 251, name: 'Frost', role: 'dps', heroTalents: ['Deathbringer', 'Rider of the Apocalypse'] },
      { id: 252, name: 'Unholy', role: 'dps', heroTalents: ['San\'layn', 'Rider of the Apocalypse'] },
    ]
  },
  {
    id: 12, name: 'Demon Hunter', slug: 'demon-hunter', color: '#A330C9',
    specs: [
      { id: 577, name: 'Havoc', role: 'dps', heroTalents: ['Fel-Scarred', 'Aldrachi Reaver'] },
      { id: 581, name: 'Vengeance', role: 'tank', heroTalents: ['Aldrachi Reaver', 'Annihilator'] },
      { id: 1480, name: 'Devourer', role: 'dps', heroTalents: ['Annihilator', 'Void-Scarred'] },
    ]
  },
  {
    id: 11, name: 'Druid', slug: 'druid', color: '#FF7C0A',
    specs: [
      { id: 102, name: 'Balance', role: 'dps', heroTalents: ['Elune\'s Chosen', 'Keeper of the Grove'] },
      { id: 103, name: 'Feral', role: 'dps', heroTalents: ['Wildstalker', 'Druid of the Claw'] },
      { id: 104, name: 'Guardian', role: 'tank', heroTalents: ['Elune\'s Chosen', 'Druid of the Claw'] },
      { id: 105, name: 'Restoration', role: 'healer', heroTalents: ['Elune\'s Chosen', 'Keeper of the Grove'] },
    ]
  },
  {
    id: 13, name: 'Evoker', slug: 'evoker', color: '#33937F',
    specs: [
      { id: 1467, name: 'Devastation', role: 'dps', heroTalents: ['Scalecommander', 'Flameshaper'] },
      { id: 1468, name: 'Preservation', role: 'healer', heroTalents: ['Chronowarden', 'Flameshaper'] },
      { id: 1473, name: 'Augmentation', role: 'dps', heroTalents: ['Scalecommander', 'Chronowarden'] },
    ]
  },
  {
    id: 3, name: 'Hunter', slug: 'hunter', color: '#AAD372',
    specs: [
      { id: 253, name: 'Beast Mastery', role: 'dps', heroTalents: ['Pack Leader', 'Sentinel'] },
      { id: 254, name: 'Marksmanship', role: 'dps', heroTalents: ['Sentinel', 'Dark Ranger'] },
      { id: 255, name: 'Survival', role: 'dps', heroTalents: ['Pack Leader', 'Dark Ranger'] },
    ]
  },
  {
    id: 8, name: 'Mage', slug: 'mage', color: '#3FC7EB',
    specs: [
      { id: 62, name: 'Arcane', role: 'dps', heroTalents: ['Spellslinger', 'Sunfury'] },
      { id: 63, name: 'Fire', role: 'dps', heroTalents: ['Sunfury', 'Frostfire'] },
      { id: 64, name: 'Frost', role: 'dps', heroTalents: ['Spellslinger', 'Frostfire'] },
    ]
  },
  {
    id: 10, name: 'Monk', slug: 'monk', color: '#00FF98',
    specs: [
      { id: 268, name: 'Brewmaster', role: 'tank', heroTalents: ['Shado-Pan', 'Master of Harmony'] },
      { id: 269, name: 'Windwalker', role: 'dps', heroTalents: ['Shado-Pan', 'Conduit of the Celestials'] },
      { id: 270, name: 'Mistweaver', role: 'healer', heroTalents: ['Master of Harmony', 'Conduit of the Celestials'] },
    ]
  },
  {
    id: 2, name: 'Paladin', slug: 'paladin', color: '#F48CBA',
    specs: [
      { id: 65, name: 'Holy', role: 'healer', heroTalents: ['Lightsmith', 'Herald of the Sun'] },
      { id: 66, name: 'Protection', role: 'tank', heroTalents: ['Lightsmith', 'Templar'] },
      { id: 70, name: 'Retribution', role: 'dps', heroTalents: ['Herald of the Sun', 'Templar'] },
    ]
  },
  {
    id: 5, name: 'Priest', slug: 'priest', color: '#FFFFFF',
    specs: [
      { id: 256, name: 'Discipline', role: 'healer', heroTalents: ['Voidweaver', 'Oracle'] },
      { id: 257, name: 'Holy', role: 'healer', heroTalents: ['Oracle', 'Archon'] },
      { id: 258, name: 'Shadow', role: 'dps', heroTalents: ['Voidweaver', 'Archon'] },
    ]
  },
  {
    id: 4, name: 'Rogue', slug: 'rogue', color: '#FFF468',
    specs: [
      { id: 259, name: 'Assassination', role: 'dps', heroTalents: ['Deathstalker', 'Fatebound'] },
      { id: 260, name: 'Outlaw', role: 'dps', heroTalents: ['Trickster', 'Fatebound'] },
      { id: 261, name: 'Subtlety', role: 'dps', heroTalents: ['Deathstalker', 'Trickster'] },
    ]
  },
  {
    id: 7, name: 'Shaman', slug: 'shaman', color: '#0070DD',
    specs: [
      { id: 262, name: 'Elemental', role: 'dps', heroTalents: ['Stormbringer', 'Farseer'] },
      { id: 263, name: 'Enhancement', role: 'dps', heroTalents: ['Stormbringer', 'Totemic'] },
      { id: 264, name: 'Restoration', role: 'healer', heroTalents: ['Farseer', 'Totemic'] },
    ]
  },
  {
    id: 9, name: 'Warlock', slug: 'warlock', color: '#8788EE',
    specs: [
      { id: 265, name: 'Affliction', role: 'dps', heroTalents: ['Soul Harvester', 'Hellcaller'] },
      { id: 266, name: 'Demonology', role: 'dps', heroTalents: ['Hellcaller', 'Diabolist'] },
      { id: 267, name: 'Destruction', role: 'dps', heroTalents: ['Soul Harvester', 'Diabolist'] },
    ]
  },
  {
    id: 1, name: 'Warrior', slug: 'warrior', color: '#C69B3A',
    specs: [
      { id: 71, name: 'Arms', role: 'dps', heroTalents: ['Slayer', 'Colossus'] },
      { id: 72, name: 'Fury', role: 'dps', heroTalents: ['Slayer', 'Mountain Thane'] },
      { id: 73, name: 'Protection', role: 'tank', heroTalents: ['Colossus', 'Mountain Thane'] },
    ]
  },
]

export const CONTENT_TYPES = [
  { value: 'raid', label: 'Raid', slug: 'raid' },
  { value: 'mythic_plus', label: 'Mythic+', slug: 'mythic-plus' },
  { value: 'pvp', label: 'PvP', slug: 'pvp' },
  { value: 'solo', label: 'Solo / Leveling', slug: 'solo' },
] as const

export const STEP_FUNCTIONS = [
  'Sequential',
  'Priority',
  'Rev. Priority',
  'Random',
] as const

export function getClassById(id: number): WowClass | undefined {
  return WOW_CLASSES.find(c => c.id === id)
}

export function getClassBySlug(slug: string): WowClass | undefined {
  return WOW_CLASSES.find(c => c.slug === slug)
}

export function getContentTypeBySlug(slug: string) {
  return CONTENT_TYPES.find(ct => ct.slug === slug)
}

export function getClassColor(classId: number): string {
  return getClassById(classId)?.color ?? '#888'
}

const SLUG_MAX_LENGTH = 60
const SLUG_FALLBACK = 'sequence'

// Every line below is a defect reproduced against the live site:
//
// NFKD plus the combining-mark strip so an accented letter FOLDS to its base
// letter. The old version used \w without the u flag, which is ASCII only, so
// it silently DELETED the accent and turned a German word into a misspelling.
//
// "plus" is spelled out before the strip. The old version deleted it, so "M+"
// became "m", which removed the highest-value search term in this domain from
// exactly the URLs that should rank for it. Live example:
// sequences/-highlord-ret-midnight-raid-m-templar-ms0fkjij
//
// The leading and trailing hyphen strip replaces a .trim() that ran AFTER
// whitespace had already become hyphens, so it could never remove them. That is
// why the slug above starts with a hyphen. The caller then appends another
// hyphen and a timestamp, so a trailing one produced a double.
//
// a-z0-9 rather than \w also drops the underscore, which \w allowed through and
// which does not belong in a URL slug.
//
// The length cap trims back to a whole word. notify-discord caps a title at 200
// characters, so a 200-character slug was reachable.
//
// The fallback exists because a title written entirely in a non-Latin script
// reduced to an empty string, and the caller would then produce a URL that is
// nothing but a hyphen and a timestamp.
export function slugify(text: string): string {
  let out = String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (out.length > SLUG_MAX_LENGTH) {
    out = out.slice(0, SLUG_MAX_LENGTH).replace(/-[^-]*$/, '')
  }

  return out.replace(/-+$/, '') || SLUG_FALLBACK
}
