'use client'
import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare, MessageCircle, Reply, Star, Bell,
  Upload, Check, Save, BookmarkX, Link2, Unlink, AlertCircle,
  Trash2, Lock, Globe, X, Twitch, Youtube, Twitter,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { sanitizeAvatarUrl, sanitizeBannerUrl } from '@/lib/url-safety'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import type { ViewTrendPoint, ActivityItem } from '@/lib/creator-dashboard'

// Client component: the page itself (page.tsx) stays a server component so
// generateMetadata and the initial Supabase reads keep running server-side.
// As of the 2026-09-14 consolidation this component also carries everything
// that used to live on /profile (Drafts, Saved, Settings) as owner-only
// tabs, plus private sequences folded inline into the Sequences tab -- see
// page.tsx's comment on why /profile itself is now a thin redirect rather
// than a second page maintaining its own copy of this data and these
// mutations.

const AVATAR_COLORS = [
  { bg: '#1D9E75', label: 'Emerald' },
  { bg: '#5a8dee', label: 'Sapphire' },
  { bg: '#a330c9', label: 'Arcane' },
  { bg: '#c69b3a', label: 'Gold' },
  { bg: '#c0392b', label: 'Crimson' },
  { bg: '#ff7c0a', label: 'Flame' },
  { bg: '#3fc7eb', label: 'Frost' },
  { bg: '#aad372', label: 'Nature' },
]

const CONNECTABLE_PROVIDERS = [
  { id: 'discord', label: 'Discord', color: '#5865F2' },
  { id: 'custom:battlenet', label: 'Battle.net', color: '#148EFF' },
]

// lucide-react has no literal Discord glyph, so it gets the same
// generic-icon-plus-brand-color treatment CONNECTABLE_PROVIDERS above
// already uses for the same platform.
const SOCIAL_PLATFORMS = [
  { key: 'discord', label: 'Discord', color: '#5865F2', icon: MessageCircle, placeholder: 'discord.gg/your-invite' },
  { key: 'twitch', label: 'Twitch', color: '#9146FF', icon: Twitch, placeholder: 'twitch.tv/yourchannel' },
  { key: 'youtube', label: 'YouTube', color: '#FF0000', icon: Youtube, placeholder: 'youtube.com/@yourchannel' },
  { key: 'twitter', label: 'Twitter / X', color: '#1DA1F2', icon: Twitter, placeholder: 'x.com/yourhandle' },
  { key: 'website', label: 'Website', color: 'var(--text-muted)', icon: Globe, placeholder: 'yoursite.com' },
] as const

export type SequenceRowData = {
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
  // Present only on rows fetched through the `saves` table (Saved tab) --
  // that's the one place this page shows sequences that aren't the
  // profile's own, so it's the one place a row needs to say whose it is.
  author?: { username: string } | null
}

// A published or private row of the profile's own, tagged after the fact --
// neither the sequences table nor either of page.tsx's two queries carries
// this, it's assigned when the two lists are merged for the Sequences tab.
type TabSequence = SequenceRowData & { status: 'published' | 'private' }

type DraftRowData = {
  id: string
  title: string | null
  class_name: string | null
  class_id: number | null
  spec_name: string | null
  content_type: string | null
  hero_talent: string | null
  grip_string: string | null
  collection_sequences: { checked?: boolean }[] | null
  updated_at: string
}

type CommentRowData = {
  id: string
  body: string
  created_at: string
  sequence: { slug: string; title: string; status: string }
}

type SettingsProfileData = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_color: string | null
  bio: string | null
  battletag: string | null
  banner_url: string | null
  social_links: Record<string, string> | null
  featured_sequence_id: string | null
  discord_bridge_opted_out: boolean
}

type TabKey = 'sequences' | 'comments' | 'dashboard' | 'drafts' | 'saved' | 'settings'

interface ProfileTabsProps {
  seqs: SequenceRowData[]
  comments: CommentRowData[]
  isOwnProfile: boolean
  // Empty for a visitor viewing someone else's profile -- see page.tsx's
  // isOwnProfile gate on every one of these fetches.
  viewTrend?: ViewTrendPoint[]
  activity?: ActivityItem[]
  privateSeqs?: SequenceRowData[]
  drafts?: DraftRowData[]
  savedSeqs?: SequenceRowData[]
  viewerId?: string | null
  settingsProfile?: SettingsProfileData | null
}

function truncateCommentBody(body: string, max = 140): string {
  const cleaned = body.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const head = cleaned.slice(0, max + 1)
  const lastSpace = head.lastIndexOf(' ')
  const truncated = lastSpace > 0 ? head.slice(0, lastSpace) : cleaned.slice(0, max)
  return truncated.replace(/[\s,.;:!?-]+$/, '') + '…'
}

// useSearchParams() needs a Suspense boundary above it or the whole route
// de-opts to fully client-side rendering -- same requirement the old
// /profile/page.tsx already worked around the same way.
export default function ProfileTabs(props: ProfileTabsProps) {
  return (
    <Suspense fallback={null}>
      <ProfileTabsInner {...props} />
    </Suspense>
  )
}

function ProfileTabsInner({
  seqs, comments, isOwnProfile, viewTrend = [], activity = [],
  privateSeqs = [], drafts = [], savedSeqs = [], viewerId = null, settingsProfile = null,
}: ProfileTabsProps) {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<TabKey>('sequences')
  const [chatOpen, setChatOpen] = useState(false)

  // Reads ?tab= from the URL, same as the old /profile page did -- this is
  // what keeps Header.tsx's 10 existing /profile?tab=X links (now forwarded
  // through the /profile redirect shim) and both OAuth redirectTo targets
  // landing on the right tab here instead of always defaulting to Sequences.
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'comments') setActiveTab('comments')
    else if (tab === 'dashboard' && isOwnProfile) setActiveTab('dashboard')
    else if (tab === 'drafts' && isOwnProfile) setActiveTab('drafts')
    else if (tab === 'saved' && isOwnProfile) setActiveTab('saved')
    else if (tab === 'settings' && isOwnProfile) setActiveTab('settings')
    else setActiveTab('sequences')
  }, [searchParams, isOwnProfile])

  // Local, mutable copies of the owner-only lists -- page.tsx's fetches are
  // the initial state, and every mutation below (publish, make private,
  // unsave, delete draft) updates these directly rather than refetching, the
  // same pattern the old /profile page used.
  const [publishedList, setPublishedList] = useState<SequenceRowData[]>(seqs)
  const [privateList, setPrivateList] = useState<SequenceRowData[]>(privateSeqs)
  const [savedList, setSavedList] = useState<SequenceRowData[]>(savedSeqs)
  const [draftList, setDraftList] = useState<DraftRowData[]>(drafts)
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set())
  const [batchPublishing, setBatchPublishing] = useState(false)
  const [batchPublishError, setBatchPublishError] = useState<string | null>(null)

  const combinedSeqs = useMemo<TabSequence[]>(() => {
    if (!isOwnProfile) return publishedList.map(s => ({ ...s, status: 'published' as const }))
    return [
      ...publishedList.map(s => ({ ...s, status: 'published' as const })),
      ...privateList.map(s => ({ ...s, status: 'private' as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [publishedList, privateList, isOwnProfile])

  // Moves a sequence between 'published' and 'private'. Protected by the
  // existing "Authors can update their own sequences" RLS policy (author_id
  // = auth.uid()) -- the .eq('author_id', viewerId) below is
  // belt-and-suspenders, not the actual security boundary.
  async function handleSetStatus(seq: SequenceRowData, newStatus: 'published' | 'private') {
    if (!viewerId) return
    const { error } = await supabase
      .from('sequences')
      .update({ status: newStatus })
      .eq('id', seq.id)
      .eq('author_id', viewerId)
    if (error) return

    if (newStatus === 'private') {
      setPublishedList(prev => prev.filter(s => s.id !== seq.id))
      setPrivateList(prev => [seq, ...prev])
    } else {
      setPrivateList(prev => prev.filter(s => s.id !== seq.id))
      setPublishedList(prev => [seq, ...prev])
    }
  }

  async function handleUnsave(seqId: string) {
    if (!viewerId) return
    await supabase.from('saves').delete().eq('user_id', viewerId).eq('sequence_id', seqId)
    setSavedList(prev => prev.filter(s => s.id !== seqId))
  }

  function toggleDraftSelection(id: string) {
    setSelectedDraftIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBatchPublish() {
    if (!viewerId || selectedDraftIds.size === 0) return
    setBatchPublishing(true)
    setBatchPublishError(null)

    const { data, error } = await supabase.rpc('publish_draft_sequences_batch', {
      p_sequence_ids: Array.from(selectedDraftIds),
      p_author_id: viewerId,
    })

    if (error) {
      // The RPC is all-or-nothing (single transaction) -- on failure, nothing
      // in the batch published, so the drafts list doesn't need reloading.
      setBatchPublishError(error.message || 'Batch publish failed. Please try again.')
      setBatchPublishing(false)
      return
    }

    const publishedIds = new Set<string>((data?.results ?? []).map((r: { sequence_id: string }) => r.sequence_id))
    setDraftList(prev => prev.filter(d => !publishedIds.has(d.id)))
    setSelectedDraftIds(new Set())
    setBatchPublishing(false)
  }

  async function handleDeleteDraft(id: string) {
    await supabase.from('sequences').delete().eq('id', id).eq('status', 'draft')
    setDraftList(prev => prev.filter(d => d.id !== id))
    setSelectedDraftIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  return (
    <div>
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '0.5px solid var(--border)',
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
          <TabButton
            label={`Sequences (${combinedSeqs.length})`}
            active={activeTab === 'sequences'}
            onClick={() => setActiveTab('sequences')}
          />
          <TabButton
            label={`Comments (${comments.length})`}
            active={activeTab === 'comments'}
            onClick={() => setActiveTab('comments')}
          />
          {/* Owner-only tabs below -- hidden rather than shown-empty for a
              visitor, same reasoning the pre-existing Dashboard tab already
              used: the underlying data is either never fetched (drafts,
              saved) or RLS-gated (dashboard) for anyone but the owner. */}
          {isOwnProfile && (
            <TabButton
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
            />
          )}
          {isOwnProfile && (
            <TabButton
              label={`Drafts (${draftList.length})`}
              active={activeTab === 'drafts'}
              onClick={() => setActiveTab('drafts')}
            />
          )}
          {isOwnProfile && (
            <TabButton
              label={`Saved (${savedList.length})`}
              active={activeTab === 'saved'}
              onClick={() => setActiveTab('saved')}
            />
          )}
          {isOwnProfile && (
            <TabButton
              label="Settings"
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
            />
          )}
        </div>
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
        <DashboardTab seqs={publishedList} viewTrend={viewTrend} activity={activity} />
      ) : activeTab === 'drafts' ? (
        <DraftsTab
          drafts={draftList}
          selectedDraftIds={selectedDraftIds}
          onToggleSelect={toggleDraftSelection}
          onDelete={handleDeleteDraft}
          onBatchPublish={handleBatchPublish}
          onClearSelection={() => setSelectedDraftIds(new Set())}
          batchPublishing={batchPublishing}
          batchPublishError={batchPublishError}
        />
      ) : activeTab === 'saved' ? (
        <SavedTab seqs={savedList} onUnsave={handleUnsave} />
      ) : activeTab === 'settings' && settingsProfile ? (
        <SettingsTab profile={settingsProfile} publishedSequences={publishedList} />
      ) : activeTab === 'sequences' ? (
        combinedSeqs.length === 0 ? (
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
            {combinedSeqs.map(seq => (
              <SequenceRow
                key={seq.id}
                seq={seq}
                status={isOwnProfile ? seq.status : undefined}
                onSetStatus={isOwnProfile ? (s) => handleSetStatus(s, seq.status === 'private' ? 'published' : 'private') : undefined}
              />
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

function SequenceRow({ seq, status, onSetStatus }: {
  seq: SequenceRowData
  // Set only on the owner's own Sequences tab -- a visitor's SequenceRow
  // never gets a badge or a status button, since a visitor only ever sees
  // published rows in the first place.
  status?: 'published' | 'private'
  onSetStatus?: (seq: SequenceRowData) => void
}) {
  const classColor = getClassColor(seq.class_id)
  const contentLabel = CONTENT_TYPES.find(c => c.value === seq.content_type)?.label ?? seq.content_type
  // Private sequences have no reachable /sequences/[slug] page -- that route
  // only ever fetches status='published' rows, for anyone including the
  // author. The owner's own private rows link to the edit flow instead, the
  // same "view/edit this sequence" entry point the old /profile Private tab
  // used.
  const href = status === 'private' ? `/post?edit=${seq.id}&mode=edit` : `/sequences/${seq.slug}`

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {seq.title}
            </div>
            {status === 'private' && (
              <span style={{
                fontSize: 'var(--text-xs)', fontWeight: 500, flexShrink: 0,
                padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)', background: 'var(--bg-secondary)',
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <Lock size={9} />
                Private
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: classColor }}>{seq.class_name}</span>
            {seq.spec_name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {seq.spec_name}</span>}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {contentLabel}</span>
            {seq.hero_talent && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {seq.hero_talent}</span>}
            {seq.author?.username && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                · by{' '}
                <Link
                  href={`/user/${seq.author.username}`}
                  onClick={e => e.stopPropagation()}
                  style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {seq.author.username}
                </Link>
              </span>
            )}
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
          {status && onSetStatus && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onSetStatus(seq) }}
              title={status === 'private' ? 'Publish this sequence' : 'Make this sequence private -- only visible to you'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                padding: '5px 10px',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-sans)',
                flexShrink: 0,
              }}
            >
              {status === 'private' ? <Globe size={12} /> : <Lock size={12} />}
              {status === 'private' ? 'Publish' : 'Make private'}
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}

// --- Owner-only Saved tab -------------------------------------------------

function SavedTab({ seqs, onUnsave }: { seqs: SequenceRowData[]; onUnsave: (id: string) => void }) {
  if (seqs.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '40px 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
          You haven't saved any sequences yet.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {seqs.map(seq => (
        <SavedSequenceRow key={seq.id} seq={seq} onUnsave={onUnsave} />
      ))}
    </div>
  )
}

// A distinct row rather than a variant of SequenceRow -- the bookmark-remove
// action is unrelated to the private/publish toggle SequenceRow carries, and
// keeping the two apart avoids a SequenceRow prop combination that makes no
// sense (a saved row is never the viewer's own to make private).
function SavedSequenceRow({ seq, onUnsave }: { seq: SequenceRowData; onUnsave: (id: string) => void }) {
  const classColor = getClassColor(seq.class_id)
  const contentLabel = CONTENT_TYPES.find(c => c.value === seq.content_type)?.label ?? seq.content_type

  return (
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
      }}
    >
      <Link href={`/sequences/${seq.slug}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {seq.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: classColor }}>{seq.class_name}</span>
            {seq.spec_name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {seq.spec_name}</span>}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {contentLabel}</span>
            {seq.hero_talent && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {seq.hero_talent}</span>}
            {seq.author?.username && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· by {seq.author.username}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
          {seq.avg_score && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{seq.avg_score}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{seq.rating_count ?? 0} ratings</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{seq.view_count?.toLocaleString() ?? 0} views</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(seq.created_at), { addSuffix: true })}</div>
          </div>
        </div>
      </Link>
      <button
        onClick={() => onUnsave(seq.id)}
        title="Remove from saved"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          borderRadius: 'var(--radius-sm)',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#c0392b')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <BookmarkX size={15} />
      </button>
    </div>
  )
}

// --- Owner-only Drafts tab -------------------------------------------------

function DraftsTab({
  drafts, selectedDraftIds, onToggleSelect, onDelete, onBatchPublish, onClearSelection,
  batchPublishing, batchPublishError,
}: {
  drafts: DraftRowData[]
  selectedDraftIds: Set<string>
  onToggleSelect: (id: string) => void
  onDelete: (id: string) => void
  onBatchPublish: () => void
  onClearSelection: () => void
  batchPublishing: boolean
  batchPublishError: string | null
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {selectedDraftIds.size > 0 && (
        <div style={{
          position: 'sticky',
          top: 12,
          zIndex: 5,
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {selectedDraftIds.size} draft{selectedDraftIds.size !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {batchPublishError && (
              <span style={{ fontSize: 'var(--text-xs)', color: '#c0392b' }}>{batchPublishError}</span>
            )}
            <button
              onClick={onClearSelection}
              disabled={batchPublishing}
              style={{
                padding: '7px 14px',
                background: 'none',
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Clear
            </button>
            <button
              onClick={onBatchPublish}
              disabled={batchPublishing}
              style={{
                padding: '7px 16px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)', fontWeight: 500,
                cursor: batchPublishing ? 'not-allowed' : 'pointer',
                opacity: batchPublishing ? 0.7 : 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {batchPublishing ? 'Publishing...' : `Publish ${selectedDraftIds.size} selected`}
            </button>
          </div>
        </div>
      )}
      {drafts.length === 0 ? (
        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px 24px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
            You don't have any drafts in progress.
          </p>
          <Link href="/post" style={{
            display: 'inline-block',
            marginTop: 12,
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
          }}>
            Start a new sequence
          </Link>
        </div>
      ) : (
        drafts.map(draft => (
          <DraftRow
            key={draft.id}
            draft={draft}
            selected={selectedDraftIds.has(draft.id)}
            onToggleSelect={onToggleSelect}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  )
}

function DraftRow({
  draft, selected, onToggleSelect, onDelete,
}: {
  draft: DraftRowData
  selected: boolean
  onToggleSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const classColor = draft.class_id ? getClassColor(draft.class_id) : 'var(--text-muted)'
  const contentLabel = CONTENT_TYPES.find(c => c.value === draft.content_type)?.label ?? draft.content_type
  const isCollection = Array.isArray(draft.collection_sequences) && draft.collection_sequences.length > 0
  const checkedCount = isCollection && draft.collection_sequences
    ? draft.collection_sequences.filter(s => s.checked).length
    : 0

  // Same checks publish_draft_sequence / publish_draft_sequences_batch
  // enforce server-side, branched the same way: collections need at least
  // one checked sequence instead of a grip_string.
  const missing: string[] = []
  if (!draft.title || !draft.title.trim() || draft.title === 'Untitled draft') missing.push('title')
  if (!draft.class_id) missing.push('class')
  if (isCollection) {
    if (checkedCount === 0) missing.push('a selected sequence')
  } else {
    if (!draft.grip_string || !draft.grip_string.trim()) missing.push('GRIP export')
  }
  const readyToPublish = missing.length === 0

  return (
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
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={!readyToPublish}
        title={readyToPublish ? undefined : `Can't publish yet -- missing ${missing.join(', ')}`}
        onClick={e => e.stopPropagation()}
        onChange={() => onToggleSelect(draft.id)}
        style={{ width: 16, height: 16, cursor: readyToPublish ? 'pointer' : 'not-allowed', flexShrink: 0 }}
      />
      <Link
        href={`/post?draftId=${draft.id}`}
        style={{ textDecoration: 'none', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.title && draft.title !== 'Untitled draft' ? draft.title : 'Untitled draft'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {draft.class_name && <span style={{ fontSize: 'var(--text-xs)', color: classColor }}>{draft.class_name}</span>}
            {draft.spec_name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {draft.spec_name}</span>}
            {draft.content_type && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {contentLabel}</span>}
            {draft.hero_talent && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {draft.hero_talent}</span>}
            {isCollection && draft.collection_sequences && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· Collection ({checkedCount}/{draft.collection_sequences.length} selected)</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            color: readyToPublish ? 'var(--accent)' : '#c69b3a',
            background: readyToPublish ? 'rgba(29,158,117,0.12)' : 'rgba(198,155,58,0.14)',
          }}>
            {readyToPublish ? 'Ready to publish' : `Missing ${missing.join(', ')}`}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            edited {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
          </span>
        </div>
      </Link>
      <button
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          if (window.confirm('Delete this draft? This cannot be undone.')) {
            onDelete(draft.id)
          }
        }}
        title="Delete draft"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          borderRadius: 'var(--radius-sm)',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#c41e3a')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

// --- Owner-only Settings tab ------------------------------------------------
// Self-contained: unlike the rest of this file, Settings manages its own
// state and its own Supabase writes rather than taking two dozen props from
// ProfileTabsInner, because none of that state (draft username, pending
// avatar upload, connected identities) needs to be visible to any sibling
// tab. Ported from the old /profile page's SettingsTab with the same
// behavior, minus the props-drilling.

function SettingsTab({ profile, publishedSequences }: {
  profile: SettingsProfileData
  publishedSequences: SequenceRowData[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const [viewerEmail, setViewerEmail] = useState<string | null>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url)
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl)
  const [selectedColor, setSelectedColor] = useState<string | null>(profile.avatar_color ?? AVATAR_COLORS[0].bg)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarSaved, setAvatarSaved] = useState(false)

  const [bannerUrl, setBannerUrl] = useState<string | null>(profile.banner_url)
  const safeBannerUrl = sanitizeBannerUrl(bannerUrl)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [bannerSaved, setBannerSaved] = useState(false)

  const links = profile.social_links ?? {}
  const [socialLinks, setSocialLinks] = useState({
    discord: links.discord ?? '',
    twitch: links.twitch ?? '',
    youtube: links.youtube ?? '',
    twitter: links.twitter ?? '',
    website: links.website ?? '',
  })
  const [featuredSequenceId, setFeaturedSequenceId] = useState(profile.featured_sequence_id ?? '')

  const [username, setUsername] = useState(profile.username)
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [battletag, setBattletag] = useState(profile.battletag ?? '')
  const [bridgeOptedOut, setBridgeOptedOut] = useState(profile.discord_bridge_opted_out)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [identities, setIdentities] = useState<{ identity_id: string; provider: string }[]>([])
  const [identitiesLoading, setIdentitiesLoading] = useState(true)
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [identityError, setIdentityError] = useState<string | null>(null)

  useEffect(() => {
    loadIdentities()
    supabase.auth.getUser().then(({ data }) => setViewerEmail(data.user?.email ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadIdentities() {
    setIdentitiesLoading(true)
    const { data, error } = await supabase.auth.getUserIdentities()
    if (!error && data) {
      setIdentities(data.identities ?? [])
    }
    setIdentitiesLoading(false)
  }

  async function handleLinkProvider(providerId: string) {
    setIdentityError(null)
    setLinkingProvider(providerId)
    const { data, error } = await supabase.auth.linkIdentity({
      provider: providerId as 'discord',
      options: {
        // Points straight at this profile's own tab rather than through the
        // /profile redirect shim -- avoids one extra bounce on the way back
        // from the OAuth provider.
        redirectTo: `${window.location.origin}/user/${username}?tab=settings`,
      },
    })
    if (error) {
      setIdentityError(`Failed to connect: ${error.message}`)
      setLinkingProvider(null)
      return
    }
    if (data?.url) {
      window.location.href = data.url
    }
  }

  async function handleUnlinkProvider(identity: { identity_id: string; provider: string }) {
    setIdentityError(null)
    if (identities.length < 2) {
      setIdentityError("You can't disconnect your only sign-in method. Connect another one first.")
      return
    }
    setUnlinkingId(identity.identity_id)
    const { error } = await supabase.auth.unlinkIdentity(identity as Parameters<typeof supabase.auth.unlinkIdentity>[0])
    if (error) {
      setIdentityError(`Failed to disconnect: ${error.message}`)
    } else {
      await loadIdentities()
    }
    setUnlinkingId(null)
  }

  async function saveAvatarColor(color: string) {
    setSelectedColor(color)
    setAvatarUrl(null)
    await supabase.from('profiles').update({ avatar_color: color, avatar_url: null }).eq('id', profile.id)
    setAvatarSaved(true)
    setTimeout(() => setAvatarSaved(false), 2000)
    router.refresh()
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)

    const ext = file.name.split('.').pop()
    const path = `${profile.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const bustUrl = `${publicUrl}?t=${Date.now()}`
    setAvatarUrl(bustUrl)
    await supabase.from('profiles').update({ avatar_url: bustUrl }).eq('id', profile.id)
    setAvatarSaved(true)
    setTimeout(() => setAvatarSaved(false), 2000)
    setUploadingAvatar(false)
    router.refresh()
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBanner(true)

    const ext = file.name.split('.').pop()
    const path = `${profile.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('banners')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploadingBanner(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(path)
    const bustUrl = `${publicUrl}?t=${Date.now()}`
    setBannerUrl(bustUrl)
    await supabase.from('profiles').update({ banner_url: bustUrl }).eq('id', profile.id)
    setBannerSaved(true)
    setTimeout(() => setBannerSaved(false), 2000)
    setUploadingBanner(false)
    router.refresh()
  }

  async function handleRemoveBanner() {
    setBannerUrl(null)
    await supabase.from('profiles').update({ banner_url: null }).eq('id', profile.id)
    router.refresh()
  }

  async function saveProfileSettings() {
    setSettingsSaving(true)
    setSettingsError(null)

    const trimmedUsername = username.trim()
    const usernameChanged = trimmedUsername !== profile.username

    if (usernameChanged) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .neq('id', profile.id)
        .single()
      if (existing) {
        setSettingsError('That username is already taken.')
        setSettingsSaving(false)
        return
      }
    }

    // Empty-string fields are dropped rather than saved as '' -- keeps
    // social_links holding only platforms the creator actually filled in.
    const trimmedLinks = Object.fromEntries(
      Object.entries(socialLinks)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v.length > 0)
    )

    const { error } = await supabase
      .from('profiles')
      .update({
        username: trimmedUsername,
        display_name: displayName.trim(),
        bio: bio.trim(),
        battletag: battletag.trim(),
        discord_bridge_opted_out: bridgeOptedOut,
        social_links: trimmedLinks,
        featured_sequence_id: featuredSequenceId || null,
      })
      .eq('id', profile.id)

    if (error) {
      setSettingsError('Save failed. Please try again.')
      setSettingsSaving(false)
      return
    }

    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2500)
    setSettingsSaving(false)

    // A username change moves this exact page to a new URL -- page.tsx's
    // notFound() would otherwise fire on the next server render since
    // params.username no longer matches any profile row. Every other field
    // here leaves the URL alone, so a plain refresh is enough to pick up the
    // new avatar/bio/etc. in the header above these tabs.
    if (usernameChanged) {
      router.replace(`/user/${encodeURIComponent(trimmedUsername)}?tab=settings`)
    } else {
      router.refresh()
    }
  }

  const initial = profile.username?.[0]?.toUpperCase() ?? '?'
  const displayColor = selectedColor ?? AVATAR_COLORS[0].bg

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    border: '0.5px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    display: 'block',
  }

  const hintStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    marginTop: 4,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Profile info */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 20 }}>Profile</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={inputStyle}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your username"
              maxLength={30}
            />
            <p style={hintStyle}>Your unique handle on LazyGrip. Shown on all your sequences.</p>
          </div>

          <div>
            <label style={labelStyle}>Display name</label>
            <input
              style={inputStyle}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your Name"
              maxLength={50}
            />
            <p style={hintStyle}>Optional longer name shown on your profile page.</p>
          </div>

          <div>
            <label style={labelStyle}>Bio</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80, lineHeight: 1.5 }}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell the community a bit about yourself..."
              maxLength={300}
            />
            <p style={hintStyle}>{bio.length}/300</p>
          </div>

          <div>
            <label style={labelStyle}>Battle tag</label>
            <input
              style={inputStyle}
              value={battletag}
              onChange={e => setBattletag(e.target.value)}
              placeholder="YourName#1234"
              maxLength={20}
            />
            <p style={hintStyle}>Optional. Shown on your public profile.</p>
          </div>

          <div>
            <label style={labelStyle}>Featured sequence</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={featuredSequenceId}
              onChange={e => setFeaturedSequenceId(e.target.value)}
            >
              <option value="">None</option>
              {publishedSequences.map(seq => (
                <option key={seq.id} value={seq.id}>{seq.title}</option>
              ))}
            </select>
            <p style={hintStyle}>
              Pinned at the top of your public profile. Only your published sequences can be
              featured -- this list won't show drafts or private ones.
            </p>
          </div>

          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={bridgeOptedOut}
                onChange={e => setBridgeOptedOut(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Opt out of Discord comment syncing
            </label>
            <p style={hintStyle}>
              With this on, comments on your sequences are not sent to the GRIP Discord,
              and Discord replies in your sequence threads are not brought back to the site.
            </p>
          </div>

        </div>
      </div>

      {/* Account */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 20 }}>Account</h2>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
            value={viewerEmail ?? ''}
            readOnly
          />
          <p style={hintStyle}>Email cannot be changed here.</p>
        </div>
      </div>

      {/* Connected Accounts */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6 }}>Connected accounts</h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 20 }}>
          Connect Discord or Battle.net so you can sign in with either one and keep a single account.
          Connecting Discord also lets the GRIP bot tag you in the Discord thread for each sequence
          you publish, so you hear about it when someone asks a question there.
        </p>

        {identityError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#c41e3a', fontSize: 'var(--text-xs)', marginBottom: 14,
          }}>
            <AlertCircle size={13} />
            {identityError}
          </div>
        )}

        {identitiesLoading ? (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>Loading...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CONNECTABLE_PROVIDERS.map(p => {
              const linked = identities.find(i => i.provider === p.id)
              const isLinking = linkingProvider === p.id
              const isUnlinking = linked && unlinkingId === linked.identity_id

              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: p.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Link2 size={14} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{p.label}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {linked ? 'Connected' : 'Not connected'}
                      </div>
                    </div>
                  </div>

                  {linked ? (
                    <button
                      onClick={() => handleUnlinkProvider(linked)}
                      disabled={isUnlinking}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px',
                        border: '0.5px solid var(--border-strong)',
                        borderRadius: 'var(--radius-md)',
                        background: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--text-xs)', cursor: isUnlinking ? 'not-allowed' : 'pointer',
                        opacity: isUnlinking ? 0.6 : 1,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <Unlink size={12} />
                      {isUnlinking ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLinkProvider(p.id)}
                      disabled={isLinking}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        background: p.color,
                        color: 'white',
                        fontSize: 'var(--text-xs)', cursor: isLinking ? 'not-allowed' : 'pointer',
                        opacity: isLinking ? 0.7 : 1,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <Link2 size={12} />
                      {isLinking ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 20 }}>Avatar</h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: safeAvatarUrl ? 'transparent' : displayColor,
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: 'white',
            border: '2px solid var(--border)', flexShrink: 0,
          }}>
            {safeAvatarUrl
              ? <img src={safeAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initial
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 16 }}>
              <p style={labelStyle}>Photo</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-xs)', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Upload size={12} />
                {uploadingAvatar ? 'Uploading...' : 'Upload photo'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            </div>
            <div>
              <p style={labelStyle}>Color</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map(opt => (
                  <button
                    key={opt.bg}
                    onClick={() => saveAvatarColor(opt.bg)}
                    title={opt.label}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: opt.bg,
                      border: selectedColor === opt.bg && !avatarUrl ? '2.5px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, outline: 'none',
                    }}
                  >
                    {selectedColor === opt.bg && !avatarUrl && <Check size={12} color="white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
            {avatarSaved && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--accent)', marginTop: 10 }}>
                <Check size={12} /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banner */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6 }}>Banner</h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 16 }}>
          Shown across the top of your public profile page, behind your avatar.
        </p>
        <div style={{
          width: '100%',
          height: 120,
          borderRadius: 'var(--radius-md)',
          background: safeBannerUrl ? `center / cover no-repeat url(${safeBannerUrl})` : 'var(--bg-tertiary)',
          border: '0.5px solid var(--border-strong)',
          marginBottom: 14,
          display: safeBannerUrl ? 'block' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {!safeBannerUrl && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No banner uploaded</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-xs)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Upload size={12} />
            {uploadingBanner ? 'Uploading...' : safeBannerUrl ? 'Replace banner' : 'Upload banner'}
          </button>
          {safeBannerUrl && (
            <button
              onClick={handleRemoveBanner}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                background: 'none',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-xs)', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <X size={12} />
              Remove
            </button>
          )}
          <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerUpload} />
          {bannerSaved && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>
              <Check size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Social links */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6 }}>Social links</h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 16 }}>
          Shown as icons on your public profile. Leave any blank to hide them.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SOCIAL_PLATFORMS.map(platform => {
            const Icon = platform.icon
            return (
              <div key={platform.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: platform.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} color="white" />
                </div>
                <input
                  style={inputStyle}
                  value={socialLinks[platform.key]}
                  onChange={e => setSocialLinks(prev => ({ ...prev, [platform.key]: e.target.value }))}
                  placeholder={platform.placeholder}
                  maxLength={200}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={saveProfileSettings}
          disabled={settingsSaving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px',
            background: 'var(--accent)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500,
            cursor: settingsSaving ? 'not-allowed' : 'pointer',
            opacity: settingsSaving ? 0.7 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Save size={13} />
          {settingsSaving ? 'Saving...' : 'Save changes'}
        </button>
        {settingsSaved && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)', color: 'var(--accent)' }}>
            <Check size={13} /> Saved
          </span>
        )}
        {settingsError && <span style={{ fontSize: 'var(--text-sm)', color: '#c0392b' }}>{settingsError}</span>}
      </div>

    </div>
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
