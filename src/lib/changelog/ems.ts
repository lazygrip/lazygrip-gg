// Reads the GRIP-EMS CHANGELOG.md exactly as its author writes it. No format was agreed with
// him on purpose, so everything here is tolerant: a heading style we have not seen, a section
// we do not recognise or an odd line never throws, it just lands in the nearest sensible place
// and, if nothing sensible exists, in `warnings` so a sync job can say so out loud.

export type EmsItem = {
  // The full entry as written, markdown intact. Always safe to show if the split below fails.
  markdown: string
  // The bold opening sentence ("**A step can have its own key.**") without the asterisks, when there is one.
  lead: string | null
  // Everything after the lead, markdown intact.
  body: string
}

export type EmsSection = {
  // "Added", "Changed", "Fixed" and so on, exactly as written.
  title: string
  items: EmsItem[]
}

export type EmsRelease = {
  version: string
  date: string | null
  released: boolean
  // The part after the number, such as "hotfix" or "beta", when there is one.
  suffix: string | null
  // Text between the release heading and the first ### heading, if any.
  intro: string
  sections: EmsSection[]
  // The release block verbatim, heading included. The archive stores this next to the parsed form.
  raw: string
}

export type EmsChangelog = {
  meta: { updated: string | null; wowPatch: string | null }
  releases: EmsRelease[]
  warnings: string[]
}

const VERSION = /v?(\d+\.\d+\.\d+)([-+][0-9A-Za-z.]+)?/
const DATE = /(\d{4}-\d{2}-\d{2})/
const UNRELEASED = /unreleased|\btbd\b/i

function unescapeMd(s: string): string {
  return s.replace(/\\([[\]()_*`#.!-])/g, '$1')
}

function splitLead(markdown: string): { lead: string | null; body: string } {
  const m = /^\*\*([\s\S]+?)\*\*\s*([\s\S]*)$/.exec(markdown)
  if (!m) return { lead: null, body: markdown }
  return { lead: m[1].trim(), body: m[2].trim() }
}

function parseItems(lines: string[]): EmsItem[] {
  const chunks: string[][] = []
  let current: string[] | null = null
  for (const line of lines) {
    if (/^[-*]\s+/.test(line)) {
      current = [line.replace(/^[-*]\s+/, '')]
      chunks.push(current)
    } else if (current) {
      // Continuation, nested bullet or blank line inside an entry.
      current.push(line)
    } else if (line.trim() !== '') {
      // Prose before any bullet: keep it as its own entry instead of dropping it.
      current = [line]
      chunks.push(current)
    }
  }
  return chunks
    .map(c => c.join('\n').trim())
    .filter(Boolean)
    .map(markdown => ({ markdown, ...splitLead(markdown) }))
}

function parseRelease(block: string[], warnings: string[]): EmsRelease | null {
  const heading = unescapeMd(block[0].replace(/^##\s+/, '')).trim()
  const v = VERSION.exec(heading)
  if (!v) {
    // "## [Unreleased]" with no number is a scratch area, not a release.
    if (!UNRELEASED.test(heading)) warnings.push(`Skipped a ## heading with no version: "${heading}"`)
    return null
  }
  const date = DATE.exec(heading)?.[1] ?? null
  const released = !UNRELEASED.test(heading) && date !== null

  const introLines: string[] = []
  const sections: { title: string; lines: string[] }[] = []
  for (const line of block.slice(1)) {
    const h = /^###\s+(.*)$/.exec(line)
    if (h) sections.push({ title: unescapeMd(h[1]).trim(), lines: [] })
    else if (sections.length) sections[sections.length - 1].lines.push(line)
    else introLines.push(line)
  }

  const parsed = sections.map(s => ({ title: s.title, items: parseItems(s.lines) }))
  let intro = introLines.join('\n').trim()
  if (parsed.length === 0) {
    const items = parseItems(introLines)
    if (items.length) parsed.push({ title: 'Notes', items })
    intro = ''
    warnings.push(`v${v[1]}${v[2] ?? ''} has no ### sections, kept as one Notes section`)
  }

  return {
    version: v[1] + (v[2] ?? ''),
    date,
    released,
    suffix: v[2] ? v[2].replace(/^[-+]/, '') : null,
    intro,
    sections: parsed,
    raw: block.join('\n').trimEnd(),
  }
}

export function parseEmsChangelog(source: string): EmsChangelog {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const warnings: string[] = []

  const meta = { updated: null as string | null, wowPatch: null as string | null }
  for (const line of lines) {
    if (/^##\s/.test(line)) break
    const u = /^>\s*\*\*Updated:\*\*\s*(.+)$/.exec(line)
    if (u) meta.updated = u[1].trim()
    const w = /^>\s*\*\*WoW Patch at last update:\*\*\s*(.+)$/.exec(line)
    if (w) meta.wowPatch = w[1].trim()
  }

  const blocks: string[][] = []
  let fence = false
  for (const line of lines) {
    if (/^```/.test(line)) fence = !fence
    if (!fence && /^##\s/.test(line)) blocks.push([line])
    else if (blocks.length) blocks[blocks.length - 1].push(line)
  }

  const releases: EmsRelease[] = []
  for (const b of blocks) {
    const r = parseRelease(b, warnings)
    if (r) releases.push(r)
  }
  if (blocks.length > 0 && releases.length === 0) warnings.push('Found ## headings but no release could be read')
  return { meta, releases, warnings }
}

// Orders versions for the archive: 2.4.21 after 2.4.9, a hotfix after its plain release and a beta before it.
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[-+]/)[0].split('.').map(Number)
  const pb = b.split(/[-+]/)[0].split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  }
  const sa = /[-+]/.test(a)
  const sb = /[-+]/.test(b)
  if (sa === sb) return 0
  const isPre = (v: string) => /[-+](alpha|beta|rc|pre)/i.test(v)
  if (sa) return isPre(a) ? -1 : 1
  return isPre(b) ? 1 : -1
}
