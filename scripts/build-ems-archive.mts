// Rebuilds src/data/ems-changelog.json from a local clone of the GRIP-EMS repository.
//
//   node --experimental-strip-types scripts/build-ems-archive.mts <path-to-GRIP-EMS-clone>
//
// CHANGELOG.md in that repository keeps only the current and previous release, so every
// earlier release is recovered from the file's own git history. Where a version appears in
// several commits the newest wording wins. Releases that were never given a date are left out.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { compareVersions, parseEmsChangelog, type EmsRelease } from '../src/lib/changelog/ems.ts'

const repo = process.argv[2]
if (!repo) {
  console.error('Usage: node --experimental-strip-types scripts/build-ems-archive.mts <path-to-GRIP-EMS-clone>')
  process.exit(1)
}

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: repo, maxBuffer: 1 << 28, encoding: 'utf8' })

const commits = git('log', '--format=%H', '--', 'CHANGELOG.md').trim().split('\n').filter(Boolean)
const byVersion = new Map<string, EmsRelease>()
for (const sha of commits) {
  // Newest first. A dated release replaces an undated draft of the same version, nothing else replaces anything.
  for (const r of parseEmsChangelog(git('show', `${sha}:CHANGELOG.md`)).releases) {
    const have = byVersion.get(r.version)
    if (!have || (!have.released && r.released)) byVersion.set(r.version, r)
  }
}

const releases = [...byVersion.values()]
  .filter(r => r.released)
  .sort((a, b) => compareVersions(b.version, a.version))
  .map(({ version, date, suffix, intro, sections }) => ({ version, date, suffix, intro, sections }))

const out = {
  // Where this came from, shown on the page.
  source: 'GRIP-EMS CHANGELOG.md and its git history',
  releases,
}
writeFileSync(new URL('../src/data/ems-changelog.json', import.meta.url), JSON.stringify(out) + '\n')
console.log(`${releases.length} releases, newest ${releases[0]?.version}, oldest ${releases.at(-1)?.version}`)
