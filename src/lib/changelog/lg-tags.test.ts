import { describe, expect, it } from 'vitest'
import { LG_AREAS, areaOfEntry, kindOf } from './lg-tags'

// Real public lines from the LG-Changelog.
describe('kindOf', () => {
  it('reads the kind of change from the wording', () => {
    expect(kindOf('Add WoW: Forever compatibility guide page').label).toBe('New')
    expect(kindOf('Fix collection sequence version data corruption bug').label).toBe('Fixed')
    expect(kindOf('Show a plain message when a sign in is refused instead of hanging').label).toBe('Fixed')
    expect(kindOf('Remove the stray tarball').label).toBe('Removed')
    expect(kindOf('Make the site usable on phones').label).toBe('Changed')
  })
})

describe('areaOfEntry', () => {
  it('files a line under the first part of the site it names, and falls back to Everything else', () => {
    expect(areaOfEntry('Make the site usable on phones')).toBe('Phones')
    expect(areaOfEntry('Keep old profile URLs working after a username rename')).toBe('Accounts')
    expect(areaOfEntry('Require a spec to publish, and keep empty hubs out of the sitemap')).toBe('Sequences')
    expect(areaOfEntry('Switch site fonts to Saira and JetBrains Mono and enlarge small text')).toBe('Look and feel')
    expect(areaOfEntry('Auto-update GRIP-EMS version to v2.4.21 (#100)')).toBe('Everything else')
    expect(LG_AREAS.at(-1)).toBe('Everything else')
  })
})
