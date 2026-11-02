import { describe, expect, it } from 'vitest'
import { capPerAuthor } from './home-stats'

const row = (id: string, author: string) => ({ id, author: { username: author } })

describe('capPerAuthor', () => {
  it('stops one author holding more than the cap when others are available', () => {
    const ranked = [
      row('a1', 'a'), row('a2', 'a'), row('a3', 'a'), row('a4', 'a'),
      row('b1', 'b'), row('c1', 'c'), row('d1', 'd'),
    ]
    expect(capPerAuthor(ranked, 6, 2).map(r => r.id)).toEqual(['a1', 'a2', 'b1', 'c1', 'd1', 'a3'])
  })

  it('keeps ranked order among the rows it keeps', () => {
    const ranked = [row('a1', 'a'), row('b1', 'b'), row('a2', 'a'), row('a3', 'a'), row('c1', 'c')]
    expect(capPerAuthor(ranked, 4, 2).map(r => r.id)).toEqual(['a1', 'b1', 'a2', 'c1'])
  })

  it('backfills in ranked order when there are too few authors to fill the list', () => {
    const ranked = [row('a1', 'a'), row('a2', 'a'), row('a3', 'a'), row('b1', 'b'), row('a4', 'a')]
    expect(capPerAuthor(ranked, 5, 2).map(r => r.id)).toEqual(['a1', 'a2', 'b1', 'a3', 'a4'])
  })

  it('returns everything when there are fewer rows than the limit', () => {
    expect(capPerAuthor([row('a1', 'a'), row('a2', 'a'), row('a3', 'a')], 6, 2)).toHaveLength(3)
  })

  it('treats a row with no author as its own author', () => {
    const ranked = [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }]
    expect(capPerAuthor(ranked, 3, 1).map(r => r.id)).toEqual(['x1', 'x2', 'x3'])
  })
})
