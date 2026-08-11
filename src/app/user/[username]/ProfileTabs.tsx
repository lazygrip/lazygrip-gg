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

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Left: tabbed Sequences / Comments, everything that existed on this
          page before today just reorganized under tabs instead of stacked
          as two always-visible sections. */}
      <div style={{ flex: '1 1 480px', minWidth: 0 }}>
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '0.5px solid var(--border)',
          marginBottom: 16,
        }}>
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
          )
        )}
      </div>

      {/* Right: reserved space for creator chat. Deliberately a real,
          honest "not built yet" placeholder rather than a fake mockup with
          invented messages -- chat itself (schema, realtime vs. polling,
          moderation/blocking) is unscoped as of 2026-08-11 and is its own
          session's work. This exists so the layout is correct now and chat
          slots in later without another restructure. */}
      <div style={{
        flex: '0 1 320px',
        minWidth: 260,
        background: 'var(--bg-primary)',
        border: '0.5px dashed var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
        color: 'var(--text-muted)',
      }}>
        <MessageCircle size={20} />
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
          Chat with {isOwnProfile ? 'creators' : 'this creator'}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', margin: 0 }}>
          Coming soon.
        </p>
      </div>
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
        fontSize: 'var(--text-sm)',
        fontWeight: active ? 500 : 400,
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
