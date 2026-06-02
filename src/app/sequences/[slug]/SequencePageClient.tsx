'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import RatingWidget from '@/components/RatingWidget'
import CommentSection from '@/components/CommentSection'

const supabase = createClient()

interface SequenceVersion {
  id: string
  version_number: number
  version_label: string
  grip_string: string
  changelog: string | null
  created_at: string
  author_id: string
}

interface Sequence {
  id: string
  title: string
  slug: string
  description: string | null
  class_id: number
  class_name: string
  spec_id: number | null
  spec_name: string | null
  content_type: string
  hero_talent: string | null
  patch_version: string | null
  grip_version: string | null
  step_function: string | null
  step_count: number | null
  grip_string: string | null
  raw_steps: any[] | null
  keybind_info: any | null
  talent_string: string | null
  warcraftlogs_url: string | null
  performance_notes: string | null
  view_count: number
  save_count: number
  avg_score: number | null
  rating_count: number
  comment_count: number
  author_id: string
  current_version_id: string | null
  author: {
    username: string
    avatar_url: string | null
  }
  created_at: string
  updated_at: string
}

export default function SequencePageClient() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [versions, setVersions] = useState<SequenceVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<SequenceVersion | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (slug) {
      fetchSequence()
      fetchCurrentUser()
    }
  }, [slug])

  async function fetchSequence() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('sequences')
      .select(`
        *,
        author:profiles(username, avatar_url)
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (error || !data) {
      setError('Sequence not found')
      setLoading(false)
      return
    }

    setSequence(data)

    const { data: versionData, error: versionError } = await supabase
      .from('sequence_versions')
      .select('id, version_number, version_label, grip_string, changelog, created_at, author_id')
      .eq('sequence_id', data.id)
      .order('version_number', { ascending: false })

    if (versionError || !versionData || versionData.length === 0) {
      setError('No versions found for this sequence')
      setLoading(false)
      return
    }

    setVersions(versionData)

    const current = versionData.find(v => v.id === data.current_version_id) ?? versionData[0]
    setSelectedVersion(current)

    setLoading(false)
  }

  async function fetchCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  async function handleCopy() {
    if (!selectedVersion?.grip_string) return
    try {
      await navigator.clipboard.writeText(selectedVersion.grip_string)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = selectedVersion.grip_string
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleSave() {
    if (!currentUser) {
      router.push('/login')
      return
    }
    setSaveLoading(true)
    if (saved) {
      await supabase
        .from('saved_sequences')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('sequence_id', sequence!.id)
      setSaved(false)
    } else {
      await supabase
        .from('saved_sequences')
        .insert({ user_id: currentUser.id, sequence_id: sequence!.id })
      setSaved(true)
    }
    setSaveLoading(false)
  }

  async function handleDelete() {
    if (!sequence) return
    setDeleteLoading(true)
    const { error } = await supabase
      .from('sequences')
      .delete()
      .eq('id', sequence.id)
    if (error) {
      alert('Failed to delete sequence')
      setDeleteLoading(false)
      return
    }
    router.push('/sequences')
  }

  const isOwner = currentUser && sequence && currentUser.id === sequence.author_id
  const isCurrentVersion = selectedVersion?.id === sequence?.current_version_id

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>Loading...</div>
      </div>
    )
  }

  if (error || !sequence || !selectedVersion) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{error || 'Sequence not found'}</div>
      </div>
    )
  }

  const contentLabels: Record<string, string> = {
    raid: 'Raid',
    mythic_plus: 'Mythic+',
    pvp: 'PvP',
    solo: 'Solo / Leveling',
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            margin: 0,
          }}>
            {sequence.title}
          </h1>
          <span style={{
            background: 'var(--accent)',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.03em',
          }}>
            {selectedVersion.version_label}
          </span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}>
          Posted by <strong>{sequence.author?.username}</strong>
          {sequence.created_at && ` · ${new Date(sequence.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          {sequence.patch_version && ` · Patch ${sequence.patch_version}`}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Description */}
          {sequence.description && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
            }}>
              <div
                style={{ color: 'var(--text-primary)', lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}
                dangerouslySetInnerHTML={{ __html: sequence.description }}
              />
            </div>
          )}

          {/* GRIP import string */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
          }}>
            {/* Version selector */}
            {versions.length > 1 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                    Version:
                  </span>
                  {versions.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVersion(v)}
                      style={{
                        background: selectedVersion.id === v.id ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: selectedVersion.id === v.id ? 'white' : 'var(--text-secondary)',
                        border: selectedVersion.id === v.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: selectedVersion.id === v.id ? 700 : 400,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {v.version_label}
                      {v.id === sequence.current_version_id && (
                        <span style={{ marginLeft: '0.3rem', opacity: 0.8 }}>current</span>
                      )}
                    </button>
                  ))}
                </div>
                {!isCurrentVersion && (
                  <div style={{
                    marginTop: '0.6rem',
                    fontSize: '0.78rem',
                    color: '#d97706',
                    fontFamily: 'var(--font-sans)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}>
                    ⚠ You are viewing an older version. Switch to {versions.find(v => v.id === sequence.current_version_id)?.version_label ?? 'the current version'} for the latest.
                  </div>
                )}
                {selectedVersion.changelog && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.6rem 0.75rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                GRIP import string
              </h3>
              <button
                onClick={handleCopy}
                style={{
                  background: copied ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: copied ? 'white' : 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s',
                }}
              >
                {copied ? '✓ Copied' : '⧉ Copy string'}
              </button>
            </div>
            <div style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              wordBreak: 'break-all',
              lineHeight: 1.5,
              maxHeight: '120px',
              overflowY: 'auto',
            }}>
              {selectedVersion.grip_string || 'No import string available'}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
              In-game: type /gems import and paste this string
            </div>
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '1rem 1.5rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-sans)' }}>
              Posted by <strong style={{ color: 'var(--text-secondary)' }}>{sequence.author?.username}</strong>
              {sequence.created_at && ` · ${new Date(sequence.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
              {sequence.patch_version && ` · Patch ${sequence.patch_version}`}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {isOwner && (
                <>
                  <Link href={`/sequences/${sequence.slug}/edit`}>
                    <button style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      ✏️ Edit
                    </button>
                  </Link>
                  <button
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                    onClick={() => router.push(`/sequences/${sequence.slug}/update`)}
                  >
                    ↑ Update
                  </button>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: '#e53e3e',
                        border: '1px solid #e53e3e',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}>
                      🗑 Delete
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>Are you sure?</span>
                      <button
                        onClick={handleDelete}
                        disabled={deleteLoading}
                        style={{
                          background: '#e53e3e',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}>
                        {deleteLoading ? 'Deleting...' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        style={{
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
              <button
                onClick={handleSave}
                disabled={saveLoading}
                style={{
                  background: saved ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: saved ? 'white' : 'var(--text-primary)',
                  border: saved ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                {saved ? '✓ Saved' : '🔖 Save'}
              </button>
              {sequence.warcraftlogs_url && (
                <a href={sequence.warcraftlogs_url} target="_blank" rel="noopener noreferrer">
                  <button style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}>
                    ↗ Warcraft Logs
                  </button>
                </a>
              )}
            </div>
          </div>

          {/* Comments */}
          <CommentSection sequenceId={sequence.id} currentUser={currentUser} />

        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Rating */}
          <RatingWidget sequenceId={sequence.id} currentUser={currentUser} />

          {/* Details */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
              Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Class', value: sequence.class_name },
                { label: 'Spec', value: sequence.spec_name },
                { label: 'Hero talent', value: sequence.hero_talent },
                { label: 'Content', value: contentLabels[sequence.content_type] ?? sequence.content_type },
                { label: 'Step function', value: sequence.step_function },
                { label: 'GRIP version', value: sequence.grip_version },
                { label: 'Patch', value: sequence.patch_version },
                { label: 'Views', value: sequence.view_count },
                { label: 'Comments', value: sequence.comment_count },
              ].map(({ label, value }) => value != null && value !== '' ? (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{String(value)}</span>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Talent build */}
          {sequence.talent_string && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
            }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                Talent build
              </h3>
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                wordBreak: 'break-all',
                lineHeight: 1.5,
              }}>
                {sequence.talent_string}
              </div>
            </div>
          )}

          {/* Performance notes */}
          {sequence.performance_notes && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
            }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                Performance notes
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                {sequence.performance_notes}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}