import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import { formatDistanceToNow } from 'date-fns'
import { sanitizeAvatarUrl } from '@/lib/url-safety'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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
  const description = profile.bio
    ? profile.bio.slice(0, 155)
    : `WoW macro sequences shared by ${name} on LazyGrip.net. Free to import into GRIP-EMS.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://lazygrip.net/user/${params.username}`,
    },
    openGraph: {
      title,
      description,
      url: `https://lazygrip.net/user/${params.username}`,
      siteName: 'LazyGrip.net',
      type: 'profile',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
    },
  }
}

export default async function UserProfilePage({ params }: Props) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, avatar_color, bio, battletag, created_at')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  const { data: sequences } = await supabase
    .from('sequences')
    .select('id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, avg_score, rating_count, view_count, created_at')
    .eq('author_id', profile.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const seqs = sequences ?? []
  const initial = profile.username?.[0]?.toUpperCase() ?? '?'
  const displayColor = profile.avatar_color ?? '#1D9E75'
  const safeAvatarUrl = sanitizeAvatarUrl(profile.avatar_url)
  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

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
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>@{profile.username}</p>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Joined {joinDate}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{seqs.length} sequence{seqs.length !== 1 ? 's' : ''}</span>
            {profile.battletag && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile.battletag}</span>
            )}
          </div>
          {profile.bio && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Sequences */}
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
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
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No sequences posted yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {seqs.map(seq => (
            <SequenceRow key={seq.id} seq={seq} />
          ))}
        </div>
      )}
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
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {seq.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: classColor }}>{seq.class_name}</span>
            {seq.spec_name && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {seq.spec_name}</span>}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {contentLabel}</span>
            {seq.hero_talent && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {seq.hero_talent}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
          {seq.avg_score && seq.rating_count > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{seq.avg_score}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{seq.rating_count} ratings</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{seq.view_count?.toLocaleString() ?? 0} views</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(seq.created_at), { addSuffix: true })}</div>
          </div>
        </div>
      </div>
    </Link>
  )
}
