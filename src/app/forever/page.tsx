import type { Metadata } from 'next'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase/public'
import { FOREVER_OBSERVATIONS, type ForeverObservationStatus } from '@/data/forever-observations'

// Only the cookie-free public client is used here, so the route stays cacheable. The count is the
// one live number on the page; the observations are a data file and change with a commit.
export const revalidate = 600

export const metadata: Metadata = {
  title: 'GRIP-EMS on WoW: Forever',
  description:
    'What has actually been confirmed about GRIP-EMS on WoW: Forever, how to find and post Forever sequences, and what is still untested.',
  alternates: { canonical: 'https://lazygrip.net/forever' },
  openGraph: {
    title: 'GRIP-EMS on WoW: Forever | LazyGrip.net',
    description:
      'What has actually been confirmed about GRIP-EMS on WoW: Forever, how to find and post Forever sequences, and what is still untested.',
    url: 'https://lazygrip.net/forever',
    siteName: 'LazyGrip.net',
    type: 'website',
  },
}

const STATUS_LABEL: Record<ForeverObservationStatus, string> = {
  confirmed: 'Confirmed',
  reported: 'Reported',
  unsettled: 'Unsettled',
  untested: 'Untested',
}

const STATUS_COLOR: Record<ForeverObservationStatus, string> = {
  confirmed: '#1D9E75',
  reported: '#5a8dee',
  unsettled: '#e0a020',
  untested: '#888',
}

async function countForeverSequences(): Promise<number | null> {
  try {
    const supabase = createPublicClient()
    const { count, error } = await supabase
      .from('sequences')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('game_version', 'forever')
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const link = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 } as const
const body = { color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 'var(--text-base)' } as const

export default async function ForeverPage() {
  const count = await countForeverSequences()

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px' }}>
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        WoW: Forever
      </p>
      <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 16 }}>
        GRIP-EMS on WoW: Forever
      </h1>
      <p style={{ ...body, marginBottom: 12 }}>
        Forever launches November 4, and this is where Forever sequences will live on LazyGrip, kept apart from retail so nobody copies a sequence built for the wrong client. Until real sequences have been run on it, this page is mostly a plain record of what has been confirmed and what has not, and it only says something is true once somebody has seen it happen.
      </p>
      <p style={{ ...body, marginBottom: 32 }}>
        The longer write-up, including the Blizzard addon rules and the save bug, is on the{' '}
        <Link href="/guide/wow-forever" style={link}>WoW: Forever guide page</Link>.
      </p>

      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>What has been observed</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {FOREVER_OBSERVATIONS.map(o => (
          <div key={o.id} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  color: STATUS_COLOR[o.status],
                  border: `0.5px solid ${STATUS_COLOR[o.status]}55`,
                  background: `${STATUS_COLOR[o.status]}18`,
                }}
              >
                {STATUS_LABEL[o.status]}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {formatDate(o.date)} · {o.source}
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{o.text}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 36 }}>
        Check the dates before you trust any of this as still current. The beta moves day to day.
      </p>

      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Forever sequences</h2>
      <p style={{ ...body, marginBottom: 12 }}>
        {count === null
          ? 'Forever sequences are listed separately from retail, and you can browse them with the Game filter.'
          : count === 0
            ? 'There are no Forever sequences on the site yet. None has been validated on a Forever client, and that is the bar they have to clear before they are called validated here, the same as everywhere else on the site.'
            : `There ${count === 1 ? 'is 1 Forever sequence' : `are ${count} Forever sequences`} on the site. Read the validation notes on each one, because a sequence only counts as validated if it was run on a Forever client.`}
      </p>
      <p style={{ ...body, marginBottom: 36 }}>
        <Link href="/browse?game_version=forever" style={link}>Browse Forever sequences</Link>
        {' '}(the plain Browse page shows retail only).
      </p>

      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Posting one</h2>
      <p style={{ ...body, marginBottom: 12 }}>
        Post it the way you post any sequence, then open it and set Game version to WoW: Forever. That control is only visible to you as the author, and until you set it the sequence is listed under retail. The post form still asks for a retail class and spec, because that is the model the site knows, and Forever may not fit it, so that part will change once it is measured and not before.
      </p>
      <p style={{ ...body, marginBottom: 0 }}>
        If you have tested something on the beta, tell us in the GRIP-EMS Discord with the date and what you ran, and it can go on the list above with your name on it.
      </p>
    </div>
  )
}
