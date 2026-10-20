// Maps a section title from the author's file onto the four kinds of change the pages colour.
export type Tone = 'added' | 'changed' | 'removed' | 'fixed' | 'other'

export function toneOf(title: string): Tone {
  const t = title.toLowerCase()
  if (t.startsWith('add') || t.startsWith('new')) return 'added'
  if (t.startsWith('chang') || t.startsWith('improv') || t.startsWith('perform')) return 'changed'
  if (t.startsWith('remov') || t.startsWith('deprec')) return 'removed'
  if (t.startsWith('fix')) return 'fixed'
  return 'other'
}
