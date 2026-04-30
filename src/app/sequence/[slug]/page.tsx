'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Copy, Check, Star, Bookmark, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Sequence, Comment } from '@/types'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import { formatDistanceToNow } from 'date-fns'

export default function SequencePage() {
  const params = useParams()
  const slug = params.slug as string
  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')
  const [user, setUser] = useState<any>(null)
  const [saved, setSaved] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchSequence()
  }, [slug])

  async function fetchSequence() {
    setLoading(true)
    const { data: seq } = await supabase
      .from('sequences')
      .select('*, author:profiles(*)')
      .eq('slug', slug)
      .eq('is_published', true)
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

      setComments(cmts || [])
    }
    setLoading(false)
  }

  async function copyGripString() {
    if (!sequence?.grip_string) return
    await navigator.clipboard.writeText(sequence.grip_string)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function submitRating(score: number) {
    if (!user || !sequence) return
    setUserRating(score)
    await supabase.from('ratings').upsert({
      sequence_id: sequence.id,
      user_id: user.id,
      score,
    }, { onConflict: 'sequence_id,user_id' })
  }

  async function submitComment() {
    if (!user || !sequence || !commentText.trim()) return
    const { data } = await supabase
      .from('comments')
      .insert({ sequence_id: sequence.id, author_id: user.id, body: commentText.trim() })
      .select('*, author:profiles(*)')
      .single()
    if (data) setComments(c => [...c, data])
    setCommentText('')
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
  const steps = sequence.raw_steps || []
  const visibleSteps = showAllSteps ? steps : steps.slice(0, 8)
  const contentLabel = CONTENT_TYPES.find(c => c.value === sequence.content_type)?.label ?? sequence.content_type

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>

      {/* Header card */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        marginBottom: 16,
        borderTop: `3px solid ${classColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              marginBottom: 10,
              color: 'var(--text-primary)',
            }}>
              {sequence.title}
            </h1>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              <Badge color={classColor}>{sequence.class_name}</Badge>
              {sequence.spec_name && <Badge color="#5a8dee">{sequence.spec_name}</Badge>}
              <Badge color="#1D9E75">{contentLabel}</Badge>
              {sequence.hero_talent && <Badge color="#a330c9">{sequence.hero_talent}</Badge>}
              {sequence.grip_version && <Badge color="#888">GRIP {sequence.grip_version}</Badge>}
              {sequence.step_function && <Badge color="#888">{sequence.step_function}</Badge>}
              {sequence.step_count && <Badge color="#888">{sequence.step_count} steps</Badge>}
            </div>

            {sequence.description && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                {sequence.description}
              </p>
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
            Posted by <strong style={{ color: 'var(--text-primary)' }}>
              {sequence.author?.username}
            </strong>
            {' · '}{formatDistanceToNow(new Date(sequence.created_at), { addSuffix: true })}
            {sequence.patch_version && ` · Patch ${sequence.patch_version}`}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
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
            {sequence.warcraftlogs_url && (
              <a href={sequence.warcraftlogs_url} target="_blank" rel="noopener noreferrer" style={{
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
          {sequence.grip_string && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 12,
              }}>
                <h2 style={{ fontSize: 14, fontWeight: 500 }}>GRIP import string</h2>
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
                {sequence.grip_string}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                In-game: type /gems import and paste this string
              </p>
            </div>
          )}

          {/* Steps display */}
          {steps.length > 0 && (
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
              Comments ({comments.length})
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
                  <div key={comment.id} style={{ display: 'flex', gap: 10 }}>
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
                          {comment.author?.username}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {comment.body}
                      </p>
                    </div>
                  </div>
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
                      onClick={() => submitRating(n)}
                      onMouseEnter={() => setHoveredRating(n)}
                      onMouseLeave={() => setHoveredRating(null)}
                      style={{
                        width: 22, height: 22, borderRadius: 4,
                        border: 'none', cursor: 'pointer',
                        background: n <= (hoveredRating ?? userRating ?? 0)
                          ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: n <= (hoveredRating ?? userRating ?? 0) ? 'white' : 'var(--text-muted)',
                        fontSize: 10, fontWeight: 500,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {userRating && (
                  <p style={{ fontSize: 11, color: 'var(--accent)' }}>
                    You rated this {userRating}/10
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <a href="/auth/login" style={{ color: 'var(--accent)' }}>Sign in</a> to rate
              </p>
            )}
          </div>

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
                  ['Hero talent', sequence.hero_talent],
                  ['Content', CONTENT_TYPES.find(c => c.value === sequence.content_type)?.label],
                  ['Step function', sequence.step_function],
                  ['Steps', sequence.step_count],
                  ['GRIP version', sequence.grip_version],
                  ['Patch', sequence.patch_version],
                  ['Views', sequence.view_count?.toLocaleString()],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <tr key={label as string}>
                    <td style={{ color: 'var(--text-muted)', padding: '4px 0', verticalAlign: 'top' }}>{label}</td>
                    <td style={{ color: 'var(--text-secondary)', padding: '4px 0', textAlign: 'right' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Talent string */}
          {sequence.talent_string && (
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
                {sequence.talent_string}
              </div>
            </div>
          )}

          {/* Performance notes */}
          {sequence.performance_notes && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Performance notes</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {sequence.performance_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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
