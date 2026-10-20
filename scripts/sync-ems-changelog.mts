// Brings src/data/ems-changelog.json up to date from Wago, with no token and nothing from the author.
//
//   node --experimental-strip-types scripts/sync-ems-changelog.mts            (fetches Wago)
//   node --experimental-strip-types scripts/sync-ems-changelog.mts page.html  (reads a saved copy)
//
// Wago's public releases page carries the full CHANGELOG.md that shipped with each release, so the
// newest release gives us the current and previous version exactly as the author wrote them. Older
// Wago releases are only used to fill versions we are missing, never to overwrite newer wording.
// The pages already render whatever is in the JSON, so a merged update is all the site needs.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { compareVersions, parseEmsChangelog } from '../src/lib/changelog/ems.ts'
import { mergeIncoming, readWagoReleases, type SyncResult } from '../src/lib/changelog/ems-sync.ts'

const URL_WAGO = 'https://addons.wago.io/addons/grip-ems/versions?stability=stable'
const FILE = new URL('../src/data/ems-changelog.json', import.meta.url)

const arg = process.argv[2]
let html: string
if (arg) {
  html = readFileSync(arg, 'utf8')
} else {
  const res = await fetch(URL_WAGO, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) throw new Error(`Wago answered ${res.status}`)
  html = await res.text()
}

const wago = readWagoReleases(html)
const archive = JSON.parse(readFileSync(FILE, 'utf8')) as { source: string; releases: SyncResult['releases'] }

const newest = parseEmsChangelog(wago[0].changelog)
for (const w of newest.warnings) console.log(`::warning::${w}`)
const label = wago[0].label.replace(/^v/, '')
if (!newest.releases.some(r => r.version === label)) {
  // The newest Wago release has no matching heading, so there is nothing trustworthy to add for it yet.
  console.log(`::warning::Wago's newest release is ${label} but its changelog has no section for it`)
}

let result = mergeIncoming(archive.releases, newest.releases, compareVersions)
const added = [...result.added]
const refreshed = [...result.refreshed]

// Catch up on anything older that a missed run left out. Add-only.
for (const w of wago.slice(1)) {
  const have = new Set(result.releases.map(r => r.version))
  const missing = parseEmsChangelog(w.changelog).releases.filter(r => !have.has(r.version))
  if (missing.length === 0) continue
  const step = mergeIncoming(result.releases, missing, compareVersions)
  result = step
  added.push(...step.added)
}

const changed = added.length > 0 || refreshed.length > 0
if (changed) {
  writeFileSync(FILE, JSON.stringify({ source: archive.source, releases: result.releases }) + '\n')
}

const summary = { changed, added, refreshed, newest: result.releases[0]?.version, total: result.releases.length }
console.log(JSON.stringify(summary))
// The workflow reads these to decide whether to open a pull request and what to say in it.
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `changed=${changed}\nadded=${added.join(', ')}\nrefreshed=${refreshed.join(', ')}\nnewest=${summary.newest}\n`,
  )
}
