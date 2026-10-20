import { describe, expect, it } from 'vitest'
import { nerdNotes } from './nerd'
import type { ArchivedRelease } from './ems-archive'

const item = (lead: string, body: string) => ({ markdown: `**${lead}** ${body}`, lead, body })
const release = (items: ReturnType<typeof item>[]): ArchivedRelease => ({ version: '1.0.0', date: '2026-01-01', suffix: null, intro: '', sections: [{ title: 'Fixed', items }] })

describe('nerdNotes', () => {
  it('picks the most technical entries and trims each to its lead and first two sentences', () => {
    const notes = nerdNotes(release([
      item('A plain fix.', 'The button is blue now.'),
      item('A secure attribute bug.', 'The attribute went through a secure function and the Lua event never fired. A second sentence. A third sentence that is cut.'),
    ]))
    expect(notes).toHaveLength(1)
    expect(notes[0]).toBe('**A secure attribute bug.** The attribute went through a secure function and the Lua event never fired. A second sentence.')
  })

  it('falls back to the most detailed entry when none is technical, and to nothing for an empty release', () => {
    expect(nerdNotes(release([item('Colours.', 'The page is nicer.'), item('Layout.', 'The page is nicer and the spacing is wider than before.')]))).toEqual([
      '**Layout.** The page is nicer and the spacing is wider than before.',
    ])
    expect(nerdNotes(release([]))).toEqual([])
  })
})
