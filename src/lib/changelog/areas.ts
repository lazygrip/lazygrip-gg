import type { EmsItem } from './ems'

// LazyGrip's own grouping, not the author's. A long section such as v2.4.21's 127 fixes is
// sorted by what the entry is about so a player can go straight to the part of the addon they
// use. The first rule that matches wins, so the order below is the order of priority. The
// pages say plainly that this grouping is ours, and every entry keeps its original wording.
const RULES: { area: string; test: RegExp }[] = [
  { area: 'Languages', test: /language|locali[sz]|korean|chinese|russian|french|italian|german|spanish|portuguese|plural|translat/ },
  { area: 'WoW Forever and plugins', test: /forever|classic|plugin|lua error/ },
  { area: 'Resets and modifiers', test: /reset|step 1|pause|modifier/ },
  { area: 'Repair and spell warnings', test: /repair|validat|stale|spell warning|spell names?|missing spell/ },
  { area: 'Variables and recommendations', test: /variable|recommend|tempo|advisor|unitHealth/i },
  { area: 'Macros, export, import and sharing', test: /macro|export|import|\bshar|\bsend|receiv/ },
  { area: 'Keybinds and the conflict panel', test: /keybind|key bind|binding|\bbound\b|conflict|hotkey|\bkeys?\b/ },
  { area: 'Combat and the Options pages', test: /combat|fight|\bpull\b|options (page|window|panel)/ },
  { area: 'Saving, naming and editing', test: /\bsav|edit|undo|discard|popup|window|disabl|\bpin|version|renam|delet|name/ },
]

export const OTHER_AREA = 'Everything else'

// Stable position of each area, used to give it the same colour on every page.
export const AREA_ORDER = [...RULES.map(r => r.area), OTHER_AREA]
export const areaIndex = (area: string) => Math.max(0, AREA_ORDER.indexOf(area))

export function areaOf(item: EmsItem): string {
  const text = `${item.lead ?? ''} ${item.body}`.toLowerCase()
  for (const r of RULES) if (r.test.test(text)) return r.area
  return OTHER_AREA
}

export type AreaGroup = { area: string; items: { item: EmsItem; index: number }[] }

// Groups only when it helps: fewer than 9 entries stay as one list.
export function groupByArea(items: EmsItem[]): AreaGroup[] | null {
  if (items.length <= 8) return null
  const map = new Map<string, AreaGroup>()
  items.forEach((item, index) => {
    const area = areaOf(item)
    if (!map.has(area)) map.set(area, { area, items: [] })
    map.get(area)!.items.push({ item, index })
  })
  const groups = [...map.values()].sort((a, b) => (a.area === OTHER_AREA ? 1 : b.area === OTHER_AREA ? -1 : b.items.length - a.items.length))
  return groups.length >= 2 ? groups : null
}

export function matches(item: EmsItem, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = item.markdown.toLowerCase()
  return words.every(w => text.includes(w))
}
