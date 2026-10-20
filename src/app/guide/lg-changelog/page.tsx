import type { Metadata } from 'next'
import { GitCommit } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import { groupForPublic, type Commit } from '@/lib/changelog/lg'

const DESCRIPTION =
  'Recent changes to LazyGrip.net, pulled from the site repository. Behind-the-scenes upkeep is rolled into one line a day.'

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function getCommits(): Promise<Commit[]> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/lazygrip/lazygrip-gg/commits?per_page=100',
      {
        headers: { Accept: 'application/vnd.github+json' },
        next: { revalidate: 3600 }, // cache for 1 hour
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data as any[]).map((c: any) => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0].trim(),
      date: c.commit.author.date,
    }))
  } catch {
    return []
  }
}

export default async function LgChangelogPage() {
  const days = groupForPublic(await getCommits())

  return (
    <div>
      <PageHeader
        icon={GitCommit}
        title="LG-Changelog"
        description="Every change shipped to LazyGrip.net, newest first, pulled live from GitHub. Behind-the-scenes upkeep is rolled into one line a day."
      />

      {days.length === 0 ? (
        <Card style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>Could not load the changelog. Try again later.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {days.map(({ date, entries }) => (
            <Card key={date} style={{ padding: '20px 24px' }}>
              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12,
              }}>
                {formatDate(date)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entries.map(entry => (
                  <div key={entry} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--accent)', flexShrink: 0, marginTop: 6,
                    }} />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {entry}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
