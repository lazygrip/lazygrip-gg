'use client'
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface UsernameRequiredModalProps {
  userId: string
  onSuccess: (newUsername: string) => void
  onClose: () => void
}

// Mirrors public.profiles_username_format CHECK constraint:
//   username !~ '^user_[0-9a-f]{8}$' and username ~ '^[A-Za-z0-9_.-]{2,32}$'
// Keep in sync -- this is a UX pre-check only, the DB constraint is the real
// enforcement and will reject anything this regex missed.
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{2,32}$/
const AUTO_GENERATED_PATTERN = /^user_[0-9a-f]{8}$/

export default function UsernameRequiredModal({ userId, onSuccess, onClose }: UsernameRequiredModalProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()

    if (!USERNAME_PATTERN.test(trimmed)) {
      setError('2-32 characters: letters, numbers, underscores, hyphens, and periods only.')
      return
    }
    if (AUTO_GENERATED_PATTERN.test(trimmed)) {
      setError('That username is reserved. Please choose another.')
      return
    }

    setSubmitting(true)
    setError('')

    const supabase = createClient()
    // Sets both fields has_completed_onboarding() checks, not just username.
    // This modal is the backstop for someone who reaches a write action
    // without having gone through /welcome (stale session, etc), so it needs
    // to satisfy the full gate in one step, same as /welcome does.
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: trimmed, terms_accepted_at: new Date().toISOString() })
      .eq('id', userId)

    setSubmitting(false)

    if (updateError) {
      // 23505 = unique_violation (Postgres code surfaced via PostgREST)
      if (updateError.code === '23505') {
        setError('That username is already taken.')
      } else if (updateError.code === '23514') {
        setError('That username isn\'t allowed. Try letters, numbers, underscores, hyphens, or periods.')
      } else {
        setError('Something went wrong. Please try again.')
      }
      return
    }

    onSuccess(trimmed)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="username-modal-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-primary)', border: '0.5px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)', padding: 28, maxWidth: 420, width: '100%',
      }}>
        <h2 id="username-modal-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
          Set a username to continue
        </h2>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
          To comment, rate, or post sequences on LazyGrip, you need a username on your profile
          and to agree to keep things respectful and on-topic. This only takes a second.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Choose a username..."
            disabled={submitting}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 'var(--text-sm)',
              border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)', marginBottom: 8,
            }}
          />

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(196,30,58,0.08)', border: '0.5px solid rgba(196,30,58,0.2)',
              borderRadius: 'var(--radius-md)', padding: '8px 12px',
              color: '#c41e3a', fontSize: 'var(--text-xs)', marginBottom: 12,
            }}>
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              type="submit"
              disabled={submitting || !value.trim()}
              style={{
                background: 'var(--accent)', color: 'white', border: 'none',
                borderRadius: 'var(--radius-md)', padding: '10px 20px',
                fontSize: 'var(--text-sm)', fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting || !value.trim() ? 0.6 : 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {submitting ? 'Saving...' : 'Save username'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                padding: '10px 20px', fontSize: 'var(--text-sm)', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Not now
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
