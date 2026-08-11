import type { Metadata } from 'next'
import { GitCommit } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Recent changes to LazyGrip.net, pulled from the site repository commit history.',
  alternates: {
    canonical: 'https://lazygrip.net/changelog',
  },
  openGraph: {
    title: 'Changelog',
    description: 'Recent changes to LazyGrip.net, pulled from the site repository commit history.',
    url: 'https://lazygrip.net/changelog',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

const SKIP_PATTERNS = [
  /^initial commit/i,
  /^add full lazygrip code/i,
  /^installed package/i,
  /^add missing tsconfig/i,
  /^merge/i,
]

function shouldSkip(message: string) {
  return SKIP_PATTERNS.some(p => p.test(message.trim()))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function groupByDate(commits: { sha: string; message: string; date: string }[]) {
  const groups: Record<string, typeof commits> = {}
  for (const commit of commits) {
    const date = commit.date.slice(0, 10)
    if (!groups[date]) groups[date] = []
    groups[date].push(commit)
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

async function getCommits() {
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
    return (data as any[])
      .map((c: any) => ({
        sha: c.sha,
        message: c.commit.message.split('\n')[0].trim(),
        date: c.commit.author.date,
      }))
      .filter(c => !shouldSkip(c.message))
  } catch {
    return []
  }
}

export default async function ChangelogPage() {
  const commits = await getCommits()
  const grouped = groupByDate(commits)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <PageHeader
        icon={GitCommit}
        title="Changelog"
        description="Every change shipped to LazyGrip.net, pulled live from GitHub."
      />

      {grouped.length === 0 ? (
        <Card style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>Could not load changelog. Try again later.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(([date, entries]) => (
            <Card key={date} style={{ padding: '20px 24px' }}>
              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12,
              }}>
                {formatDate(date)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entries.map(commit => (
                  <div key={commit.sha} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--accent)', flexShrink: 0, marginTop: 6,
                    }} />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {commit.message}
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
