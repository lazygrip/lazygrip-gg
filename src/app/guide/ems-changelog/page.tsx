import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollText } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import VersionPicker from '@/components/changelog/VersionPicker'
import { EMS_LINKS, EMS_RELEASES, itemCount, versionSlug } from '@/lib/changelog/ems-archive'
import { matches } from '@/lib/changelog/areas'

const DESCRIPTION =
  'Every GRIP-EMS release since the first beta, written by Sataana, with a version picker that shows what you missed.'

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

function formatDate(d: string | null) {
  return d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : ''
}

const MAX_HITS = 60

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
  const picker = EMS_RELEASES.map(r => ({
    version: r.version,
    slug: versionSlug(r.version),
    date: r.date,
    counts: Object.fromEntries(r.sections.filter(s => s.items.length).map(s => [s.title, s.items.length])),
  }))

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        title="EMS-Changelog"
        description="Every GRIP-EMS release, newest first, in the words of Sataana, the addon's author. Search all of it, or pick the version you are on to see everything you missed."
      />

      <Card style={{ padding: '20px 24px', marginBottom: 16 }}>
        <form action="/guide/ems-changelog" method="get" style={{ marginBottom: 20 }}>
          <label htmlFor="ems-q" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Search every release
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="ems-q" name="q" type="search" defaultValue={q} maxLength={80}
              placeholder={`Search all ${entries.toLocaleString('en-US')} entries, for example reset timer or Tab`}
              style={{ flex: 1, minWidth: 0, padding: '9px 12px', fontSize: 'var(--text-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '0.5px solid var(--border-strong)', borderRadius: 8 }}
            />
            <button type="submit" style={{ padding: '9px 16px', fontSize: 'var(--text-sm)', fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Search</button>
          </div>
        </form>
        <VersionPicker releases={picker} />
      </Card>

      {q && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>
            {hits.length === 0
              ? `Nothing in any release mentions "${q}".`
              : `${hits.length} ${hits.length === 1 ? 'entry mentions' : 'entries mention'} "${q}"${hits.length > MAX_HITS ? `, showing the newest ${MAX_HITS}` : ''}.`}{' '}
            <Link href="/guide/ems-changelog" style={{ color: 'var(--accent)' }}>Clear search</Link>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hits.slice(0, MAX_HITS).map(({ r, s, item, id }) => (
              <Card key={`${r.version}-${id}`} href={`/guide/ems-changelog/${versionSlug(r.version)}#${id}`} style={{ padding: '12px 18px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', fontSize: 'var(--text-sm)' }}>v{r.version}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{formatDate(r.date)} · {s.title}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {(item.lead ?? item.markdown).replace(/[`*]/g, '')}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: q ? 'none' : 'flex', flexDirection: 'column', gap: 10 }}>
        {EMS_RELEASES.map(r => {
          const lead = r.sections.flatMap(s => s.items).find(i => i.lead)?.lead
          return (
            <Card key={r.version} href={`/guide/ems-changelog/${versionSlug(r.version)}`} style={{ padding: '16px 22px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', fontSize: 'var(--text-base)' }}>v{r.version}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{formatDate(r.date)}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{itemCount(r)} {itemCount(r) === 1 ? 'entry' : 'entries'}</span>
              </div>
              {lead && (
                <div style={{ marginTop: 6, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {lead.replace(/[`*]/g, '')}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <p style={{ marginTop: 28, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        These notes are written by Sataana and reproduced here with his permission. The official releases live on{' '}
        <a href={EMS_LINKS.curseforge} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>CurseForge</a>,{' '}
        <a href={EMS_LINKS.wago} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Wago</a> and{' '}
        <a href={EMS_LINKS.wowinterface} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>WoWInterface</a>.
        Changes to this site itself are in the <Link href="/guide/lg-changelog" style={{ color: 'var(--accent)' }}>LG-Changelog</Link>.
      </p>
    </div>
  )
}
