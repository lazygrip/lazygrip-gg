import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import { formatDistanceToNow } from 'date-fns'
import { sanitizeAvatarUrl } from '@/lib/url-safety'
import { MessageSquare } from 'lucide-react'

interface Props {
  params: Promise<{ username: string }>
}

const BIO_DESCRIPTION_MIN = 50
const BIO_DESCRIPTION_MAX = 155

/**
 * Turn a free-text profile bio into something safe to emit as a meta
 * description: no line breaks, no outbound URLs, and cut on a word boundary.
 * Returns null when the result is too thin to be worth using, so the caller
 * can fall back to the generated description.
 */
function bioToDescription(bio: string | null | undefined): string | null {
  if (!bio) return null

  const cleaned = bio
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length < BIO_DESCRIPTION_MIN) return null
  if (cleaned.length <= BIO_DESCRIPTION_MAX) return cleaned

  const head = cleaned.slice(0, BIO_DESCRIPTION_MAX + 1)
  const lastSpace = head.lastIndexOf(' ')
  const truncated = lastSpace > 0 ? head.slice(0, lastSpace) : cleaned.slice(0, BIO_DESCRIPTION_MAX)
  const trimmed = truncated.replace(/[\s,.;:!?-]+$/, '')

  // A bio like '-- ' followed by one very long token truncates to punctuation
  // only, which the trailing-punctuation strip then empties. Re-check the
  // floor so we always return either a usable string or null, never ''.
  return trimmed.length >= BIO_DESCRIPTION_MIN ? trimmed : null
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio')
    .eq('username', params.username)
    .single()

  if (!profile) {
    return { title: 'Profile Not Found' }
  }

  const name = profile.display_name || profile.username
  const title = `${name}'s GRIP-EMS Sequences`
  const description = bioToDescription(profile.bio)
    ?? `WoW macro sequences shared by ${name} on LazyGrip.net. Free to import into GRIP-EMS.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://lazygrip.net/user/${encodeURIComponent(params.username)}`,
    },
    openGraph: {
      title,
      description,
      url: `https://lazygrip.net/user/${encodeURIComponent(params.username)}`,
      siteName: 'LazyGrip.net',
      type: 'profile',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
    },
  }
}

function truncateCommentBody(body: string, max = 140): string {
  const cleaned = body.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const head = cleaned.slice(0, max + 1)
  const lastSpace = head.lastIndexOf(' ')
  const truncated = lastSpace > 0 ? head.slice(0, lastSpace) : cleaned.slice(0, max)
  return truncated.replace(/[\s,.;:!?-]+$/, '') + '…'
}

export default async function UserProfilePage(props: Props) {
  const params = await props.params;
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, avatar_color, bio, battletag, created_at')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  // Who's looking. Every existing auth.getUser() call in this codebase is
  // in a client component (checked 2026-08-11, none in a server component
  // until now) -- there's no established pattern to deviate from here, this
  // is just the first server component with a reason to know the viewer.
  // Safe to do here specifically because this route is server-rendered on
  // demand (confirmed 'ƒ' in the build output, not statically cached), so a
  // per-visitor auth read can't leak between visitors the way it would on a
  // cached or SSG route.
  const { data: { user: viewer } } = await supabase.auth.getUser()
  const isOwnProfile = viewer?.id === profile.id

  const { data: sequences } = await supabase
    .from('sequences')
    .select('id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, avg_score, rating_count, view_count, save_count, created_at')
    .eq('author_id', profile.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const seqs = sequences ?? []
  const initial = profile.username?.[0]?.toUpperCase() ?? '?'
  const displayColor = profile.avatar_color ?? '#1D9E75'
  const safeAvatarUrl = sanitizeAvatarUrl(profile.avatar_url)
  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

  // Recent comments this creator has left across the site, kohtas's "offer
  // support for our sequences" request read as: a visitor lands on a
  // creator's profile and can jump straight to things that creator said.
  // Includes replies as well as top-level comments (Slowdog's call,
  // 2026-08-11) -- a reply is still this person's words and still worth
  // surfacing. sequence:sequences!inner(...) with status eq published is
  // belt-and-braces: the sequence detail page 404s anything unpublished
  // already, so there is no reachable route to comment on a draft through
  // normal use, but a defensive filter costs nothing and means this can
  // never produce a link to a page that 404s.
  const { data: recentComments } = await supabase
    .from('comments')
    .select('id, body, created_at, sequence:sequences!inner(slug, title, status)')
    .eq('author_id', profile.id)
    .eq('is_deleted', false)
    .eq('sequence.status', 'published')
    .order('created_at', { ascending: false })
    .limit(10)

  const comments = (recentComments ?? []) as unknown as {
    id: string
    body: string
    created_at: string
    sequence: { slug: string; title: string; status: string }
  }[]

  // Aggregate stats across this creator's published sequences. Summed here
  // rather than tracked as a running total on profiles, since seqs is
  // already fetched in full for the list below -- same reasoning as
  // profile/page.tsx's per-tab counts, which sum client-side off the same
  // fetch rather than maintaining a separate counter column.
  const totalViews = seqs.reduce((sum, s) => sum + (s.view_count ?? 0), 0)
  const totalSaves = seqs.reduce((sum, s) => sum + (s.save_count ?? 0), 0)
  const ratedSeqs = seqs.filter(s => s.avg_score != null && s.rating_count > 0)
  // Average of each sequence's already-computed avg_score, not a re-derived
  // average from raw ratings -- this page has no access to the underlying
  // ratings rows, only the per-sequence rollup, so this is an average of
  // averages. Only sequences with at least one rating count toward it, so a
  // freshly posted 0-rating sequence doesn't drag the number toward null/0.
  const avgRating = ratedSeqs.length > 0
    ? (ratedSeqs.reduce((sum, s) => sum + s.avg_score, 0) / ratedSeqs.length)
    : null

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 24px' }}>

      {/* Profile header */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        marginBottom: 20,
        display: 'flex',
        gap: 20,
        alignItems: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: safeAvatarUrl ? 'transparent' : displayColor,
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700, color: 'white',
          border: '2px solid var(--border)', flexShrink: 0,
        }}>
          {safeAvatarUrl
            ? <img src={safeAvatarUrl} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initial
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            {profile.display_name || profile.username}
          </h1>
          {profile.display_name && (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', margin: '2px 0 0' }}>@{profile.username}</p>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Joined {joinDate}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{seqs.length} sequence{seqs.length !== 1 ? 's' : ''}</span>
            {profile.battletag && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{profile.battletag}</span>
            )}
          </div>
          {profile.bio && (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Aggregate stats. Only rendered when there's at least one published
          sequence -- a brand new creator with zero posts gets no empty
          "0 views / 0 saves / no rating" row to look sparse over, the
          Sequences section's own "No sequences posted yet" message below
          already covers that case. */}
      {seqs.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 0,
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 20,
          overflow: 'hidden',
        }}>
          <StatBlock label="Total views" value={totalViews.toLocaleString()} />
          <StatBlock label="Total saves" value={totalSaves.toLocaleString()} />
          <StatBlock label="Avg rating" value={avgRating != null ? avgRating.toFixed(1) : '—'} last />
        </div>
      )}

      {/* Sequences */}
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '.06em',
        marginBottom: 10,
      }}>
        Sequences
      </div>

      {seqs.length === 0 ? (
        <div style={{
          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '40px 24px', textAlign: 'center',
        }}>
          {isOwnProfile ? (
            <>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
                You haven't posted a sequence yet.
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 4 }}>
                Post your first one and this page fills in with your stats, comments, and more.
              </p>
              <Link href="/post" style={{
                display: 'inline-block',
                marginTop: 14,
                padding: '8px 16px',
                background: 'var(--accent)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
              }}>
                Post your first sequence
              </Link>
            </>
          ) : (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>No sequences posted yet.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {seqs.map(seq => (
            <SequenceRow key={seq.id} seq={seq} />
          ))}
        </div>
      )}

      {/* Recent comments by this creator, across any sequence, with a
          jump-link straight to each one -- kohtas's "offer support for our
          sequences" request, part 2. Only rendered when there's at least
          one, matching the same empty-state reasoning as the stats block
          above: nothing to say beats an empty box. */}
      {comments.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '.06em',
            marginBottom: 10,
          }}>
            Recent Comments
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comments.map(c => (
              <Link
                key={c.id}
                href={`/sequences/${c.sequence.slug}#comment-${c.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 16px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                }}>
                  <div style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
                    <MessageSquare size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      {truncateCommentBody(c.body)}
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        on {c.sequence.title}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBlock({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      flex: 1,
      padding: '18px 20px',
      textAlign: 'center',
      borderRight: last ? 'none' : '0.5px solid var(--border)',
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

function SequenceRow({ seq }: { seq: any }) {
  const classColor = getClassColor(seq.class_id)
  const contentLabel = CONTENT_TYPES.find(c => c.value === seq.content_type)?.label ?? seq.content_type

  return (
    <Link href={`/sequences/${seq.slug}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderLeft: `3px solid ${classColor}`,
          cursor: 'pointer',
          transition: 'box-shadow 0.15s',
        }}

      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {seq.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: classColor }}>{seq.class_name}</span>
            {seq.spec_name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {seq.spec_name}</span>}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {contentLabel}</span>
            {seq.hero_talent && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {seq.hero_talent}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
          {seq.avg_score && seq.rating_count > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{seq.avg_score}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{seq.rating_count} ratings</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{seq.view_count?.toLocaleString() ?? 0} views</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(seq.created_at), { addSuffix: true })}</div>
          </div>
        </div>
      </div>
    </Link>
  )
}
