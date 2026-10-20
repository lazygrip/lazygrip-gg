import type { Metadata } from 'next'
import Link from 'next/link'
import { GitCommit } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import { groupForPublic, UPKEEP_LINE, type ChangelogDay, type Commit } from '@/lib/changelog/lg'
import { matches } from '@/lib/changelog/areas'

const DESCRIPTION =
  'Recent changes to LazyGrip.net, pulled from the site repository, with search and a link to every day. Behind-the-scenes upkeep is rolled into one line a day.'

export const metadata: Metadata = {
  title: 'LG-Changelog',
  description: DESCRIPTION,
  alternates: {
    canonical: 'https://lazygrip.net/guide/lg-changelog',
  },
  openGraph: {
    title: 'LG-Changelog',
    description: DESCRIPTION,
    url: 'https://lazygrip.net/guide/lg-changelog',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

// Five pages of 100 reaches back past the site's first public commits without a token.
const PAGES = 5
const MAX_HITS = 60

const day = (d: string) =>
  new Date(d.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
const month = (d: string) =>
  new Date(d.slice(0, 7) + '-15T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' })

async function getCommits(): Promise<Commit[]> {
  const pages = await Promise.all(
    Array.from({ length: PAGES }, async (_, i) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/lazygrip/lazygrip-gg/commits?per_page=100&page=${i + 1}`,
          { headers: { Accept: 'application/vnd.github+json' }, next: { revalidate: 3600 } },
        )
        if (!res.ok) return []
        const data = (await res.json()) as any[]
        return data.map(c => ({
          sha: c.sha as string,
          message: (c.commit.message as string).split('\n')[0].trim(),
          date: c.commit.author.date as string,
        }))
      } catch {
        return []
      }
    }),
  )
  return pages.flat()
}

export default async function LgChangelogPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').trim().slice(0, 80)
  const days: ChangelogDay[] = groupForPublic(await getCommits())

  const changes = days.reduce((n, d) => n + d.entries.filter(e => e !== UPKEEP_LINE).length, 0)
  const since = days.length ? days[days.length - 1].date : null

  const hits = q
    ? days.flatMap(d =>
        d.entries
          .filter(e => e !== UPKEEP_LINE && matches({ markdown: e, lead: null, body: e }, q))
          .map(entry => ({ date: d.date, entry })),
      )
    : []

  const months: { key: string; days: ChangelogDay[] }[] = []
  for (const d of days) {
    const key = d.date.slice(0, 7)
    if (months.at(-1)?.key !== key) months.push({ key, days: [] })
    months.at(-1)!.days.push(d)
  }

  return (
    <div>
      <PageHeader
        icon={GitCommit}
        title="LG-Changelog"
        description="Every change shipped to LazyGrip.net, newest first, pulled live from GitHub. Search it, or jump to a month. Behind-the-scenes upkeep is rolled into one line a day."
      />

      {days.length === 0 ? (
        <Card style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>Could not load the changelog. Try again later.</p>
        </Card>
      ) : (
        <>
          <Card style={{ padding: '20px 24px', marginBottom: 16 }}>
            <form action="/guide/lg-changelog" method="get">
              <label htmlFor="lg-q" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Search the changelog
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="lg-q" name="q" type="search" defaultValue={q} maxLength={80}
                  placeholder={`Search ${changes.toLocaleString('en-US')} changes, for example phones or profile`}
                  style={{ flex: 1, minWidth: 0, padding: '9px 12px', fontSize: 'var(--text-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '0.5px solid var(--border-strong)', borderRadius: 8 }}
                />
                <button type="submit" style={{ padding: '9px 16px', fontSize: 'var(--text-sm)', fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Search</button>
              </div>
            </form>
            {!q && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '6px 12px', borderRadius: 99, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>{changes}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>changes{since ? ` since ${month(since)}` : ''}</span>
                </span>
                {months.map(m => (
                  <a key={m.key} href={`#m-${m.key}`} style={{ padding: '6px 12px', borderRadius: 99, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                    {month(m.key + '-15')}
                  </a>
                ))}
              </div>
            )}
          </Card>

          {q ? (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>
                {hits.length === 0
                  ? `Nothing in the changelog mentions "${q}".`
                  : `${hits.length} ${hits.length === 1 ? 'change mentions' : 'changes mention'} "${q}"${hits.length > MAX_HITS ? `, showing the newest ${MAX_HITS}` : ''}.`}{' '}
                <Link href="/guide/lg-changelog" style={{ color: 'var(--accent)' }}>Clear search</Link>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hits.slice(0, MAX_HITS).map(({ date, entry }) => (
                  <Card key={`${date}-${entry}`} href={`/guide/lg-changelog#d-${date}`} style={{ padding: '12px 18px' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{day(date)}</div>
                    <div style={{ marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{entry}</div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {months.map(m => (
                <section key={m.key} id={`m-${m.key}`} style={{ scrollMarginTop: 90 }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
                    {month(m.key + '-15')}{' '}
                    <span style={{ fontWeight: 400 }}>({m.days.reduce((n, d) => n + d.entries.filter(e => e !== UPKEEP_LINE).length, 0)})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {m.days.map(({ date, entries }) => (
                      <Card key={date} style={{ padding: '18px 22px' }}>
                        <div id={`d-${date}`} style={{ scrollMarginTop: 90, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', fontSize: 'var(--text-sm)', marginBottom: 10 }}>
                          {day(date)}{' '}
                          <a href={`#d-${date}`} aria-label="Link to this day" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 400 }}>#</a>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {entries.map(entry => (
                            <div key={entry} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: entry === UPKEEP_LINE ? 'var(--text-muted)' : 'var(--accent)', flexShrink: 0, marginTop: 8 }} />
                              <span style={{ fontSize: 'var(--text-sm)', color: entry === UPKEEP_LINE ? 'var(--text-muted)' : 'var(--text-secondary)', lineHeight: 1.6 }}>{entry}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <p style={{ marginTop: 28, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Looking for what changed in the addon? That is the <Link href="/guide/ems-changelog" style={{ color: 'var(--accent)' }}>EMS-Changelog</Link>.
      </p>
    </div>
  )
}
