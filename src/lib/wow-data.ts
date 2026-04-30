import { WowClass } from '@/types'

export const WOW_CLASSES: WowClass[] = [
  {
    id: 1, name: 'Warrior', color: '#C69B3A',
    specs: [
      { id: 71, name: 'Arms', role: 'dps' },
      { id: 72, name: 'Fury', role: 'dps' },
      { id: 73, name: 'Protection', role: 'tank' },
    ]
  },
  {
    id: 2, name: 'Paladin', color: '#F48CBA',
    specs: [
      { id: 65, name: 'Holy', role: 'healer' },
      { id: 66, name: 'Protection', role: 'tank' },
      { id: 70, name: 'Retribution', role: 'dps' },
    ]
  },
  {
    id: 3, name: 'Hunter', color: '#AAD372',
    specs: [
      { id: 253, name: 'Beast Mastery', role: 'dps' },
      { id: 254, name: 'Marksmanship', role: 'dps' },
      { id: 255, name: 'Survival', role: 'dps' },
    ]
  },
  {
    id: 4, name: 'Rogue', color: '#FFF468',
    specs: [
      { id: 259, name: 'Assassination', role: 'dps' },
      { id: 260, name: 'Outlaw', role: 'dps' },
      { id: 261, name: 'Subtlety', role: 'dps' },
    ]
  },
  {
    id: 5, name: 'Priest', color: '#FFFFFF',
    specs: [
      { id: 256, name: 'Discipline', role: 'healer' },
      { id: 257, name: 'Holy', role: 'healer' },
      { id: 258, name: 'Shadow', role: 'dps' },
    ]
  },
  {
    id: 6, name: 'Death Knight', color: '#C41E3A',
    specs: [
      { id: 250, name: 'Blood', role: 'tank' },
      { id: 251, name: 'Frost', role: 'dps' },
      { id: 252, name: 'Unholy', role: 'dps' },
    ]
  },
  {
    id: 7, name: 'Shaman', color: '#0070DD',
    specs: [
      { id: 262, name: 'Elemental', role: 'dps' },
      { id: 263, name: 'Enhancement', role: 'dps' },
      { id: 264, name: 'Restoration', role: 'healer' },
    ]
  },
  {
    id: 8, name: 'Mage', color: '#3FC7EB',
    specs: [
      { id: 62, name: 'Arcane', role: 'dps' },
      { id: 63, name: 'Fire', role: 'dps' },
      { id: 64, name: 'Frost', role: 'dps' },
    ]
  },
  {
    id: 9, name: 'Warlock', color: '#8788EE',
    specs: [
      { id: 265, name: 'Affliction', role: 'dps' },
      { id: 266, name: 'Demonology', role: 'dps' },
      { id: 267, name: 'Destruction', role: 'dps' },
    ]
  },
  {
    id: 10, name: 'Monk', color: '#00FF98',
    specs: [
      { id: 268, name: 'Brewmaster', role: 'tank' },
      { id: 269, name: 'Windwalker', role: 'dps' },
      { id: 270, name: 'Mistweaver', role: 'healer' },
    ]
  },
  {
    id: 11, name: 'Druid', color: '#FF7C0A',
    specs: [
      { id: 102, name: 'Balance', role: 'dps' },
      { id: 103, name: 'Feral', role: 'dps' },
      { id: 104, name: 'Guardian', role: 'tank' },
      { id: 105, name: 'Restoration', role: 'healer' },
    ]
  },
  {
    id: 12, name: 'Demon Hunter', color: '#A330C9',
    specs: [
      { id: 577, name: 'Havoc', role: 'dps' },
      { id: 581, name: 'Vengeance', role: 'tank' },
    ]
  },
  {
    id: 13, name: 'Evoker', color: '#33937F',
    specs: [
      { id: 1467, name: 'Devastation', role: 'dps' },
      { id: 1468, name: 'Preservation', role: 'healer' },
      { id: 1473, name: 'Augmentation', role: 'dps' },
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
