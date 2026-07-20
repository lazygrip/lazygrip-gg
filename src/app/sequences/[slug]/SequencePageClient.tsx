'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Copy, Check, Bookmark, ExternalLink, ChevronDown, ChevronUp, Pencil, Trash2, CornerDownRight, Link2, Link2Off, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Sequence, Comment, SequenceVersion, LinkedSequence, CollectionSequenceEntry } from '@/types'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import { formatDistanceToNow } from 'date-fns'
import RenderedContent from '@/components/editor/RenderedContent'
import { sanitizeWarcraftLogsUrl } from '@/lib/url-safety'

const SITE_OWNER_ID = 'c2374192-e541-4636-9baf-84fc192cff52'

function nestComments(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>()
  const roots: Comment[] = []
  flat.forEach(c => map.set(c.id, { ...c, replies: [] }))
  map.forEach(c => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(c)
    } else {
      roots.push(c)
    }
  })
  return roots
}

export default function SequencePageClient() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [versions, setVersions] = useState<SequenceVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<SequenceVersion | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [activeCollectionTab, setActiveCollectionTab] = useState(0)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [pendingTags, setPendingTags] = useState<string[]>([])
  const [tagNote, setTagNote] = useState('')
  const [selectedScore, setSelectedScore] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [tagsSubmitted, setTagsSubmitted] = useState(false)
  const [tagBreakdown, setTagBreakdown] = useState<{ tag: string; count: number }[]>([])
  const [commentText, setCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [user, setUser] = useState<any>(null)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null)
  const [deletingVersion, setDeletingVersion] = useState(false)

  // ST/MT linking state
  const [linkedSequence, setLinkedSequence] = useState<LinkedSequence | null>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkSlug, setLinkSlug] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [unlinkLoading, setUnlinkLoading] = useState(false)

  // Site-wide current patch, for the staleness indicator (MFDOOM feature request)
  const [currentPatch, setCurrentPatch] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchSequence()
    fetchCurrentPatch()
  }, [slug])

  useEffect(() => {
    if (sequence && user && user.id === sequence.author_id) {
      fetchTagBreakdown(sequence.id)
    }
  }, [sequence, user])

  async function fetchCurrentPatch() {
    const { data, error } = await supabase
      .from('site_config')
      .select('current_patch')
      .single()
    if (error) {
      console.error('Failed to fetch current_patch:', error)
      return
    }
    setCurrentPatch(data?.current_patch ?? null)
  }

  async function fetchSequence() {
    setLoading(true)
    const { data: seq } = await supabase
      .from('sequences')
      .select('*, author:profiles(*)')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (seq) {
      setSequence(seq)
      await supabase.rpc('increment_view_count', { seq_id: seq.id })

      const { data: cmts } = await supabase
        .from('comments')
        .select('*, author:profiles(*)')
        .eq('sequence_id', seq.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      setComments(nestComments(cmts || []))

      const { data: versionData } = await supabase
        .from('sequence_versions')
        .select('*')
        .eq('sequence_id', seq.id)
        .order('version_number', { ascending: false })

      if (versionData && versionData.length > 0) {
        setVersions(versionData)
        const current = versionData.find(v => v.id === seq.current_version_id) ?? versionData[0]
        setSelectedVersion(current)
      } else {
        setSelectedVersion({
          id: seq.id,
          sequence_id: seq.id,
          version_number: 1,
          version_label: 'v1.0',
          grip_string: seq.grip_string ?? '',
          raw_steps: seq.raw_steps ?? null,
          changelog: null,
          author_id: seq.author_id,
          hero_talent: seq.hero_talent ?? null,
          content_type: seq.content_type ?? null,
          step_function: seq.step_function ?? null,
          grip_version: seq.grip_version ?? null,
          talent_string: seq.talent_string ?? null,
          warcraftlogs_url: seq.warcraftlogs_url ?? null,
          performance_notes: seq.performance_notes ?? null,
          created_at: seq.created_at,
        })
      }

      if (seq.set_id) {
        const { data: linked } = await supabase
          .from('sequences')
          .select('id, title, slug, content_type, class_name, spec_name, hero_talent')
          .eq('set_id', seq.set_id)
          .eq('status', 'published')
          .neq('id', seq.id)
          .limit(1)
          .single()

        if (linked) setLinkedSequence(linked)
      }
    }
    setLoading(false)
  }

  async function copyGripString() {
    if (!selectedVersion?.grip_string) return
    await navigator.clipboard.writeText(selectedVersion.grip_string)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function selectScore(score: number) {
    // Local only — nothing hits the database until confirmRating runs.
    // A rating was previously saved the instant a star was clicked, which
    // meant navigating away before the tag picker appeared still left a
    // real rating on the sequence. That's fixed by not writing anything
    // here at all.
    setSelectedScore(score)
    setPendingTags([])
    setTagNote('')
    setTagsSubmitted(false)
  }

  async function confirmRating() {
    if (!user || !sequence || selectedScore === null) return
    setConfirming(true)

    const { error: ratingError } = await supabase.from('ratings').upsert({
      sequence_id: sequence.id,
      user_id: user.id,
      score: selectedScore,
      reason_tags: pendingTags.length > 0 ? pendingTags : null,
    }, { onConflict: 'sequence_id,user_id' })

    if (ratingError) {
      console.error('Rating insert error:', ratingError)
      setConfirming(false)
      return
    }

    if (tagNote.trim()) {
      const { data, error } = await supabase
        .from('comments')
        .insert({ sequence_id: sequence.id, author_id: user.id, body: tagNote.trim() })
        .select('*, author:profiles(*)')
        .single()
      if (error) console.error('Comment insert error:', error)
      if (data) setComments(c => nestComments([...flattenComments(c), data]))
    }

    setUserRating(selectedScore)
    setTagsSubmitted(pendingTags.length > 0 || !!tagNote.trim())
    setSelectedScore(null)
    setConfirming(false)
  }

  async function fetchTagBreakdown(sequenceId: string) {
    const { data, error } = await supabase
      .from('ratings')
      .select('reason_tags')
      .eq('sequence_id', sequenceId)
      .not('reason_tags', 'is', null)
    if (error) { console.error('Tag breakdown fetch error:', error); return }
    const tally = new Map<string, number>()
    ;(data || []).forEach(row => {
      (row.reason_tags || []).forEach((tag: string) => {
        tally.set(tag, (tally.get(tag) ?? 0) + 1)
      })
    })
    setTagBreakdown(
      Array.from(tally.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
    )
  }

  async function submitComment() {
    if (!user || !sequence || !commentText.trim()) return
    const { data, error } = await supabase
      .from('comments')
      .insert({ sequence_id: sequence.id, author_id: user.id, body: commentText.trim() })
      .select('*, author:profiles(*)')
      .single()
    if (error) console.error('Comment insert error:', error)
    if (data) setComments(c => nestComments([...flattenComments(c), data]))
    setCommentText('')
  }

  async function submitReply(parentId: string) {
    if (!user || !sequence || !replyText.trim()) return
    const { data, error } = await supabase
      .from('comments')
      .insert({
        sequence_id: sequence.id,
        author_id: user.id,
        body: replyText.trim(),
        parent_id: parentId,
      })
      .select('*, author:profiles(*)')
      .single()
    if (error) { console.error('Reply insert error:', error); return }
    if (data) setComments(c => nestComments([...flattenComments(c), data]))
    setReplyText('')
    setReplyingTo(null)
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', commentId)
    if (error) { console.error('Comment delete error:', error); return }
    setComments(c => {
      const flat = flattenComments(c).map(comment =>
        comment.id !== commentId ? comment : { ...comment, is_deleted: true, body: '[deleted]' }
      )
      return nestComments(flat.filter(x => !x.is_deleted))
    })
  }

  async function toggleSave() {
    if (!user || !sequence) return
    if (saved) {
      await supabase.from('saves').delete()
        .eq('sequence_id', sequence.id).eq('user_id', user.id)
    } else {
      await supabase.from('saves').insert({ sequence_id: sequence.id, user_id: user.id })
    }
    setSaved(s => !s)
  }

  async function handleDelete() {
    if (!user || !sequence) return
    setDeleting(true)
    const { error } = await supabase
      .from('sequences')
      .delete()
      .eq('id', sequence.id)
      .eq('author_id', user.id)
    if (!error) {
      router.push('/browse')
    } else {
      console.error('Delete failed:', error)
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  async function handleDeleteVersion(versionId: string) {
    if (!user || !sequence) return
    setDeletingVersion(true)
    const { error } = await supabase.rpc('delete_sequence_version', {
      p_version_id: versionId,
      p_sequence_id: sequence.id,
      p_author_id: user.id,
    })
    if (error) {
      console.error('Version delete failed:', error)
      setDeletingVersion(false)
      setVersionToDelete(null)
      return
    }
    setVersions(vs => vs.filter(v => v.id !== versionId))
    if (selectedVersion?.id === versionId) {
      const remaining = versions.filter(v => v.id !== versionId)
      setSelectedVersion(remaining[0] ?? null)
    }
    setDeletingVersion(false)
    setVersionToDelete(null)
  }

  async function handleLink() {
    if (!sequence || !linkSlug.trim()) return
    setLinkLoading(true)
    setLinkError(null)

    const targetSlug = linkSlug.trim().toLowerCase().replace(/^.*\/sequences\//, '').replace(/\/$/, '')

    const { data: target, error: lookupError } = await supabase
      .from('sequences')
      .select('id, title, slug, content_type, class_name, spec_name, hero_talent, set_id')
      .eq('slug', targetSlug)
      .eq('status', 'published')
      .single()

    if (lookupError || !target) {
      setLinkError('Sequence not found. Check the URL and try again.')
      setLinkLoading(false)
      return
    }

    if (target.id === sequence.id) {
      setLinkError('A sequence cannot be linked to itself.')
      setLinkLoading(false)
      return
    }

    const setId = sequence.set_id ?? target.set_id ?? crypto.randomUUID()

    const { error: updateError } = await supabase
      .from('sequences')
      .update({ set_id: setId })
      .in('id', [sequence.id, target.id])

    if (updateError) {
      setLinkError('Failed to link sequences. Please try again.')
      setLinkLoading(false)
      return
    }

    setSequence(s => s ? { ...s, set_id: setId } : s)
    setLinkedSequence(target)
    setLinkSlug('')
    setShowLinkInput(false)
    setLinkLoading(false)
  }

  async function handleUnlink() {
    if (!sequence?.set_id) return
    setUnlinkLoading(true)

    const setId = sequence.set_id

    const { error: clearSelf } = await supabase
      .from('sequences')
      .update({ set_id: null })
      .eq('id', sequence.id)

    if (clearSelf) {
      console.error('Unlink failed:', clearSelf)
      setUnlinkLoading(false)
      return
    }

    const { data: remaining } = await supabase
      .from('sequences')
      .select('id')
      .eq('set_id', setId)

    if (remaining && remaining.length === 1) {
      await supabase
        .from('sequences')
        .update({ set_id: null })
        .eq('id', remaining[0].id)
    }

    setSequence(s => s ? { ...s, set_id: null } : s)
    setLinkedSequence(null)
    setUnlinkLoading(false)
  }

  const isAuthor = user && sequence && user.id === sequence.author_id
  const isOwner = user?.id === SITE_OWNER_ID
  const canManageLinks = isAuthor || isOwner
  const totalComments = flattenComments(comments).length
  const isCurrentVersion = selectedVersion?.id === sequence?.current_version_id
  const warcraftLogsHref = sanitizeWarcraftLogsUrl(selectedVersion?.warcraftlogs_url)

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 24px' }}>
      <div style={{ height: 300, background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)' }} />
    </div>
  )

  if (!sequence) return (
    <div style={{ maxWidth: 900, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Sequence not found.</p>
    </div>
  )

  const classColor = getClassColor(sequence.class_id)
  const contentLabel = CONTENT_TYPES.find(c => c.value === sequence.content_type)?.label ?? sequence.content_type

  // Staleness: patch mismatch (or no patch_version recorded) AND not updated in 60+ days.
  // Same rule as SequenceCard.tsx — both conditions required, purely informational.
  const STALE_DAYS_THRESHOLD = 60
  const daysSinceUpdate = Math.floor((Date.now() - new Date(sequence.updated_at).getTime()) / (1000 * 60 * 60 * 24))
  const patchMismatch = !!currentPatch && (sequence.patch_version == null || sequence.patch_version !== currentPatch)
  const isStale = patchMismatch && daysSinceUpdate > STALE_DAYS_THRESHOLD

  const collectionEntries: CollectionSequenceEntry[] = sequence.collection_sequences ?? []
  const isCollection = collectionEntries.length > 0
  const activeEntry = collectionEntries[activeCollectionTab] ?? null

  const steps = sequence.raw_steps || []
  const visibleSteps = showAllSteps ? steps : steps.slice(0, 8)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>

      {/* Version delete confirm modal */}
      {versionToDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px',
            maxWidth: 400,
            width: '100%',
            margin: '0 24px',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
              Delete this version?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              This will permanently remove this version from the history. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setVersionToDelete(null)}
                disabled={deletingVersion}
                style={{
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--border-strong)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteVersion(versionToDelete)}
                disabled={deletingVersion}
                style={{
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: '#c0392b',
                  color: 'white',
                  cursor: deletingVersion ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  opacity: deletingVersion ? 0.7 : 1,
                }}
              >
                {deletingVersion ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sequence delete confirm modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px',
            maxWidth: 400,
            width: '100%',
            margin: '0 24px',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
              Delete this sequence?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              This will permanently delete <strong style={{ color: 'var(--text-primary)' }}>{sequence.title}</strong> and all its ratings and comments. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--border-strong)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: '#c0392b',
                  color: 'white',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header card */}
      <div style={{
        background: isStale ? 'rgba(224,160,32,0.08)' : 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        marginBottom: 16,
        borderTop: `3px solid ${classColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <h1 style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--text-primary)',
              }}>
                {sequence.title}
              </h1>
              {selectedVersion && versions.length > 0 && (
                <span style={{
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '0.03em',
                  flexShrink: 0,
                }}>
                  {selectedVersion.version_label}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              <Badge color={classColor}>{sequence.class_name}</Badge>
              {sequence.spec_name && <Badge color="#5a8dee">{sequence.spec_name}</Badge>}
              <Badge color="#1D9E75">{contentLabel}</Badge>
              {selectedVersion?.hero_talent && <Badge color="#a330c9">{selectedVersion.hero_talent}</Badge>}
              {selectedVersion?.grip_version && <Badge color="#888">GRIP {selectedVersion.grip_version}</Badge>}
              {selectedVersion?.step_function && <Badge color="#888">{selectedVersion.step_function}</Badge>}
              {sequence.step_count && <Badge color="#888">{sequence.step_count} steps</Badge>}
              {isStale && <Badge color="#e0a020">Needs revalidation</Badge>}
            </div>

            {sequence.description && (
              <div style={{ marginTop: 16 }}>
                <RenderedContent html={sequence.description} />
              </div>
            )}
          </div>

          {/* Rating display */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            padding: '0 16px',
          }}>
            <span style={{ fontSize: 36, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>
              {sequence.avg_score ?? '—'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {sequence.rating_count ?? 0} ratings
            </span>
          </div>
        </div>

        {/* Author + actions row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 20,
          paddingTop: 16,
          borderTop: '0.5px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Posted by{' '}
            {sequence.author?.username ? (
              <a
                href={`/user/${sequence.author.username}`}
                style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              >
                {sequence.author.username}
              </a>
            ) : (
              <strong style={{ color: 'var(--text-primary)' }}>{sequence.author?.username}</strong>
            )}
            {' · '}{formatDistanceToNow(new Date(sequence.created_at), { addSuffix: true })}
            {sequence.patch_version && ` · Patch ${sequence.patch_version}`}
            {isStale && (
              <>
                <br />
                <span style={{ fontSize: 12, color: '#a06c00' }}>
                  Built for {sequence.patch_version ?? 'an unrecorded patch'} — current patch is {currentPatch}. Last updated {daysSinceUpdate} days ago.
                </span>
              </>
            )}
            {sequence.original_author && sequence.original_author.trim() && (
              <>
                <br />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Originally created by <strong style={{ color: 'var(--text-secondary)' }}>{sequence.original_author}</strong>
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {isAuthor && (
              <>
                <button
                  onClick={() => router.push(`/post?edit=${sequence.id}&mode=edit`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 'var(--radius-md)',
                    border: '0.5px solid var(--border-strong)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)',
                  }}
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  onClick={() => router.push(`/sequences/${sequence.slug}/update`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 'var(--radius-md)',
                    border: '0.5px solid var(--accent)',
                    background: 'transparent',
                    color: 'var(--accent)',
                    cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)',
                  }}
                >
                  ↑ Update
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 'var(--radius-md)',
                    border: '0.5px solid rgba(192,57,43,0.4)',
                    background: 'rgba(192,57,43,0.08)',
                    color: '#c0392b',
                    cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)',
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </>
            )}

            {user && (
              <button onClick={toggleSave} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 'var(--radius-md)',
                border: '0.5px solid var(--border-strong)',
                background: saved ? 'var(--accent-subtle)' : 'var(--bg-primary)',
                color: saved ? 'var(--accent-text)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)',
              }}>
                <Bookmark size={14} />
                {saved ? 'Saved' : 'Save'}
              </button>
            )}
            {warcraftLogsHref && (
              <a href={warcraftLogsHref} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 'var(--radius-md)',
                border: '0.5px solid var(--border-strong)',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                textDecoration: 'none', fontSize: 13,
              }}>
                <ExternalLink size={14} />
                Warcraft Logs
              </a>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'flex-start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* GRIP string import */}
          {selectedVersion && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
            }}>
              {versions.length > 1 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                      Version:
                    </span>
                    {versions.map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <button
                          onClick={() => setSelectedVersion(v)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: selectedVersion.id === v.id
                              ? '0.5px solid var(--accent)'
                              : '0.5px solid var(--border-strong)',
                            background: selectedVersion.id === v.id
                              ? 'var(--accent)' : 'var(--bg-secondary)',
                            color: selectedVersion.id === v.id ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: selectedVersion.id === v.id ? 600 : 400,
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {v.version_label}
                          {v.id === sequence.current_version_id && (
                            <span style={{ marginLeft: 4, opacity: 0.75, fontSize: 10 }}>current</span>
                          )}
                        </button>
                        {isAuthor && v.id !== sequence.current_version_id && (
                          <button
                            onClick={() => setVersionToDelete(v.id)}
                            title="Delete this version"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '2px 4px',
                              borderRadius: 4,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#c0392b')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!isCurrentVersion && (
                    <div style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: '#d97706',
                      fontFamily: 'var(--font-sans)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      ⚠ Older version. Switch to {versions.find(v => v.id === sequence.current_version_id)?.version_label ?? 'the current version'} for the latest.
                    </div>
                  )}
                  {selectedVersion.changelog && (
                    <div style={{
                      marginTop: 10,
                      padding: '8px 10px',
                      background: 'var(--bg-tertiary)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-sans)',
                      lineHeight: 1.5,
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>What changed: </span>
                      {selectedVersion.changelog}
                    </div>
                  )}
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 12,
              }}>
                <h2 style={{ fontSize: 14, fontWeight: 500 }}>GRIP import string</h2>
                <button onClick={() => {
                  const str = selectedVersion?.grip_string
                  if (!str) return
                  sessionStorage.setItem('workshop_build_import', str)
                  window.location.assign('/workshop/build')
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--accent)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--accent)',
                  cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)',
                  marginRight: 6,
                }}>
                  <Wrench size={13} /> Open in Builder
                </button>
                <button onClick={copyGripString} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--border-strong)',
                  background: copied ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                  color: copied ? 'var(--accent-text)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)',
                }}>
                  {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy string</>}
                </button>
              </div>
              <div className="grip-string" style={{ maxHeight: 120, overflow: 'hidden' }}>
                {selectedVersion.grip_string}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                In-game: type /grip import and paste this string
              </p>
            </div>
          )}

          {/* Collection tab display */}
          {isCollection && activeEntry && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
            }}>
              <div style={{
                display: 'flex', gap: 4, marginBottom: 16,
                borderBottom: '0.5px solid var(--border)',
                paddingBottom: 12,
              }}>
                {collectionEntries.map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveCollectionTab(i); setShowAllSteps(false) }}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: activeCollectionTab === i
                        ? '0.5px solid var(--accent)'
                        : '0.5px solid var(--border-strong)',
                      background: activeCollectionTab === i ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: activeCollectionTab === i ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 12, fontWeight: activeCollectionTab === i ? 600 : 400,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {entry.name}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {activeEntry.stepFunction && (
                  <Badge color="#888">{activeEntry.stepFunction}</Badge>
                )}
                <Badge color="#888">{activeEntry.steps.length} steps</Badge>
              </div>

              {activeEntry.talent_string && (
                <div style={{
                  marginBottom: 14,
                  padding: '8px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '0.5px solid var(--border)',
                }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Talent build</p>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    wordBreak: 'break-all', color: 'var(--text-secondary)',
                  }}>
                    {activeEntry.talent_string}
                  </div>
                </div>
              )}

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {(showAllSteps ? activeEntry.steps : activeEntry.steps.slice(0, 8)).map((step: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '6px 0',
                    borderBottom: '0.5px solid var(--border)',
                  }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 24, textAlign: 'right' }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      {(typeof step === 'string' ? step : step.text || '').split('\n').map((line: string, j: number) => (
                        <div key={j} style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          <StepLine text={line} />
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'flex-start', paddingTop: 2 }}>
                      {typeof step === 'object' && step.char_count ? `${step.char_count}/255` : ''}
                    </span>
                  </div>
                ))}
              </div>
              {activeEntry.steps.length > 8 && (
                <button onClick={() => setShowAllSteps(s => !s)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  marginTop: 12, background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 12, color: 'var(--accent)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {showAllSteps
                    ? <><ChevronUp size={13} /> Show fewer steps</>
                    : <><ChevronDown size={13} /> Show all {activeEntry.steps.length} steps</>
                  }
                </button>
              )}
            </div>
          )}

          {/* Single sequence steps display */}
          {!isCollection && steps.length > 0 && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
            }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
                Steps ({steps.length})
              </h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {visibleSteps.map((step: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: 10,
                    padding: '6px 0',
                    borderBottom: '0.5px solid var(--border)',
                  }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 24, textAlign: 'right' }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      {(typeof step === 'string' ? step : step.text || '').split('\n').map((line: string, j: number) => (
                        <div key={j} style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          <StepLine text={line} />
                        </div>
                      ))}
                    </div>
                    <span style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      alignSelf: 'flex-start',
                      paddingTop: 2,
                    }}>
                      {typeof step === 'object' && step.char_count ? `${step.char_count}/255` : ''}
                    </span>
                  </div>
                ))}
              </div>
              {steps.length > 8 && (
                <button onClick={() => setShowAllSteps(s => !s)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  marginTop: 12, background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 12, color: 'var(--accent)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {showAllSteps
                    ? <><ChevronUp size={13} /> Show fewer steps</>
                    : <><ChevronDown size={13} /> Show all {steps.length} steps</>
                  }
                </button>
              )}
            </div>
          )}

          {/* Comments */}
          <div style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
              Comments ({totalComments})
            </h2>

            {user ? (
              <div style={{ marginBottom: 20 }}>
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Share your experience, ask a question, or suggest improvements..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '0.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)', fontSize: 13,
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                    resize: 'vertical', fontFamily: 'var(--font-sans)',
                    marginBottom: 8,
                  }}
                />
                <button onClick={submitComment} disabled={!commentText.trim()} style={{
                  padding: '7px 16px', background: 'var(--accent)', color: 'white',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                }}>
                  Post comment
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                <a href="/auth/login" style={{ color: 'var(--accent)' }}>Sign in</a> to leave a comment.
              </p>
            )}

            {comments.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No comments yet. Be the first!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {comments.map(comment => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    user={user}
                    isOwner={isOwner}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    onReplyClick={(id) => {
                      setReplyingTo(replyingTo === id ? null : id)
                      setReplyText('')
                    }}
                    onReplyTextChange={setReplyText}
                    onReplySubmit={submitReply}
                    onDelete={deleteComment}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Rate this sequence */}
          <div style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Rate this sequence</h3>
            {user ? (
              <div>
                <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      onClick={() => selectScore(n)}
                      onMouseEnter={() => setHoveredRating(n)}
                      onMouseLeave={() => setHoveredRating(null)}
                      style={{
                        width: 22, height: 22, borderRadius: 4,
                        border: 'none', cursor: 'pointer',
                        background: n <= (hoveredRating ?? selectedScore ?? userRating ?? 0)
                          ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: n <= (hoveredRating ?? selectedScore ?? userRating ?? 0) ? 'white' : 'var(--text-muted)',
                        fontSize: 10, fontWeight: 500,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {userRating && selectedScore === null && (
                  <p style={{ fontSize: 11, color: 'var(--accent)' }}>
                    You rated this {userRating}/10
                  </p>
                )}
                {selectedScore !== null && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Nothing is saved yet — pick a score of {selectedScore}/10, add detail if you like, then confirm.
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {selectedScore <= 5 ? 'What went wrong? (optional)' : 'What worked well? (optional)'}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {(selectedScore <= 5
                        ? ["Doesn't work as described", 'Misses key abilities', 'Weak AoE', 'Weak DPS', 'Confusing setup', 'Talent mismatch']
                        : ['Rotation nailed it', 'Strong AoE', 'Strong DPS', 'Easy to set up', 'Reliable in combat', 'Great for learning the spec', 'Smooth in Mythic+']
                      ).map(tag => (
                        <button
                          key={tag}
                          onClick={() => setPendingTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag])}
                          style={{
                            padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                            border: '0.5px solid var(--border)', cursor: 'pointer',
                            fontSize: 11, fontFamily: 'var(--font-sans)',
                            background: pendingTags.includes(tag) ? 'var(--accent)' : 'var(--bg-secondary)',
                            color: pendingTags.includes(tag) ? 'white' : 'var(--text-secondary)',
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={tagNote}
                      onChange={e => setTagNote(e.target.value)}
                      placeholder="Add a comment (optional, posts publicly)"
                      rows={2}
                      style={{
                        width: '100%', padding: '6px 8px', marginBottom: 8,
                        border: '0.5px solid var(--border)',
                        borderRadius: 'var(--radius-md)', fontSize: 11,
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        resize: 'vertical', fontFamily: 'var(--font-sans)',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={confirmRating}
                        disabled={confirming}
                        style={{
                          padding: '5px 12px', background: 'var(--accent)', color: 'white',
                          border: 'none', borderRadius: 'var(--radius-md)', cursor: confirming ? 'not-allowed' : 'pointer',
                          fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-sans)',
                          opacity: confirming ? 0.7 : 1,
                        }}
                      >
                        {confirming ? 'Saving...' : `Confirm ${selectedScore}/10 rating`}
                      </button>
                      <button
                        onClick={() => { setSelectedScore(null); setPendingTags([]); setTagNote('') }}
                        disabled={confirming}
                        style={{
                          padding: '5px 12px', background: 'none', color: 'var(--text-muted)',
                          border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-sans)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                      Tags are private to the sequence author. Comments are public.
                    </p>
                  </div>
                )}
                {tagsSubmitted && selectedScore === null && (
                  <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 8 }}>
                    Thanks for the detail.
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <a href="/auth/login" style={{ color: 'var(--accent)' }}>Sign in</a> to rate
              </p>
            )}
          </div>

          {/* Rating breakdown - author only */}
          {isAuthor && tagBreakdown.length > 0 && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
                Why people are rating this
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tagBreakdown.map(({ tag, count }) => (
                  <div key={tag} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, color: 'var(--text-secondary)',
                  }}>
                    <span>{tag}</span>
                    <span style={{ color: 'var(--text-muted)' }}>×{count}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
                Only visible to you as the sequence author.
              </p>
            </div>
          )}

          {/* Metadata */}
          <div style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Details</h3>
            <table style={{ width: '100%', fontSize: 12 }}>
              <tbody>
                {[
                  ['Class', sequence.class_name],
                  ['Spec', sequence.spec_name],
                  ['Hero talent', selectedVersion?.hero_talent],
                  ['Content', CONTENT_TYPES.find(c => c.value === (selectedVersion?.content_type ?? sequence.content_type))?.label],
                  ['Step function', selectedVersion?.step_function],
                  ['Steps', sequence.step_count],
                  ['GRIP version', selectedVersion?.grip_version],
                  ['Patch', sequence.patch_version],
                  ['Views', sequence.view_count?.toLocaleString()],
                  ['Comments', sequence.comment_count?.toLocaleString()],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <tr key={label as string}>
                    <td style={{ color: 'var(--text-muted)', padding: '4px 0', verticalAlign: 'top' }}>{label}</td>
                    <td style={{ color: 'var(--text-secondary)', padding: '4px 0', textAlign: 'right' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ST / MT linked variant */}
          {!isCollection && (linkedSequence || canManageLinks) && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
                ST / MT variant
              </h3>

              {linkedSequence ? (
                <div>
                  <a
                    href={`/sequences/${linkedSequence.slug}`}
                    style={{
                      display: 'block',
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      border: '0.5px solid var(--border-strong)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      marginBottom: canManageLinks ? 10 : 0,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {linkedSequence.title}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10, padding: '1px 5px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent-text)',
                      }}>
                        {CONTENT_TYPES.find(c => c.value === linkedSequence.content_type)?.label ?? linkedSequence.content_type}
                      </span>
                      {linkedSequence.hero_talent && (
                        <span style={{
                          fontSize: 10, padding: '1px 5px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(163,48,201,0.1)',
                          color: '#a330c9',
                        }}>
                          {linkedSequence.hero_talent}
                        </span>
                      )}
                    </div>
                  </a>

                  {canManageLinks && (
                    <button
                      onClick={handleUnlink}
                      disabled={unlinkLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        width: '100%', padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '0.5px solid var(--border-strong)',
                        background: 'none',
                        color: 'var(--text-muted)',
                        cursor: unlinkLoading ? 'not-allowed' : 'pointer',
                        fontSize: 11, fontFamily: 'var(--font-sans)',
                        opacity: unlinkLoading ? 0.6 : 1,
                      }}
                    >
                      <Link2Off size={11} />
                      {unlinkLoading ? 'Unlinking...' : 'Remove link'}
                    </button>
                  )}
                </div>
              ) : canManageLinks ? (
                <div>
                  {!showLinkInput ? (
                    <button
                      onClick={() => { setShowLinkInput(true); setLinkError(null) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        width: '100%', padding: '7px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '0.5px solid var(--border-strong)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: 12,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <Link2 size={12} />
                      Link ST / MT variant
                    </button>
                  ) : (
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>
                        Open the other sequence on lazygrip.net, copy its URL, and paste it below. You can paste the full URL or just the last part after <span style={{ fontFamily: 'var(--font-mono)' }}>/sequences/</span>.
                      </p>
                      <input
                        type="text"
                        value={linkSlug}
                        onChange={e => setLinkSlug(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleLink() }}
                        placeholder="lazygrip.net/sequences/your-sequence"
                        autoFocus
                        style={{
                          width: '100%', padding: '7px 10px',
                          border: `0.5px solid ${linkError ? '#c0392b' : 'var(--border-strong)'}`,
                          borderRadius: 'var(--radius-md)', fontSize: 12,
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          marginBottom: 6,
                          boxSizing: 'border-box',
                        }}
                      />
                      {linkError && (
                        <p style={{ fontSize: 11, color: '#c0392b', marginBottom: 6 }}>{linkError}</p>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={handleLink}
                          disabled={!linkSlug.trim() || linkLoading}
                          style={{
                            flex: 1, padding: '6px 10px',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'var(--accent)',
                            color: 'white',
                            cursor: (!linkSlug.trim() || linkLoading) ? 'not-allowed' : 'pointer',
                            fontSize: 12, fontWeight: 500,
                            fontFamily: 'var(--font-sans)',
                            opacity: (!linkSlug.trim() || linkLoading) ? 0.6 : 1,
                          }}
                        >
                          {linkLoading ? 'Linking...' : 'Link'}
                        </button>
                        <button
                          onClick={() => { setShowLinkInput(false); setLinkSlug(''); setLinkError(null) }}
                          disabled={linkLoading}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-md)',
                            border: '0.5px solid var(--border-strong)',
                            background: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer', fontSize: 12,
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Talent string */}
          {!isCollection && selectedVersion?.talent_string && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Talent build</h3>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                background: 'var(--bg-tertiary)',
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                wordBreak: 'break-all',
                color: 'var(--text-secondary)',
              }}>
                {selectedVersion.talent_string}
              </div>
            </div>
          )}

          {/* Performance notes */}
          {selectedVersion?.performance_notes && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Performance notes</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {selectedVersion.performance_notes}
              </p>
            </div>
          )}

          {/* Warcraft Logs */}
          {warcraftLogsHref && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Warcraft Logs</h3>
              <a
                href={warcraftLogsHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}
              >
                View log report
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

interface CommentThreadProps {
  comment: Comment
  user: any
  isOwner: boolean
  replyingTo: string | null
  replyText: string
  onReplyClick: (id: string) => void
  onReplyTextChange: (text: string) => void
  onReplySubmit: (parentId: string) => void
  onDelete: (id: string) => void
  depth?: number
}

function CommentThread({
  comment, user, isOwner, replyingTo, replyText,
  onReplyClick, onReplyTextChange, onReplySubmit, onDelete, depth = 0,
}: CommentThreadProps) {
  const isReplying = replyingTo === comment.id
  const canDelete = user && (user.id === comment.author_id || isOwner)

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {depth > 0 && (
          <div style={{ paddingTop: 6, color: 'var(--text-muted)', flexShrink: 0 }}>
            <CornerDownRight size={13} />
          </div>
        )}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--accent-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 500, color: 'var(--accent-text)',
          flexShrink: 0,
        }}>
          {(comment.author?.username ?? '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {comment.author?.username ? (
                <a
                  href={`/user/${comment.author.username}`}
                  style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                >
                  {comment.author.username}
                </a>
              ) : comment.author?.username}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
              {user && (
                <button
                  onClick={() => onReplyClick(comment.id)}
                  style={{
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 11,
                    color: isReplying ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-sans)',
                    padding: '2px 4px', borderRadius: 4,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = isReplying ? 'var(--accent)' : 'var(--text-muted)')}
                >
                  {isReplying ? 'Cancel' : 'Reply'}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(comment.id)}
                  title="Delete comment"
                  style={{
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--text-muted)',
                    padding: '2px 4px', borderRadius: 4,
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c0392b')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
		  {comment.body}
		  </p>

          {isReplying && (
            <div style={{ marginTop: 10 }}>
              <textarea
                value={replyText}
                onChange={e => onReplyTextChange(e.target.value)}
                placeholder={`Reply to ${comment.author?.username}...`}
                rows={2}
                autoFocus
                style={{
                  width: '100%', padding: '8px 10px',
                  border: '0.5px solid var(--accent)',
                  borderRadius: 'var(--radius-md)', fontSize: 13,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  resize: 'vertical', fontFamily: 'var(--font-sans)',
                  marginBottom: 6,
                }}
              />
              <button
                onClick={() => onReplySubmit(comment.id)}
                disabled={!replyText.trim()}
                style={{
                  padding: '6px 14px', background: 'var(--accent)', color: 'white',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Post reply
              </button>
            </div>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {comment.replies.map(reply => (
            <CommentThread
              key={reply.id}
              comment={reply}
              user={user}
              isOwner={isOwner}
              replyingTo={replyingTo}
              replyText={replyText}
              onReplyClick={onReplyClick}
              onReplyTextChange={onReplyTextChange}
              onReplySubmit={onReplySubmit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function flattenComments(nested: Comment[]): Comment[] {
  const result: Comment[] = []
  function walk(comments: Comment[]) {
    for (const c of comments) {
      result.push(c)
      if (c.replies?.length) walk(c.replies)
    }
  }
  walk(nested)
  return result
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const hex = color.startsWith('#') ? color.slice(1) : 'aaaaaa'
  const r = parseInt(hex.slice(0,2), 16) || 100
  const g = parseInt(hex.slice(2,4), 16) || 100
  const b = parseInt(hex.slice(4,6), 16) || 100
  return (
    <span style={{
      fontSize: 12, fontWeight: 500, padding: '3px 8px',
      borderRadius: 'var(--radius-sm)',
      background: `rgba(${r},${g},${b},0.12)`,
      color: color === '#888' ? 'var(--text-secondary)' : color,
      border: `0.5px solid rgba(${r},${g},${b},0.2)`,
    }}>
      {children}
    </span>
  )
}

function StepLine({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]|\/\w+)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('/')) return <span key={i} style={{ color: 'var(--accent)' }}>{part}</span>
        if (part.startsWith('[')) return <span key={i} style={{ color: '#5a8dee' }}>{part}</span>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
