import type { Metadata } from 'next'
import { Users, Eye } from 'lucide-react'
import { fetchTopCreators } from '@/lib/home-stats'
import { sanitizeAvatarUrl } from '@/lib/url-safety'
import Card from '@/components/ui/Card'

// Public directory, no auth/cookies touched (fetchTopCreators runs through the
// same cookie-free createPublicClient() the homepage stat block uses). Rendered
// per request now, because the root layout needs a fresh CSP nonce on each
// response (see src/lib/csp.ts); an unstable_cache around fetchTopCreators is the
// way to restore the old 30-minute window if the traffic ever calls for it.

export const metadata: Metadata = {
  title: 'Creators',
  description: 'Browse GRIP-EMS sequence creators on LazyGrip.net, ranked by total views across their published sequences.',
  alternates: {
    canonical: 'https://lazygrip.net/creators',
  },
  openGraph: {
    title: 'Creators — LazyGrip.net',
    description: 'Browse GRIP-EMS sequence creators on LazyGrip.net, ranked by total views across their published sequences.',
    url: 'https://lazygrip.net/creators',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

// No limit/slice -- this is the "everyone" directory fetchTopCreators' own
// comment describes, as opposed to the homepage's top-10 leaderboard. 500 is
// a sanity ceiling rather than an expected real count; there is no pagination
// yet because the site has nowhere near enough published-sequence authors to
// need it.
export default async function CreatorsPage() {
  const creators = await fetchTopCreators(500)

  return (
    <div className="cr-page" style={{ maxWidth: 760, margin: '0 auto', padding: '36px 24px' }}>
      <style>{`
        /* Phone layout. Each row used to be rank, avatar, name and a stats block that refused to
           shrink, so the name column collapsed to nothing and the @username printed on top of the
           sequence count. Below 560px the row wraps: rank, avatar and name on the first line, the
           stats on a second line lined up under the name. */
        .cr-name > div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media (max-width: 560px) {
          .cr-page { padding: 20px 16px !important; }
          .cr-row { flex-wrap: wrap; row-gap: 6px !important; gap: 12px !important; }
          .cr-stats { flex: 0 0 calc(100% - 76px); min-width: 0; margin-left: 76px; justify-content: flex-start !important; gap: 16px !important; margin-top: -4px; }
          .cr-stats > div:first-child { display: flex; align-items: baseline; gap: 5px; text-align: left !important; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Users size={22} color="var(--accent)" />
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
          Creators
        </h1>
      </div>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.5 }}>
        Everyone who&apos;s published a GRIP-EMS sequence on LazyGrip.net, ranked by total views
        across their published work.
      </p>

      {creators.length === 0 ? (
        <Card style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
            No creators yet — be the first to post a sequence.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {creators.map((creator, i) => {
            const safeAvatarUrl = sanitizeAvatarUrl(creator.avatar_url)
            const displayColor = creator.avatar_color ?? '#1D9E75'
            const initial = creator.username[0]?.toUpperCase() ?? '?'
            return (
              <a key={creator.id} href={`/user/${creator.username}`} style={{ textDecoration: 'none' }}>
                <Card padding="sm" className="cr-row" style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <span style={{
                    width: 24, fontSize: 'var(--text-base)', fontWeight: 700,
                    color: i < 3 ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, textAlign: 'center',
                  }}>
                    {i + 1}
                  </span>

                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: safeAvatarUrl ? 'transparent' : displayColor,
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0,
                    border: '2px solid var(--border)',
                  }}>
                    {safeAvatarUrl
                      ? <img src={safeAvatarUrl} alt={creator.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initial
                    }
                  </div>

                  <div className="cr-name" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {creator.display_name || creator.username}
                    </div>
                    {creator.display_name && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>@{creator.username}</div>
                    )}
                  </div>

                  <div className="cr-stats" style={{ display: 'flex', gap: 18, flexShrink: 0, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {creator.sequenceCount}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        sequence{creator.sequenceCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', minWidth: 64, justifyContent: 'flex-end' }}>
                      <Eye size={13} />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {creator.totalViews.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Card>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
