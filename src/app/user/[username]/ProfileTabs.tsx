'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, MessageCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'

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

export default function ProfileTabs({ seqs, comments, isOwnProfile }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<'sequences' | 'comments'>('sequences')
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

        {activeTab === 'sequences' ? (
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
