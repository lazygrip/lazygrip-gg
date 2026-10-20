// Turns the raw commit list from GitHub into what the public LG-Changelog shows.
//
// The feed is built from commit messages, and commit messages written for maintainers are
// not always fit for a public page. Anything that reads as internal upkeep (database
// permissions, hardening work, migrations, tooling, dependency alerts) is replaced by one
// generic line per day instead of being shown. This is a deny list, so it can miss wording
// nobody has written yet. It lowers what the page gives away, and it does not replace
// writing public-facing commit messages in the first place.

export type Commit = { sha: string; message: string; date: string }
export type ChangelogDay = { date: string; entries: string[] }

export const UPKEEP_LINE = 'Behind-the-scenes upkeep'

const SKIP_PATTERNS: RegExp[] = [
  /^initial commit/i,
  /^add full lazygrip code/i,
  /^installed package/i,
  /^add missing tsconfig/i,
  /^merge/i,
]

const UPKEEP_PATTERNS: RegExp[] = [
  // access control, hardening and abuse handling
  /\b(rls|grants?|revoke[ds]?|definer|triggers?|csp|nonce|secrets?|dependabot|security|probes?|audit|allowlist|throttle|rate limit|leak\w*|holes?|bypass|exploit\w*|vulnerab\w*|injection|sanitiz\w*|dompurify|x-forwarded-for|unsafe-inline|script-src|env vars?|session|unbounded|allocate|decoder)\b/i,
  // database and schema work
  /\b(migrations?|ledger|reconciliation|schema|rpc|sql|supabase)\b/i,
  /\bpublic\.[a-z_]+/i,
  /\bcolumn[- ](level|scoped)\b/i,
  // internal identifiers: table, column and function names, and file names of scripts
  /\b[a-z0-9]+_[a-z0-9_]+\b/i,
  /\.(ps1|sql|mjs|cjs|ts|tsx|js)\b/i,
  // tooling and repository housekeeping
  /\b(commit-trailer|grip-tools|eslint|vitest|react compiler|line endings|workflow|readme|tarball|known-failure)\b/i,
]

/** What one commit should read as on the public page, or null when it should not appear. */
export function publicLabel(message: string): string | null {
  const text = message.trim()
  if (text === '' || SKIP_PATTERNS.some(p => p.test(text))) return null
  if (UPKEEP_PATTERNS.some(p => p.test(text))) return UPKEEP_LINE
  return text
}

/** Groups commits by day, newest day first, with upkeep collapsed to one line at the end of its day. */
export function groupForPublic(commits: Commit[]): ChangelogDay[] {
  const days = new Map<string, { visible: string[]; upkeep: boolean }>()
  for (const commit of commits) {
    const label = publicLabel(commit.message)
    if (label === null) continue
    const date = commit.date.slice(0, 10)
    const day = days.get(date) ?? { visible: [], upkeep: false }
    if (label === UPKEEP_LINE) day.upkeep = true
    else if (!day.visible.includes(label)) day.visible.push(label)
    days.set(date, day)
  }
  return [...days.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, day]) => ({
      date,
      entries: day.upkeep ? [...day.visible, UPKEEP_LINE] : day.visible,
    }))
}
