import type { Metadata } from 'next'
import Link from 'next/link'
import { GitCommit } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import ChangelogStyles from '@/components/changelog/ChangelogStyles'
import Fingerprint from '@/components/changelog/Fingerprint'
import { groupForPublic, UPKEEP_LINE, type ChangelogDay, type Commit } from '@/lib/changelog/lg'
import { matches } from '@/lib/changelog/areas'
import { LG_AREAS, areaOfEntry, kindOf } from '@/lib/changelog/lg-tags'

const DESCRIPTION =
  'Recent changes to LazyGrip.net, pulled from the site repository, with search, a colour for each kind of change and a link to every day. Behind-the-scenes upkeep is rolled into one line a day.'

export const metadata: Metadata = {
  title: 'LG-Changelog',
  description: DESCRIPTION,
  alternates: { canonical: 'https://lazygrip.net/guide/lg-changelog' },
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
const TONE = { New: 'added', Changed: 'changed', Fixed: 'fixed', Removed: 'removed' } as Record<string, string>

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

function Entry({ entry }: { entry: string }) {
  if (entry === UPKEEP_LINE) {
    return <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>{entry}</div>
  }
  const kind = kindOf(entry)
  const area = areaOfEntry(entry)
  return (
    <div className="cl-row" style={{ alignItems: 'flex-start' }}>
      <span className={`cl-pill cl-t-${kind.tone}`} style={{ minWidth: 62, textAlign: 'center' }}>{kind.label}</span>
      <span style={{ flex: 1, minWidth: 200, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{entry}</span>
      {area !== 'Everything else' && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{area}</span>}
    </div>
  )
}

export default async function LgChangelogPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; area?: string | string[] }> }) {
  const params = await searchParams
  const q = ((Array.isArray(params.q) ? params.q[0] : params.q) ?? '').trim().slice(0, 80)
  const areaParam = Array.isArray(params.area) ? params.area[0] : params.area
  const area = areaParam && LG_AREAS.includes(areaParam) ? areaParam : null

  const allDays: ChangelogDay[] = groupForPublic(await getCommits())
  const visible = allDays.flatMap(d => d.entries.filter(e => e !== UPKEEP_LINE))
  const since = allDays.length ? allDays[allDays.length - 1].date : null

  const kindCounts: Record<string, number> = { New: 0, Changed: 0, Fixed: 0, Removed: 0 }
  const areaCounts = new Map<string, number>()
  for (const e of visible) {
    kindCounts[kindOf(e).label]++
    areaCounts.set(areaOfEntry(e), (areaCounts.get(areaOfEntry(e)) ?? 0) + 1)
  }

  const days: ChangelogDay[] = area
    ? allDays.map(d => ({ date: d.date, entries: d.entries.filter(e => e !== UPKEEP_LINE && areaOfEntry(e) === area) })).filter(d => d.entries.length)
    : allDays

  const hits = q
    ? allDays.flatMap(d =>
        d.entries.filter(e => e !== UPKEEP_LINE && matches({ markdown: e, lead: null, body: e }, q)).map(entry => ({ date: d.date, entry })),
      )
    : []

  const months: { key: string; days: ChangelogDay[] }[] = []
  for (const d of days) {
    const key = d.date.slice(0, 7)
    if (months.at(-1)?.key !== key) months.push({ key, days: [] })
    months.at(-1)!.days.push(d)
  }
  const link = { color: 'var(--accent)' } as const

  return (
    <div>
      <ChangelogStyles />
      <PageHeader
        icon={GitCommit}
        title="LG-Changelog"
        description="Every change shipped to LazyGrip.net, newest first, pulled live from GitHub. Search it, filter by part of the site, or jump to a month. Behind-the-scenes upkeep is rolled into one line a day."
      />

      {allDays.length === 0 ? (
        <Card style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>Could not load the changelog from GitHub. Try again in a few minutes.</p>
        </Card>
      ) : (
        <>
          <Fingerprint counts={kindCounts} height={10} />
          <div className="cl-tiles" style={{ marginTop: 16 }}>
            {Object.entries(kindCounts).filter(([, n]) => n > 0).map(([k, n]) => (
              <div key={k} className={`cl-tile cl-t-${TONE[k]}`}>
                <b>{n}</b>
                <span>{k}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 22px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {visible.length} changes since {since ? month(since) : 'the start'}. The kind of change is read from the wording of each line.
          </p>

          <Card style={{ padding: '20px 24px', marginBottom: 20 }}>
            <form action="/guide/lg-changelog" method="get">
              <label htmlFor="lg-q" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Search the changelog
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="lg-q" name="q" type="search" defaultValue={q} maxLength={80} className="cl-field" style={{ flex: 1, minWidth: 0 }}
                  placeholder={`Search ${visible.length.toLocaleString('en-US')} changes, for example phones or profile`} />
                <button type="submit" style={{ padding: '9px 18px', fontSize: 'var(--text-sm)', fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Search</button>
              </div>
            </form>
            {!q && (
              <div role="group" aria-label="Filter by part of the site" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                {LG_AREAS.filter(a => a !== 'Everything else' && areaCounts.has(a)).map((a, i) => (
                  <Link key={a} prefetch={false} href={area === a ? '/guide/lg-changelog' : `/guide/lg-changelog?area=${encodeURIComponent(a)}`}
                    className={`cl-chip cl-a-${i}`} aria-pressed={area === a}>
                    {a} <small>{areaCounts.get(a)}</small>
                  </Link>
                ))}
                {area && <Link href="/guide/lg-changelog" className="cl-btn" style={{ textDecoration: 'none' }}>Show all</Link>}
              </div>
            )}
          </Card>

          {q ? (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>
                {hits.length === 0
                  ? `Nothing in the changelog mentions "${q}".`
                  : `${hits.length} ${hits.length === 1 ? 'change mentions' : 'changes mention'} "${q}"${hits.length > MAX_HITS ? `, showing the newest ${MAX_HITS}` : ''}.`}{' '}
                <Link href="/guide/lg-changelog" style={link}>Clear search</Link>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hits.slice(0, MAX_HITS).map(({ date, entry }) => (
                  <Link key={`${date}-${entry}`} href={`/guide/lg-changelog#d-${date}`} className={`cl-card cl-t-${kindOf(entry).tone}`}
                    style={{ textDecoration: 'none', display: 'block', padding: '12px 18px' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>{day(date)}</div>
                    <Entry entry={entry} />
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {months.length === 0 && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>No changes in this part of the site yet.</p>}
              {months.map(m => (
                <section key={m.key} id={`m-${m.key}`} style={{ scrollMarginTop: 90 }}>
                  <h2 className="cl-month" style={{ marginBottom: 12 }}>{month(m.key + '-15')}</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {m.days.map(({ date, entries }) => (
                      <article key={date} id={`d-${date}`} className="cl-card cl-t-changed" style={{ scrollMarginTop: 90 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
                          {day(date)}
                          <a href={`#d-${date}`} className="cl-anchor" aria-label="Link to this day">#</a>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {entries.map(entry => <Entry key={entry} entry={entry} />)}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <p style={{ marginTop: 28, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Looking for what changed in the addon? That is the <Link href="/guide/ems-changelog" style={link}>EMS-Changelog</Link>.
      </p>
    </div>
  )
}
