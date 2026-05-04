import { WowClass } from '@/types'

export const WOW_CLASSES: WowClass[] = [
  {
    id: 1, name: 'Warrior', color: '#C69B3A',
    specs: [
      { id: 71, name: 'Arms', role: 'dps', heroTalents: ['Slayer', 'Colossus'] },
      { id: 72, name: 'Fury', role: 'dps', heroTalents: ['Slayer', 'Mountain Thane'] },
      { id: 73, name: 'Protection', role: 'tank', heroTalents: ['Colossus', 'Mountain Thane'] },
    ]
  },
  {
    id: 2, name: 'Paladin', color: '#F48CBA',
    specs: [
      { id: 65, name: 'Holy', role: 'healer', heroTalents: ['Lightsmith', 'Herald of the Sun'] },
      { id: 66, name: 'Protection', role: 'tank', heroTalents: ['Lightsmith', 'Templar'] },
      { id: 70, name: 'Retribution', role: 'dps', heroTalents: ['Herald of the Sun', 'Templar'] },
    ]
  },
  {
    id: 3, name: 'Hunter', color: '#AAD372',
    specs: [
      { id: 253, name: 'Beast Mastery', role: 'dps', heroTalents: ['Pack Leader', 'Sentinel'] },
      { id: 254, name: 'Marksmanship', role: 'dps', heroTalents: ['Sentinel', 'Dark Ranger'] },
      { id: 255, name: 'Survival', role: 'dps', heroTalents: ['Pack Leader', 'Dark Ranger'] },
    ]
  },
  {
    id: 4, name: 'Rogue', color: '#FFF468',
    specs: [
      { id: 259, name: 'Assassination', role: 'dps', heroTalents: ['Deathstalker', 'Trickster'] },
      { id: 260, name: 'Outlaw', role: 'dps', heroTalents: ['Trickster', 'Fatebound'] },
      { id: 261, name: 'Subtlety', role: 'dps', heroTalents: ['Deathstalker', 'Fatebound'] },
    ]
  },
  {
    id: 5, name: 'Priest', color: '#FFFFFF',
    specs: [
      { id: 256, name: 'Discipline', role: 'healer', heroTalents: ['Voidweaver', 'Oracle'] },
      { id: 257, name: 'Holy', role: 'healer', heroTalents: ['Oracle', 'Archon'] },
      { id: 258, name: 'Shadow', role: 'dps', heroTalents: ['Voidweaver', 'Archon'] },
    ]
  },
  {
    id: 6, name: 'Death Knight', color: '#C41E3A',
    specs: [
      { id: 250, name: 'Blood', role: 'tank', heroTalents: ['Deathbringer', 'San\'layn'] },
      { id: 251, name: 'Frost', role: 'dps', heroTalents: ['Deathbringer', 'Rider of the Apocalypse'] },
      { id: 252, name: 'Unholy', role: 'dps', heroTalents: ['San\'layn', 'Rider of the Apocalypse'] },
    ]
  },
  {
    id: 7, name: 'Shaman', color: '#0070DD',
    specs: [
      { id: 262, name: 'Elemental', role: 'dps', heroTalents: ['Stormbringer', 'Farseer'] },
      { id: 263, name: 'Enhancement', role: 'dps', heroTalents: ['Stormbringer', 'Totemic'] },
      { id: 264, name: 'Restoration', role: 'healer', heroTalents: ['Farseer', 'Totemic'] },
    ]
  },
  {
    id: 8, name: 'Mage', color: '#3FC7EB',
    specs: [
      { id: 62, name: 'Arcane', role: 'dps', heroTalents: ['Spellslinger', 'Sunfury'] },
      { id: 63, name: 'Fire', role: 'dps', heroTalents: ['Sunfury', 'Frostfire'] },
      { id: 64, name: 'Frost', role: 'dps', heroTalents: ['Spellslinger', 'Frostfire'] },
    ]
  },
  {
    id: 9, name: 'Warlock', color: '#8788EE',
    specs: [
      { id: 265, name: 'Affliction', role: 'dps', heroTalents: ['Soul Harvester', 'Hellcaller'] },
      { id: 266, name: 'Demonology', role: 'dps', heroTalents: ['Hellcaller', 'Diabolist'] },
      { id: 267, name: 'Destruction', role: 'dps', heroTalents: ['Soul Harvester', 'Diabolist'] },
    ]
  },
  {
    id: 10, name: 'Monk', color: '#00FF98',
    specs: [
      { id: 268, name: 'Brewmaster', role: 'tank', heroTalents: ['Shado-Pan', 'Master of Harmony'] },
      { id: 269, name: 'Windwalker', role: 'dps', heroTalents: ['Shado-Pan', 'Conduit of the Celestials'] },
      { id: 270, name: 'Mistweaver', role: 'healer', heroTalents: ['Master of Harmony', 'Conduit of the Celestials'] },
    ]
  },
  {
    id: 11, name: 'Druid', color: '#FF7C0A',
    specs: [
      { id: 102, name: 'Balance', role: 'dps', heroTalents: ['Elune\'s Chosen', 'Keeper of the Grove'] },
      { id: 103, name: 'Feral', role: 'dps', heroTalents: ['Wildstalker', 'Druid of the Claw'] },
      { id: 104, name: 'Guardian', role: 'tank', heroTalents: ['Elune\'s Chosen', 'Druid of the Claw'] },
      { id: 105, name: 'Restoration', role: 'healer', heroTalents: ['Elune\'s Chosen', 'Keeper of the Grove'] },
    ]
  },
  {
    id: 12, name: 'Demon Hunter', color: '#A330C9',
    specs: [
      { id: 577, name: 'Havoc', role: 'dps', heroTalents: ['Fel-Scarred', 'Aldrachi Reaver'] },
      { id: 581, name: 'Vengeance', role: 'tank', heroTalents: ['Aldrachi Reaver', 'Annihilator'] },
      { id: 1473, name: 'Devourer', role: 'dps', heroTalents: ['Annihilator', 'Void-Scarred'] },
    ]
  },
  {
    id: 13, name: 'Evoker', color: '#33937F',
    specs: [
      { id: 1467, name: 'Devastation', role: 'dps', heroTalents: ['Scalecommander', 'Flameshaper'] },
      { id: 1468, name: 'Preservation', role: 'healer', heroTalents: ['Chronowarden', 'Flameshaper'] },
      { id: 1473, name: 'Augmentation', role: 'dps', heroTalents: ['Scalecommander', 'Chronowarden'] },
    ]
  },
]

export const CONTENT_TYPES = [
  { value: 'raid', label: 'Raid' },
  { value: 'mythic_plus', label: 'Mythic+' },
  { value: 'pvp', label: 'PvP' },
  { value: 'solo', label: 'Solo / Leveling' },
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

export function getClassColor(classId: number): string {
  return getClassById(classId)?.color ?? '#888'
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}