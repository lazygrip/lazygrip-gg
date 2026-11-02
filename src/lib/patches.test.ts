import { describe, expect, it } from 'vitest'
import { LATEST_PATCH, PATCH_VERSIONS, comparePatchesNewestFirst, orderPatchOptions, patchFamily } from './patches'

describe('patch options', () => {
  it('lists the latest patch first in the publish form options', () => {
    expect(PATCH_VERSIONS[0]).toBe(LATEST_PATCH)
  })

  it('keeps the publish form options in newest first order', () => {
    const sorted = [...PATCH_VERSIONS].sort(comparePatchesNewestFirst)
    expect(PATCH_VERSIONS).toEqual(sorted)
  })

  it('sorts numerically, so 12.1.5 is above 12.1 and 12.1 is above 12.0.7', () => {
    expect(['12.0', '12.1', '12.0.7', '12.1.5', '12.0.5'].sort(comparePatchesNewestFirst)).toEqual([
      '12.1.5',
      '12.1',
      '12.0.7',
      '12.0.5',
      '12.0',
    ])
  })

  it('does not sort 12.10 below 12.9 the way a plain string sort would', () => {
    expect(['12.9', '12.10'].sort(comparePatchesNewestFirst)).toEqual(['12.10', '12.9'])
  })

  it('always offers the latest patch in a filter, even with no sequences on it', () => {
    expect(orderPatchOptions(['12.1', '12.0.7', '12.0.5'])[0]).toBe(LATEST_PATCH)
  })

  it('does not duplicate the latest patch when sequences already use it', () => {
    const options = orderPatchOptions([LATEST_PATCH, '12.1'])
    expect(options.filter(p => p === LATEST_PATCH)).toHaveLength(1)
  })

  it('trims values and drops blanks', () => {
    expect(orderPatchOptions([' 12.1 ', '', '   ', '12.0.7'])).toEqual([LATEST_PATCH, '12.1', '12.0.7'])
  })
})

describe('patch family', () => {
  it('groups point releases of one season together', () => {
    expect(patchFamily('12.1')).toBe('12.1')
    expect(patchFamily('12.1.5')).toBe('12.1')
    expect(patchFamily('12.0.7')).toBe('12.0')
    expect(patchFamily('12.10.2')).toBe('12.10')
  })

  it('returns null for a value that is not a patch number', () => {
    expect(patchFamily(null)).toBeNull()
    expect(patchFamily('')).toBeNull()
    expect(patchFamily('Midnight')).toBeNull()
    expect(patchFamily('12')).toBeNull()
  })
})
