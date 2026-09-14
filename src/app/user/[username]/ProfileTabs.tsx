'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, MessageCircle, Reply, Star, Bell } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import type { ViewTrendPoint, ActivityItem } from '@/lib/creator-dashboard'

// Client component: the page itself (page.tsx) stays a server component so
// generateMetadata and the initial Supabase reads keep running server-side
// -- this only exists because tab switching needs client state, and rather
// than convert the whole page to 'use client' (losing the server-rendered
// SEO metadata this page was specifically built to carry), the tabbed
// section is split out and handed its data as props instead. Same pattern
// profile/page.tsx already uses for SettingsTab.

type SequenceRowData = {
  id: string
  title: string
  slug: string
  class_name: string
  class_id: number
  spec_name: string | null
  content_type: string | null
  hero_talent: string | null
  avg_score: number | null
  rating_count: number | null
  view_count: number | null
  save_count?: number | null
  comment_count?: number | null
  created_at: string
}

type CommentRowData = {
  id: string
  body: string
  created_at: string
  sequence: { slug: string; title: string; status: string }
}

interface ProfileTabsProps {
  seqs: SequenceRowData[]
  comments: CommentRowData[]
  isOwnProfile: boolean
  // Both empty arrays for a visitor viewing someone else's profile -- see
  // page.tsx's isOwnProfile gate on the fetch calls. Optional so nothing
  // else calling this component (there is no other caller today, but this
  // keeps the props additive rather than a breaking change) needs updating.
  viewTrend?: ViewTrendPoint[]
  activity?: ActivityItem[]
}

// Moved here from page.tsx: functions cannot cross the server/client prop
// boundary in the App Router (confirmed live, 2026-08-11 -- a real runtime
// error, not caught by tsc or `next build`'s static generation pass, only
// surfaced on an actual page load). This is a pure function with no
// server-only dependency, so it belongs wherever it's actually called
// rather than being passed down at all.
function truncateCommentBody(body: string, max = 140): string {
  const cleaned = body.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const head = cleaned.slice(0, max + 1)
  const lastSpace = head.lastIndexOf(' ')
  const truncated = lastSpace > 0 ? head.slice(0, lastSpace) : cleaned.slice(0, max)
  return truncated.replace(/[\s,.;:!?-]+$/, '') + '…'
}

export default function ProfileTabs({ seqs, comments, isOwnProfile, viewTrend = [], activity = [] }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<'sequences' | 'comments' | 'dashboard'>('sequences')
  const [chatOpen, setChatOpen] = useState(false)

  // REWORKED 2026-08-11: the first two attempts at "chat on the right side"
  // put chat in its own full-height box next to the sequences list. Both
  // times the actual result crowded the page (sequence titles wrapping mid-
  // word once the left column lost width to a ~300px box that was mostly
  // empty dashed border). The instruction was always right -- chat belongs
  // on the right side of the tab row -- the execution was wrong. This
  // version keeps chat on the right, in the same row as the tabs, as a
  // small button that opens a panel on click rather than a box that's
  // always fully expanded and competing for width whether anyone's using it
  // or not.
  return (
    <div>
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '0.5px solid var(--border)',
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 0 }}>
          <TabButton
            label={`Sequences (${seqs.length})`}
            active={activeTab === 'sequences'}
            onClick={() => setActiveTab('sequences')}
          />
          <TabButton
            label={`Comments (${comments.length})`}
            active={activeTab === 'comments'}
            onClick={() => setActiveTab('comments')}
          />
          {/* Owner-only -- the underlying data (viewTrend, activity) is
              RLS-gated to the authenticated owner anyway (page.tsx never
              even queries it for a visitor), but the tab itself is hidden
              rather than shown-empty so a visitor never sees a "Dashboard"
              tab that would just 404-shaped-empty for them. */}
          {isOwnProfile && (
            <TabButton
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
            />
          )}
        </div>
        {/* Deliberately styled unlike TabButton (pill, not underline) so it
            doesn't read as a third piece of content to switch between --
            clicking it opens a panel, it doesn't replace what's showing. */}
        <button
          onClick={() => setChatOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            marginBottom: 6,
            background: chatOpen ? 'var(--accent-subtle)' : 'var(--bg-primary)',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 999,
            color: chatOpen ? 'var(--accent-text)' : 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <MessageCircle size={13} />
          Chat
        </button>
      </div>

      {chatOpen && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px dashed var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--text-muted)',
        }}>
          <MessageCircle size={16} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
            Chat with {isOwnProfile ? 'creators' : 'this creator'} — coming soon.
          </p>
        </div>
      )}

        {activeTab === 'dashboard' ? (
          <DashboardTab seqs={seqs} viewTrend={viewTrend} activity={activity} />
        ) : activeTab === 'sequences' ? (
          seqs.length === 0 ? (
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
          )
        ) : (
          comments.length === 0 ? (
            <div style={{
              background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '40px 24px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
                {isOwnProfile ? "You haven't commented on anything yet." : 'No comments yet.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {comments.map(c => (
                <Link
                  key={c.id}
                  href={`/sequences/${c.sequence.slug}#comment-${c.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  {/* Deliberately distinct from SequenceRow's look, not just a
                      variant of it: Slowdog tested clicking a sequence card
                      expecting comment-jump behavior, which means the two
                      card types read as interchangeable at a glance. Left
                      border in the accent color (sequence cards use the
                      class color instead, never accent) and an explicit
                      "Jump to comment" label do the disambiguating work that
                      the small MessageSquare icon alone wasn't doing. */}
                  <div style={{
                    background: 'var(--bg-primary)',
                    border: '0.5px solid var(--border)',
                    borderLeft: '3px solid var(--accent)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 16px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                  }}>
                    <div style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                      <MessageSquare size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                        {truncateCommentBody(c.body)}
                      </p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          on {c.sequence.title}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </span>
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--accent)',
                          fontWeight: 500,
                          marginLeft: 'auto',
                          whiteSpace: 'nowrap',
                        }}>
                          Jump to comment →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 'var(--text-base)',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  )
}

function SequenceRow({ seq }: { seq: SequenceRowData }) {
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
          {seq.avg_score && seq.rating_count && seq.rating_count > 0 && (
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

// --- Owner-only dashboard tab (2026-09-14, Slowdog's stats request) -----

function DashboardTab({
  seqs,
  viewTrend,
  activity,
}: {
  seqs: SequenceRowData[]
  viewTrend: ViewTrendPoint[]
  activity: ActivityItem[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          Views, last 30 days
        </h2>
        <div style={{
          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '20px 20px 12px',
        }}>
          <ViewTrendChart data={viewTrend} />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          Per-sequence breakdown
        </h2>
        <BreakdownTable seqs={seqs} />
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          Recent activity
        </h2>
        <ActivityFeed activity={activity} />
      </section>
    </div>
  )
}

// Single-series magnitude chart (dataviz skill: sequential = one hue,
// light->dark isn't needed at n=1 -- this is just the one accent hue).
// Thin bars, 4px rounded top corners anchored to the baseline, 2px gaps,
// selective axis labels (first/third-points/last, never one per bar), and a
// per-bar hover tooltip. No legend -- a single series needs none, the
// section heading above already names it.
function ViewTrendChart({ data }: { data: ViewTrendPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (data.length === 0) return null

  const max = Math.max(1, ...data.map(d => d.views))
  const allZero = data.every(d => d.views === 0)
  // Guards against duplicate label indices when data is short -- a Set
  // naturally collapses those rather than rendering the same label twice.
  const labelIdx = new Set([
    0,
    Math.floor((data.length - 1) / 3),
    Math.floor(((data.length - 1) * 2) / 3),
    data.length - 1,
  ])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
        {data.map((d, i) => (
          <div
            key={d.day}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end' }}
          >
            {hoverIdx === i && (
              <div style={{
                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                marginBottom: 4, background: 'var(--text-primary)', color: 'var(--bg-primary)',
                fontSize: 'var(--text-xs)', padding: '3px 7px', borderRadius: 4, whiteSpace: 'nowrap',
                zIndex: 1, pointerEvents: 'none',
              }}>
                {d.views} on {format(new Date(`${d.day}T00:00:00`), 'MMM d')}
              </div>
            )}
            <div style={{
              width: '100%',
              // Math.max(2, ...) keeps a visible baseline sliver even at 0
              // views, rather than an invisible bar a viewer might read as a
              // missing day instead of a real zero.
              height: `${Math.max(2, (d.views / max) * 100)}%`,
              background: hoverIdx === i ? 'var(--accent)' : 'var(--accent-subtle)',
              borderRadius: '4px 4px 0 0',
              transition: 'background 0.1s',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={d.day} style={{ flex: 1, textAlign: 'center' }}>
            {labelIdx.has(i) && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {format(new Date(`${d.day}T00:00:00`), 'MMM d')}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* Real data limitation, not a bug -- see creator-dashboard.ts's
          comment on fetchCreatorViewTrend: there's no historical backfill,
          so this is genuinely empty for any creator until the rollup has
          had time to accumulate from today forward. */}
      {allZero && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
          No view history yet — this chart starts filling in from today forward.
        </p>
      )}
    </div>
  )
}

function BreakdownTable({ seqs }: { seqs: SequenceRowData[] }) {
  if (seqs.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '32px 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Post a sequence and its stats will show up here.
        </p>
      </div>
    )
  }

  const sorted = [...seqs].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
  const cols = '1fr 64px 64px 64px 84px'

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, gap: 8,
        padding: '10px 16px', borderBottom: '0.5px solid var(--border)',
        fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600,
      }}>
        <span>Sequence</span>
        <span style={{ textAlign: 'right' }}>Views</span>
        <span style={{ textAlign: 'right' }}>Saves</span>
        <span style={{ textAlign: 'right' }}>Rating</span>
        <span style={{ textAlign: 'right' }}>Comments</span>
      </div>
      {sorted.map((seq, i) => (
        <Link key={seq.id} href={`/sequences/${seq.slug}`} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: cols, gap: 8,
            padding: '10px 16px',
            borderBottom: i < sorted.length - 1 ? '0.5px solid var(--border)' : 'none',
            fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', alignItems: 'center',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
              {seq.title}
            </span>
            <span style={{ textAlign: 'right' }}>{(seq.view_count ?? 0).toLocaleString()}</span>
            <span style={{ textAlign: 'right' }}>{(seq.save_count ?? 0).toLocaleString()}</span>
            <span style={{ textAlign: 'right' }}>
              {seq.avg_score != null && (seq.rating_count ?? 0) > 0 ? seq.avg_score : '—'}
            </span>
            <span style={{ textAlign: 'right' }}>{(seq.comment_count ?? 0).toLocaleString()}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'comment': return <MessageSquare size={14} />
    case 'reply': return <Reply size={14} />
    // Gold tint matches /notifications page's own rating-icon treatment --
    // kept consistent rather than reusing the generic muted icon color the
    // other types get here.
    case 'rating': return <Star size={14} style={{ color: '#c69b3a' }} />
    default: return <Bell size={14} />
  }
}

function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '32px 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          No activity yet — comments, replies, and ratings on your sequences will show up here.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {activity.map(item => {
        const body = (
          <div style={{
            background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '12px 16px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <div style={{ color: item.type === 'rating' ? undefined : 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
              <ActivityIcon type={item.type} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {item.message}
              </p>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                {item.sequence ? ` · ${item.sequence.title}` : ''}
              </span>
            </div>
          </div>
        )

        return item.sequence ? (
          <Link key={item.id} href={`/sequences/${item.sequence.slug}`} style={{ textDecoration: 'none' }}>
            {body}
          </Link>
        ) : (
          <div key={item.id}>{body}</div>
        )
      })}
    </div>
  )
}
