import { describe, expect, it } from 'vitest'
import { UPKEEP_LINE, groupForPublic, publicLabel } from './lg'

// Real message shapes from the public commit history. The first group is what visitors
// should keep seeing word for word, the second is what must never reach the page.
const VISIBLE = [
  'Make the site usable on phones',
  'Add WoW: Forever compatibility guide page',
  'Keep old profile URLs working after a username rename',
  'Let password reset links work on any device and survive email link scanners',
  'Show a plain message when a sign in is refused instead of hanging',
  'Switch site fonts to Saira and JetBrains Mono and enlarge small text',
  'Auto-update GRIP-EMS version to v2.4.21 (#100)',
  'Fix collection sequence version data corruption bug',
  'Hide the scrolling ticker rows on the home page on phones',
  'Require a spec to publish, and keep empty hubs out of the sitemap',
]

const UPKEEP = [
  'Revoke unused anonymous write grants and lock the remaining throttle tables',
  'Lock down the nine trigger-only functions and add a test that fires every trigger',
  'Drop unsafe-inline from script-src by giving every page a per-request nonce',
  'Fail closed on an unset CRON_SECRET, and refuse an unknown slug in notify-discord (#63)',
  'Counter integrity, self-rating, a comment rate limit, and the draft-to-Discord hole',
  'Record eleven migration files that have no ledger row, including the revoke applied by hand today',
  'Pin postcss-selector-parser to 7.1.6 to clear two Dependabot alerts',
  'Update sharp and related packages to clear two high severity audit findings',
  'Column-level grants on public.profiles, and terms acceptance as an RPC (#69)',
  'Fix publish_draft_sequence silently keeping a mismatched slug on collision',
  'Drop the personal local path from check-site.ps1',
  'Cap the decoder and the builder so a small request cannot allocate a large one (#64)',
  'Add the commit-trailer gate: workflow and checker copies from GRIP-Tools 4c35e23',
  'Move to ESLint 9 and eslint-config-next 16, and drop legacy-peer-deps',
]

describe('publicLabel', () => {
  it('keeps user-facing messages exactly as written', () => {
    for (const message of VISIBLE) expect(publicLabel(message)).toBe(message)
  })

  it('replaces internal upkeep with one generic line', () => {
    for (const message of UPKEEP) expect(publicLabel(message)).toBe(UPKEEP_LINE)
  })

  it('drops merge commits and the early scaffolding commits', () => {
    expect(publicLabel('Merge pull request #97 from lazygrip/ledger-import')).toBeNull()
    expect(publicLabel('Initial commit')).toBeNull()
    expect(publicLabel('   ')).toBeNull()
  })
})

describe('groupForPublic', () => {
  it('collapses upkeep to a single line at the end of its day and sorts newest first', () => {
    const days = groupForPublic([
      { sha: 'a', message: 'Revoke unused anonymous write grants', date: '2026-10-11T10:00:00Z' },
      { sha: 'b', message: 'Make the site usable on phones', date: '2026-10-11T09:00:00Z' },
      { sha: 'c', message: 'Lock down the nine trigger-only functions', date: '2026-10-11T08:00:00Z' },
      { sha: 'd', message: 'Add WoW: Forever compatibility guide page', date: '2026-10-14T08:00:00Z' },
    ])
    expect(days.map(d => d.date)).toEqual(['2026-10-14', '2026-10-11'])
    expect(days[1].entries).toEqual(['Make the site usable on phones', UPKEEP_LINE])
  })

  it('never lets a hidden message text appear in the output', () => {
    const days = groupForPublic(UPKEEP.map((message, i) => ({ sha: String(i), message, date: '2026-10-01T00:00:00Z' })))
    expect(days).toEqual([{ date: '2026-10-01', entries: [UPKEEP_LINE] }])
  })

  it('removes a day that has nothing left to show', () => {
    expect(groupForPublic([{ sha: 'm', message: 'Merge pull request #1', date: '2026-10-02T00:00:00Z' }])).toEqual([])
  })

  it('shows a repeated message once per day', () => {
    const days = groupForPublic([
      { sha: '1', message: 'Make the site usable on phones', date: '2026-10-14T01:00:00Z' },
      { sha: '2', message: 'Make the site usable on phones', date: '2026-10-14T02:00:00Z' },
    ])
    expect(days[0].entries).toEqual(['Make the site usable on phones'])
  })
})
