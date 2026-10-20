import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Card from '@/components/ui/Card'
import ReleaseBody from '@/components/changelog/ReleaseBody'
import { EMS_LINKS, EMS_RELEASES, getRelease, itemCount, versionSlug } from '@/lib/changelog/ems-archive'

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

  const nav = (to: typeof r | undefined, label: string) =>
    to ? <Link prefetch={false} href={`/guide/ems-changelog/${versionSlug(to.version)}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 'var(--text-sm)' }}>{label} v{to.version}</Link> : <span />

  return (
    <div>
      <Link prefetch={false} href="/guide/ems-changelog" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
        <ChevronLeft size={14} /> EMS-Changelog
      </Link>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>
        GRIP-EMS <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>v{r.version}</span>
      </h1>
      <p style={{ margin: '8px 0 24px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        {date} · {itemCount(r)} {itemCount(r) === 1 ? 'entry' : 'entries'}
      </p>

      <Card style={{ padding: '22px 26px' }}>
        <ReleaseBody release={r} />
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 20 }}>
        {nav(older, '←')}
        {nav(newer, '→')}
      </div>

      <p style={{ marginTop: 28, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Written by Sataana and reproduced here with his permission. Get the addon from{' '}
        <a href={EMS_LINKS.curseforge} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>CurseForge</a>,{' '}
        <a href={EMS_LINKS.wago} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Wago</a> or{' '}
        <a href={EMS_LINKS.wowinterface} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>WoWInterface</a>.
      </p>
    </div>
  )
}
