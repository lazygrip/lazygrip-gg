import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollText } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import ChangelogStyles from '@/components/changelog/ChangelogStyles'
import Fingerprint from '@/components/changelog/Fingerprint'
import VersionPicker from '@/components/changelog/VersionPicker'
import { EMS_LINKS, EMS_RELEASES, itemCount, versionSlug, type ArchivedRelease } from '@/lib/changelog/ems-archive'
import { matches } from '@/lib/changelog/areas'
import { toneOf } from '@/lib/changelog/tone'

const DESCRIPTION =
  'Every GRIP-EMS release since the first beta, written by Sataana, with search across all of it and a version picker that shows what you missed.'

export const metadata: Metadata = {
  title: 'EMS-Changelog',
  description: DESCRIPTION,
  alternates: { canonical: 'https://lazygrip.net/guide/ems-changelog' },
  openGraph: {
    title: 'EMS-Changelog',
    description: DESCRIPTION,
    url: 'https://lazygrip.net/guide/ems-changelog',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

const MAX_HITS = 60
const link = { color: 'var(--accent)' } as const
const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : ''
const fmtMonth = (d: string | null) =>
  d ? new Date(d.slice(0, 7) + '-15T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' }) : ''

function countsOf(r: ArchivedRelease) {
  return Object.fromEntries(r.sections.filter(s => s.items.length).map(s => [s.title, s.items.length]))
}

function ReleaseCard({ r, latest }: { r: ArchivedRelease; latest?: boolean }) {
  const counts = countsOf(r)
  const lead = r.sections.flatMap(s => s.items).find(i => i.lead)?.lead
  return (
    <Link prefetch={false} href={`/guide/ems-changelog/${versionSlug(r.version)}`} className={`cl-rel${latest ? ' cl-rel-latest' : ''}`}>
      <div className="cl-row">
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', fontSize: latest ? 'var(--text-xl, 1.4rem)' : 'var(--text-base)' }}>v{r.version}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{fmtDate(r.date)}</span>
        {latest && <span className="cl-pill cl-t-added">Latest</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(counts).map(([k, n]) => (
            <span key={k} className={`cl-pill cl-t-${toneOf(k)}`}>{n} {k.toLowerCase()}</span>
          ))}
        </span>
      </div>
      <div style={{ margin: '10px 0' }}><Fingerprint counts={counts} /></div>
      {lead && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{lead.replace(/[`*]/g, '')}</div>}
    </Link>
  )
}

export default async function EmsChangelogPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').trim().slice(0, 80)
  const hits = q
    ? EMS_RELEASES.flatMap(r =>
        r.sections.flatMap(s =>
          s.items.flatMap((item, i) => (matches(item, q) ? [{ r, s, item, id: `${s.title.toLowerCase().replace(/\W+/g, '-')}-${i + 1}` }] : [])),
        ),
      )
    : []
  const entries = EMS_RELEASES.reduce((n, r) => n + itemCount(r), 0)
  const picker = EMS_RELEASES.map(r => ({ version: r.version, slug: versionSlug(r.version), date: r.date, counts: countsOf(r) }))

  const [latest, ...rest] = EMS_RELEASES
  const months: { key: string; releases: ArchivedRelease[] }[] = []
  for (const r of rest) {
    const key = (r.date ?? '').slice(0, 7)
    if (months.at(-1)?.key !== key) months.push({ key, releases: [] })
    months.at(-1)!.releases.push(r)
  }

  return (
    <div>
      <ChangelogStyles />
      <PageHeader
        icon={ScrollText}
        title="EMS-Changelog"
        description="Every GRIP-EMS release, newest first, in the words of Sataana, the addon's author. Search all of it, or pick the version you are on to see everything you missed."
      />

      <Card style={{ padding: '20px 24px', marginBottom: 20 }}>
        <form action="/guide/ems-changelog" method="get" style={{ marginBottom: 20 }}>
          <label htmlFor="ems-q" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Search every release
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="ems-q" name="q" type="search" defaultValue={q} maxLength={80} className="cl-field" style={{ flex: 1, minWidth: 0 }}
              placeholder={`Search all ${entries.toLocaleString('en-US')} entries, for example reset timer or Tab`} />
            <button type="submit" style={{ padding: '9px 18px', fontSize: 'var(--text-sm)', fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Search</button>
          </div>
        </form>
        <VersionPicker releases={picker} />
      </Card>

      {q ? (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>
            {hits.length === 0
              ? `Nothing in any release mentions "${q}".`
              : `${hits.length} ${hits.length === 1 ? 'entry mentions' : 'entries mention'} "${q}"${hits.length > MAX_HITS ? `, showing the newest ${MAX_HITS}` : ''}.`}{' '}
            <Link href="/guide/ems-changelog" style={link}>Clear search</Link>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hits.slice(0, MAX_HITS).map(({ r, s, item, id }) => (
              <Link key={`${r.version}-${id}`} prefetch={false} href={`/guide/ems-changelog/${versionSlug(r.version)}#${id}`}
                className={`cl-card cl-t-${toneOf(s.title)}`} style={{ textDecoration: 'none', display: 'block', padding: '12px 18px' }}>
                <div className="cl-row">
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', fontSize: 'var(--text-sm)' }}>v{r.version}</span>
                  <span className="cl-pill">{s.title}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{fmtDate(r.date)}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {(item.lead ?? item.markdown).replace(/[`*]/g, '')}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ReleaseCard r={latest} latest />
          {months.map(m => (
            <div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 className="cl-month">{fmtMonth(m.releases[0].date)}</h2>
              {m.releases.map(r => <ReleaseCard key={r.version} r={r} />)}
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: 28, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        These notes are written by Sataana and reproduced here with his permission. The official releases live on{' '}
        <a href={EMS_LINKS.curseforge} target="_blank" rel="noopener noreferrer" style={link}>CurseForge</a>,{' '}
        <a href={EMS_LINKS.wago} target="_blank" rel="noopener noreferrer" style={link}>Wago</a> and{' '}
        <a href={EMS_LINKS.wowinterface} target="_blank" rel="noopener noreferrer" style={link}>WoWInterface</a>.
        Changes to this site itself are in the <Link href="/guide/lg-changelog" style={link}>LG-Changelog</Link>.
      </p>
    </div>
  )
}
