import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollText } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import VersionPicker from '@/components/changelog/VersionPicker'
import { EMS_LINKS, EMS_RELEASES, itemCount, versionSlug } from '@/lib/changelog/ems-archive'

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

export default function EmsChangelogPage() {
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
        description="Every GRIP-EMS release, newest first, in the words of Sataana, the addon's author. Pick the version you are on to see everything you missed."
      />

      <Card style={{ padding: '20px 24px', marginBottom: 16 }}>
        <VersionPicker releases={picker} />
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
