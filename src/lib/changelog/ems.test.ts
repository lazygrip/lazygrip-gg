import { describe, expect, it } from 'vitest'
import { compareVersions, parseEmsChangelog } from './ems'

// Shapes taken from the real GRIP-EMS CHANGELOG.md, shortened. The author's format is the spec.
const CURRENT = `# Changelog

> **Created:** 2025 (pre-stamping; exact date unknown)
> **Updated:** 2026-10-17
> **WoW Patch at last update:** 12.1.5 Midnight (Retail LIVE)

All notable changes are documented in this file.

## \\[v2.4.21\\] - 2026-10-17

### Added

- **A step can have its own key that turns it off and on.** Right-click a step, choose Set Toggle Key and press the key you want.

### Changed

- **With no recommendation for a sequence, every variant slot sits at full brightness.** They were all dimmed instead.

- **A sequence you make with New starts with \`/stopmacro [channeling]\` in Key Press.** A version you add already did.

### Removed

- **The old Quick Reset button.** It did nothing the reset options did not.

### Fixed

- **Renaming in combat no longer leaves the old name behind.** The list now refreshes.

## \\[v2.4.20-hotfix\\] - 2026-10-14

### Fixed

- **A hotfix entry.** With a second sentence.
  - and a nested bullet that belongs to it
`

describe('parseEmsChangelog on the current file shape', () => {
  const out = parseEmsChangelog(CURRENT)

  it('reads the header block', () => {
    expect(out.meta.updated).toBe('2026-10-17')
    expect(out.meta.wowPatch).toBe('12.1.5 Midnight (Retail LIVE)')
  })

  it('finds both releases newest first as written, with escaped brackets undone', () => {
    expect(out.releases.map(r => r.version)).toEqual(['2.4.21', '2.4.20-hotfix'])
    expect(out.releases[0].date).toBe('2026-10-17')
    expect(out.releases[0].released).toBe(true)
    expect(out.releases[1].suffix).toBe('hotfix')
    expect(out.warnings).toEqual([])
  })

  it('keeps every section in the order the author wrote it', () => {
    expect(out.releases[0].sections.map(s => s.title)).toEqual(['Added', 'Changed', 'Removed', 'Fixed'])
    expect(out.releases[0].sections[1].items).toHaveLength(2)
  })

  it('splits the bold lead from the explanation and keeps inline code', () => {
    const item = out.releases[0].sections[1].items[1]
    expect(item.lead).toBe('A sequence you make with New starts with `/stopmacro [channeling]` in Key Press.')
    expect(item.body).toBe('A version you add already did.')
    expect(item.markdown.startsWith('**A sequence')).toBe(true)
  })

  it('keeps a nested bullet inside the entry it belongs to', () => {
    const items = out.releases[1].sections[0].items
    expect(items).toHaveLength(1)
    expect(items[0].markdown).toContain('and a nested bullet')
  })

  it('stores each release block verbatim', () => {
    expect(out.releases[0].raw.startsWith('## \\[v2.4.21\\] - 2026-10-17')).toBe(true)
    expect(out.releases[0].raw).not.toContain('v2.4.20-hotfix')
  })
})

describe('parseEmsChangelog on older and odd shapes from the git history', () => {
  it('reads unescaped headings and a beta suffix', () => {
    const out = parseEmsChangelog('## [v0.9.0-beta] - 2026-03-20\n\n### Added\n\n- **First cut.** It ran.\n')
    expect(out.releases[0]).toMatchObject({ version: '0.9.0-beta', date: '2026-03-20', suffix: 'beta', released: true })
  })

  it('marks an unreleased version as not released and skips a bare [Unreleased] heading', () => {
    const out = parseEmsChangelog('## \\[Unreleased\\]\n\n- scratch\n\n## \\[v2.4.21\\] - Unreleased\n\n### Added\n\n- **Soon.** Not yet.\n')
    expect(out.releases).toHaveLength(1)
    expect(out.releases[0]).toMatchObject({ version: '2.4.21', date: null, released: false })
    expect(out.warnings).toEqual([])
  })

  it('reads the "## vX.Y.Z (unreleased)" and "## [Unreleased] - vX.Y.Z" styles', () => {
    const out = parseEmsChangelog('## v2.0.0 (unreleased)\n\n- **A.** b\n\n## [Unreleased] - v1.9.0\n\n- **C.** d\n')
    expect(out.releases.map(r => [r.version, r.released])).toEqual([['2.0.0', false], ['1.9.0', false]])
  })

  it('keeps a release with no ### sections as one Notes section and says so', () => {
    const out = parseEmsChangelog('## [v1.0.0] - 2026-04-01\n\n- **Whole thing.** In one list.\n')
    expect(out.releases[0].sections).toEqual([
      { title: 'Notes', items: [{ markdown: '**Whole thing.** In one list.', lead: 'Whole thing.', body: 'In one list.' }] },
    ])
    expect(out.warnings).toHaveLength(1)
  })

  it('keeps sections it has never seen, such as Internal and Known limitations', () => {
    const out = parseEmsChangelog('## [v1.1.0] - 2026-04-02\n\n### Internal\n\n- **Refactor.** x\n\n### Known limitations\n\n- **Y.** z\n')
    expect(out.releases[0].sections.map(s => s.title)).toEqual(['Internal', 'Known limitations'])
  })

  it('keeps an entry with no bold lead whole', () => {
    const out = parseEmsChangelog('## [v1.2.0] - 2026-04-03\n\n### Fixed\n\n- Plain sentence with no bold.\n')
    expect(out.releases[0].sections[0].items[0]).toMatchObject({ lead: null, body: 'Plain sentence with no bold.' })
  })

  it('does not treat a ## line inside a code fence as a release', () => {
    const out = parseEmsChangelog('## [v1.3.0] - 2026-04-04\n\n### Added\n\n- **Fence.**\n\n```\n## [v9.9.9] - 2026-01-01\n```\n')
    expect(out.releases.map(r => r.version)).toEqual(['1.3.0'])
  })

  it('handles Windows line endings and never throws on junk', () => {
    expect(parseEmsChangelog(CURRENT.replace(/\n/g, '\r\n')).releases).toHaveLength(2)
    expect(parseEmsChangelog('')).toEqual({ meta: { updated: null, wowPatch: null }, releases: [], warnings: [] })
    expect(parseEmsChangelog('## nothing useful\n').warnings).toHaveLength(2)
  })
})

describe('compareVersions', () => {
  it('orders numbers, not strings, and puts a hotfix after its release and a beta before it', () => {
    const sorted = ['2.4.9', '2.4.21', '2.4.20-hotfix', '2.4.20', '0.9.0-beta', '0.9.0'].sort(compareVersions)
    expect(sorted).toEqual(['0.9.0-beta', '0.9.0', '2.4.9', '2.4.20', '2.4.20-hotfix', '2.4.21'])
  })
})
