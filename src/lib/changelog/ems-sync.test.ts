import { describe, expect, it } from 'vitest'
import { compareVersions, parseEmsChangelog } from './ems'
import { decodeEntities, mergeIncoming, readWagoReleases } from './ems-sync'

const md = (versions: { v: string; date?: string; lines: string[] }[]) =>
  versions
    .map(x => `## [v${x.v}] - ${x.date ?? 'Unreleased'}\n\n### Fixed\n\n${x.lines.map(l => `- ${l}`).join('\n')}\n`)
    .join('\n')

const parse = (s: string) => parseEmsChangelog(s).releases
const slim = (s: string) =>
  parse(s).map(({ version, date, suffix, intro, sections }) => ({ version, date, suffix, intro, sections }))

describe('mergeIncoming', () => {
  it('adds a new release and keeps newest first', () => {
    const have = slim(md([{ v: '2.4.20', date: '2026-10-10', lines: ['**A.** one'] }]))
    const r = mergeIncoming(
      have,
      parse(
        md([
          { v: '2.4.21', date: '2026-10-17', lines: ['**B.** two'] },
          { v: '2.4.20', date: '2026-10-10', lines: ['**A.** one'] },
        ]),
      ),
      compareVersions,
    )
    expect(r.added).toEqual(['2.4.21'])
    expect(r.refreshed).toEqual([])
    expect(r.releases.map(x => x.version)).toEqual(['2.4.21', '2.4.20'])
  })

  it('does nothing when the text is identical', () => {
    const text = md([{ v: '2.4.20', date: '2026-10-10', lines: ['**A.** one'] }])
    const r = mergeIncoming(slim(text), parse(text), compareVersions)
    expect(r.added).toEqual([])
    expect(r.refreshed).toEqual([])
  })

  it('refreshes a version whose wording the author edited', () => {
    const have = slim(md([{ v: '2.4.20', date: '2026-10-10', lines: ['**A.** one'] }]))
    const r = mergeIncoming(
      have,
      parse(md([{ v: '2.4.20', date: '2026-10-10', lines: ['**A.** one, fixed typo'] }])),
      compareVersions,
    )
    expect(r.refreshed).toEqual(['2.4.20'])
    expect(r.releases[0].sections[0].items[0].markdown).toContain('fixed typo')
  })

  it('never adds an unreleased or undated version', () => {
    const r = mergeIncoming([], parse(md([{ v: '2.5.0', lines: ['**Soon.** later'] }])), compareVersions)
    expect(r.added).toEqual([])
    expect(r.skipped).toEqual(['2.5.0'])
    expect(r.releases).toEqual([])
  })

  it('does not add a release with nothing in it', () => {
    const r = mergeIncoming([], parse('## [v2.5.0] - 2026-11-01\n\n### Fixed\n\n'), compareVersions)
    expect(r.added).toEqual([])
  })
})

describe('readWagoReleases', () => {
  const page = (data: unknown) =>
    `<div id="app" data-page="${JSON.stringify(data).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></div>`

  it('returns stable releases newest first, with the changelog text intact', () => {
    const out = readWagoReleases(
      page({
        props: {
          releases: {
            data: [
              { label: 'v2.4.20', stability: 'stable', created_at: '2026-10-10', changelog: 'a & b' },
              { label: 'v2.4.21', stability: 'stable', created_at: '2026-10-17', changelog: '<x> "q"' },
              { label: 'v2.4.22-beta', stability: 'beta', created_at: '2026-10-18', changelog: 'nope' },
            ],
          },
        },
      }),
    )
    expect(out.map(r => r.label)).toEqual(['v2.4.21', 'v2.4.20'])
    expect(out[0].changelog).toBe('<x> "q"')
    expect(out[1].changelog).toBe('a & b')
  })

  it('fails loudly when the page changes shape', () => {
    expect(() => readWagoReleases('<html></html>')).toThrow(/data-page/)
    expect(() => readWagoReleases(page({ props: {} }))).toThrow(/releases\.data/)
    expect(() => readWagoReleases(page({ props: { releases: { data: [] } } }))).toThrow(/No stable/)
  })
})

describe('decodeEntities', () => {
  it('decodes named and numeric entities once', () => {
    expect(decodeEntities('a &amp; b &quot;c&quot; it&#39;s it&#x27;s it&#039;s &lt;x&gt;')).toBe('a & b "c" it\'s it\'s it\'s <x>')
    expect(decodeEntities('&amp;quot; &unknown;')).toBe('&quot; &unknown;')
  })
})
