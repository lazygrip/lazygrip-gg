import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ChangelogStyles from '@/components/changelog/ChangelogStyles'
import Fingerprint from '@/components/changelog/Fingerprint'
import Highlights from '@/components/changelog/Highlights'
import ReleaseView from '@/components/changelog/ReleaseView'
import GrabIt from '@/components/changelog/GrabIt'
import { EMS_AUTHOR_NOTES, EMS_HIGHLIGHTS } from '@/data/ems-highlights'
import { EMS_RELEASES, getRelease, itemCount, versionSlug } from '@/lib/changelog/ems-archive'
import { toneOf } from '@/lib/changelog/tone'

type Params = { version: string }

export const dynamicParams = false

export function generateStaticParams(): Params[] {
  return EMS_RELEASES.map(r => ({ version: versionSlug(r.version) }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { version } = await params
  const r = getRelease(version)
  if (!r) return {}
  const title = `GRIP-EMS v${r.version} changelog`
  const description = `What changed in GRIP-EMS v${r.version}${r.date ? `, released ${r.date}` : ''}: ${itemCount(r)} entries.`
  const url = `https://lazygrip.net/guide/ems-changelog/${versionSlug(r.version)}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'LazyGrip.net', type: 'article' },
  }
}

export default async function EmsReleasePage({ params }: { params: Promise<Params> }) {
  const { version } = await params
  const r = getRelease(version)
  if (!r) notFound()
  const i = EMS_RELEASES.indexOf(r)
  const newer = EMS_RELEASES[i - 1]
  const older = EMS_RELEASES[i + 1]
  const date = r.date
    ? new Date(r.date + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : ''
  const counts = Object.fromEntries(r.sections.filter(s => s.items.length).map(s => [s.title, s.items.length]))
  const highlights = EMS_HIGHLIGHTS[r.version]

  const nav = (to: typeof r | undefined, dir: 'older' | 'newer') =>
    to ? (
      <Link prefetch={false} href={`/guide/ems-changelog/${versionSlug(to.version)}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', textDecoration: 'none', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
        {dir === 'older' && <ChevronLeft size={16} />}v{to.version}{dir === 'newer' && <ChevronRight size={16} />}
      </Link>
    ) : <span />

  return (
    <div>
      <ChangelogStyles />
      <Link prefetch={false} href="/guide/ems-changelog" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
        <ChevronLeft size={14} /> EMS-Changelog
      </Link>

      <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
        GRIP-EMS <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>v{r.version}</span>
      </h1>
      <p style={{ margin: '8px 0 18px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        Released {date}. {itemCount(r)} {itemCount(r) === 1 ? 'entry' : 'entries'} in the author&apos;s notes.
      </p>

      <Fingerprint counts={counts} height={10} />
      <div className="cl-tiles" style={{ marginTop: 16 }}>
        {r.sections.filter(s => s.items.length).map(s => (
          <a key={s.title} href={`#sec-${s.title.toLowerCase().replace(/\W+/g, '-')}`} className={`cl-tile cl-t-${toneOf(s.title)}`}>
            <b>{s.items.length}</b>
            <span>{s.title}</span>
          </a>
        ))}
      </div>

      {highlights && <Highlights items={highlights} />}
      <ReleaseView release={r} />

      <GrabIt authorNote={EMS_AUTHOR_NOTES[r.version]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 36 }}>
        {nav(older, 'older')}
        {nav(newer, 'newer')}
      </div>

      <p style={{ marginTop: 20, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Release notes written by Sataana and reproduced here with his permission.
      </p>
    </div>
  )
}
