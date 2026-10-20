import { describe, expect, it } from 'vitest'
import { OTHER_AREA, areaOf, groupByArea, matches } from './areas'
import type { EmsItem } from './ems'

const item = (lead: string, body = ''): EmsItem => ({ markdown: `**${lead}** ${body}`.trim(), lead, body })

describe('areaOf', () => {
  it('sorts entries by what they are about, with the first matching rule winning', () => {
    expect(areaOf(item('A reset timer that runs out mid-fight now fires.'))).toBe('Resets and modifiers')
    expect(areaOf(item('Counts read right in Russian and Korean.'))).toBe('Languages')
    expect(areaOf(item('EMS loads on WoW Forever again.'))).toBe('WoW Forever and plugins')
    expect(areaOf(item('Export keeps your macro with the sequence.'))).toBe('Macros, export, import and sharing')
    expect(areaOf(item('The Accessibility page starts with the guide.'))).toBe(OTHER_AREA)
  })
})

describe('groupByArea', () => {
  it('leaves a short section alone and groups a long one largest first, Everything else last', () => {
    expect(groupByArea(Array.from({ length: 8 }, () => item('Reset thing.')))).toBeNull()
    const long = [
      ...Array.from({ length: 3 }, () => item('A keybind thing.')),
      ...Array.from({ length: 5 }, () => item('A reset thing.')),
      item('Something about the accessibility page.'),
    ]
    const groups = groupByArea(long)!
    expect(groups.map(g => [g.area, g.items.length])).toEqual([['Resets and modifiers', 5], ['Keybinds and the conflict panel', 3], [OTHER_AREA, 1]])
    expect(groups[0].items[0].index).toBe(3)
  })
})

describe('matches', () => {
  it('needs every word, ignores case and treats an empty query as everything', () => {
    expect(matches(item('Reset timer fires.', 'After a pause.'), 'RESET pause')).toBe(true)
    expect(matches(item('Reset timer fires.'), 'reset tab')).toBe(false)
    expect(matches(item('Anything.'), '  ')).toBe(true)
  })
})
