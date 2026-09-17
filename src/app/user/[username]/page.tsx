import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { cssUrl, sanitizeAvatarUrl, sanitizeBannerUrl } from '@/lib/url-safety'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import StatBlock from '@/components/ui/StatBlock'
import ProfileTabs, { type SequenceRowData } from './ProfileTabs'
import SocialLinksRow from './SocialLinksRow'
import { fetchCreatorViewTrend, fetchCreatorActivity } from '@/lib/creator-dashboard'
import type { SocialLinks } from '@/types'

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

export default async function UserProfilePage(props: Props) {
  const params = await props.params;
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, avatar_color, bio, battletag, created_at, banner_url, social_links, featured_sequence_id, discord_bridge_opted_out')
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
    .select('id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, avg_score, rating_count, view_count, save_count, comment_count, created_at')
    .eq('author_id', profile.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const seqs = sequences ?? []
  const initial = profile.username?.[0]?.toUpperCase() ?? '?'
  const displayColor = profile.avatar_color ?? '#1D9E75'
  const safeAvatarUrl = sanitizeAvatarUrl(profile.avatar_url)
  const safeBannerUrl = sanitizeBannerUrl(profile.banner_url)
  // The CSS token, not the bare URL. cssUrl returns the whole quoted
  // `url("...")` so there is no shape in which the value reaches a stylesheet
  // unquoted -- which is what audit F7.1 was. Null here falls through to the
  // gradient below exactly as a null banner_url always has.
  const bannerCss = cssUrl(safeBannerUrl)
  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

  // Owner's own dashboard data -- both reads are RLS-gated to "the
  // authenticated owner" (see migration 030), so there is no reason to even
  // attempt them for a visitor viewing someone else's profile; skipping the
  // query entirely for that case rather than fetching and getting an empty
  // result back is both faster and avoids two RLS-denied queries per page
  // view on every profile that isn't the viewer's own.
  const viewTrend = isOwnProfile ? await fetchCreatorViewTrend(supabase, seqs.map(s => s.id)) : []
  const activity = isOwnProfile ? await fetchCreatorActivity(supabase, profile.id) : []

  // Owner-only tabs folded in from the old /profile page (2026-09-14
  // consolidation) -- Drafts, Saved, and private sequences (merged inline
  // into the Sequences tab by ProfileTabs itself, tagged with status there).
  // Same isOwnProfile gate as viewTrend/activity above and the same reason:
  // these are either RLS-denied for a visitor or simply meaningless to fetch
  // for anyone but the profile's own owner.
  const { data: privateData } = isOwnProfile
    ? await supabase
        .from('sequences')
        .select('id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, avg_score, rating_count, view_count, created_at')
        .eq('author_id', profile.id)
        .eq('status', 'private')
        .order('created_at', { ascending: false })
    : { data: [] as never[] }
  const privateSeqs = privateData ?? []

  const { data: draftsData } = isOwnProfile
    ? await supabase
        .from('sequences')
        .select('id, title, class_name, class_id, spec_name, content_type, hero_talent, grip_string, collection_sequences, updated_at')
        .eq('author_id', profile.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
    : { data: [] as never[] }
  const drafts = draftsData ?? []

  // The inner author:profiles(...) needs !sequences_author_id_fkey to
  // disambiguate as of migration 030 -- see sequence-server.ts's
  // fetchSequencePage for the full explanation. sequence:sequences(...)
  // itself doesn't need a hint; saves has only one FK to sequences.
  const { data: savesData } = isOwnProfile
    ? await supabase
        .from('saves')
        .select('sequence:sequences(id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, avg_score, rating_count, view_count, created_at, author:profiles!sequences_author_id_fkey(username))')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
    : { data: [] as never[] }
  const savedSeqs = ((savesData ?? []) as unknown as { sequence: SequenceRowData | null }[])
    .map(s => s.sequence)
    .filter((s): s is SequenceRowData => s !== null)

  // Featured sequence: profile.featured_sequence_id is a bare FK with no DB
  // constraint tying it to "one of this profile's own published sequences"
  // (see migration 030's comment on why that's application-enforced, not a
  // DB constraint). This membership check against the already-published-
  // filtered `seqs` array IS that enforcement on the read side -- a stale or
  // tampered id that doesn't match a currently published sequence of this
  // profile's simply renders nothing, never a broken link.
  const featuredSeq = seqs.find(s => s.id === profile.featured_sequence_id) ?? null

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

      {/* Profile header. Banner + overlapping avatar is the "fuller
          redesign" Slowdog picked (2026-09-14) over a light-polish pass --
          the banner renders a flat gradient fallback rather than the
          avatar's solid-color fallback, deliberately: a banner is a big
          enough area that a flat brand color there would read as "broken
          image", where the avatar's small solid circle reads as a normal
          initial-avatar. */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 20,
        overflow: 'hidden',
      }}>
        <div style={{
          height: 150,
          background: bannerCss
            ? `${bannerCss} center/cover no-repeat`
            : 'linear-gradient(135deg, var(--accent-subtle), var(--bg-secondary))',
        }} />

        <div style={{ padding: '0 28px 28px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{
            width: 84, height: 84, borderRadius: '50%',
            background: safeAvatarUrl ? 'transparent' : displayColor,
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 700, color: 'white',
            border: '3px solid var(--bg-primary)', flexShrink: 0,
            marginTop: -42,
            boxShadow: '0 0 0 0.5px var(--border)',
          }}>
            {safeAvatarUrl
              ? <img src={safeAvatarUrl} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initial
            }
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 14 }}>
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
            <SocialLinksRow links={profile.social_links as SocialLinks} />
          </div>
        </div>
      </div>

      {/* Featured sequence -- only when featured_sequence_id resolves to a
          currently published sequence of this creator's own (see the
          featuredSeq computation above for why that membership check is the
          actual enforcement, not just a display nicety). */}
      {featuredSeq && (
        <Link href={`/sequences/${featuredSeq.slug}`} style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border)',
            borderLeft: `3px solid ${getClassColor(featuredSeq.class_id)}`,
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Featured sequence
              </span>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                {featuredSeq.title}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: getClassColor(featuredSeq.class_id) }}>{featuredSeq.class_name}</span>
                {featuredSeq.spec_name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {featuredSeq.spec_name}</span>}
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  · {CONTENT_TYPES.find(c => c.value === featuredSeq.content_type)?.label ?? featuredSeq.content_type}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
              {featuredSeq.view_count?.toLocaleString() ?? 0} views
            </div>
          </div>
        </Link>
      )}

      {/* Aggregate stats. Only rendered when there's at least one published
          sequence -- a brand new creator with zero posts gets no empty
          "0 views / 0 saves / no rating" row to look sparse over, the
          Sequences section's own "No sequences posted yet" message below
          already covers that case.

          Uses the shared StatBlock for the number/label rendering itself
          (kept consistent with the homepage redesign's numeral-first
          style), but wrapped here in this page's own bordered card with
          column dividers -- Slowdog's explicit call (2026-08-11) to keep
          this page's original boxed-stats look rather than StatBlock's
          bare inline look used elsewhere. StatBlock is intentionally left
          unmodified so the homepage and any other usage are unaffected;
          this wrapper is local to this page only. */}
      {seqs.length > 0 && (
        <div
          style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 0',
            marginBottom: 24,
            display: 'flex',
          }}
        >
          {[
            { value: totalViews.toLocaleString(), label: 'Total views' },
            { value: totalSaves.toLocaleString(), label: 'Total saves' },
            { value: avgRating != null ? avgRating.toFixed(1) : '—', label: 'Avg rating' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                textAlign: 'center',
                borderLeft: i > 0 ? '0.5px solid var(--border)' : 'none',
                // StatBlock's number div uses line-height: 1 at 36px/700,
                // which leaves no room for the font's ascender overshoot
                // and reads as clipped against a tight-fitting parent
                // (flagged by Slowdog from a live screenshot, 2026-08-11).
                // Not touching StatBlock itself since it's shared; instead
                // giving its rendered output some vertical room here, local
                // to this page's wrapper only.
                lineHeight: 1.4,
              }}
            >
              {/* align="center" here specifically because StatBlock's number
                  row is display:flex, and a flex container ignores the
                  parent div's textAlign -- that's the actual reason the big
                  numbers were rendering left-aligned inside a
                  textAlign:'center' wrapper. The label text below it was
                  fine, since it's a plain block element that respects
                  textAlign; only the numeral row needed the fix. */}
              <StatBlock stats={[stat]} align="center" />
            </div>
          ))}
        </div>
      )}

      <ProfileTabs
        seqs={seqs}
        comments={comments}
        isOwnProfile={isOwnProfile}
        viewTrend={viewTrend}
        activity={activity}
        privateSeqs={privateSeqs}
        drafts={drafts}
        savedSeqs={savedSeqs}
        viewerId={viewer?.id ?? null}
        settingsProfile={isOwnProfile ? {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          avatar_color: profile.avatar_color,
          bio: profile.bio,
          battletag: profile.battletag,
          banner_url: profile.banner_url,
          social_links: profile.social_links,
          featured_sequence_id: profile.featured_sequence_id,
          discord_bridge_opted_out: profile.discord_bridge_opted_out === true,
        } : null}
      />
    </div>
  )
}
