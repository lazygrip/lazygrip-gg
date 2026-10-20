// The pure half of the changelog sync: given the archive we have and the changelog text that
// Wago shows for a release, decide what to add or refresh. No network and no file access here,
// so it can be tested. scripts/sync-ems-changelog.mts does the fetching and writing.
//
// Nothing is rewritten in the author's words: a release is stored exactly as the parser read it.
import type { EmsRelease } from './ems'

export type ArchiveRelease = Pick<EmsRelease, 'version' | 'date' | 'suffix' | 'intro' | 'sections'>

export type SyncResult = {
  releases: ArchiveRelease[]
  added: string[]
  refreshed: string[]
  skipped: string[]
}

const trim = (r: EmsRelease): ArchiveRelease => ({
  version: r.version,
  date: r.date,
  suffix: r.suffix,
  intro: r.intro,
  sections: r.sections,
})

// `incoming` is a parsed changelog from Wago. A version we have never seen is added. A version
// we already hold is replaced only when its text really differs, because that means the author
// edited it after we saved it. Undated or unreleased versions are never added. The compare
// function is passed in so this file needs no value imports and can run both under Next and as
// a plain Node script.
export function mergeIncoming(
  existing: ArchiveRelease[],
  incoming: EmsRelease[],
  compare: (a: string, b: string) => number,
): SyncResult {
  const byVersion = new Map(existing.map(r => [r.version, r]))
  const added: string[] = []
  const refreshed: string[] = []
  const skipped: string[] = []

  for (const r of incoming) {
    if (!r.released || r.sections.every(s => s.items.length === 0)) {
      skipped.push(r.version)
      continue
    }
    const next = trim(r)
    const have = byVersion.get(r.version)
    if (!have) {
      byVersion.set(r.version, next)
      added.push(r.version)
    } else if (JSON.stringify(have) !== JSON.stringify(next)) {
      byVersion.set(r.version, next)
      refreshed.push(r.version)
    }
  }

  const releases = [...byVersion.values()].sort((a, b) => compare(b.version, a.version))
  return { releases, added, refreshed, skipped }
}

// One pass, so "&amp;quot;" stays "&quot;" and is not decoded twice. Handles the named entities an
// HTML attribute can carry plus numeric ones in both forms (&#39; and &#x27;).
const NAMED: Record<string, string> = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' }
export function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g, (whole, dec, hex, name) => {
    if (dec !== undefined) return String.fromCodePoint(Number(dec))
    if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16))
    return NAMED[name] ?? whole
  })
}

// Reads the page data Wago embeds in its releases page: the JSON in the data-page attribute.
// Returns the stable releases newest first. Throws a plain message when the shape is not what
// we expect, so a Wago redesign fails loudly instead of quietly writing nothing.
export type WagoRelease = { label: string; stability: string; created_at: string; changelog: string }

export function readWagoReleases(html: string): WagoRelease[] {
  const m = /data-page="([^"]+)"/.exec(html)
  if (!m) throw new Error('Could not find the data-page attribute on the Wago releases page')
  const decoded = decodeEntities(m[1])
  let data: { props?: { releases?: { data?: unknown } } }
  try {
    data = JSON.parse(decoded)
  } catch (e) {
    throw new Error(`Could not parse the Wago page data: ${(e as Error).message}`)
  }
  const list = data.props?.releases?.data
  if (!Array.isArray(list)) throw new Error('Wago page data did not have the expected releases.data list')
  const stable = (list as WagoRelease[]).filter(
    r => r && r.stability === 'stable' && typeof r.label === 'string' && typeof r.changelog === 'string',
  )
  if (stable.length === 0) throw new Error('No stable releases with a changelog in the Wago page data')
  return stable.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}
