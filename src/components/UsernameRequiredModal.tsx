'use client'
import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface UsernameRequiredModalProps {
  userId: string
  onSuccess: (newUsername: string) => void
  onClose: () => void
}

// Mirrors public.profiles_username_format CHECK constraint:
// username !~ '^user_[0-9a-f]{8}$' and username ~ '^[A-Za-z0-9_.-]{2,32}$'
// Keep in sync -- this is a UX pre-check only, the DB constraint is the real
// enforcement and will reject anything this regex missed.
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{2,32}$/
const AUTO_GENERATED_PATTERN = /^user_[0-9a-f]{8}$/

export default function UsernameRequiredModal({ userId, onSuccess, onClose }: UsernameRequiredModalProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // FIX (2026-08-19): this modal used to always show a blank username field
  // and always overwrite the profile's username on submit, with no check for
  // whether a real one already existed. has_completed_onboarding() requires
  // BOTH has_custom_username() AND terms_accepted_at, so an account can have
  // a perfectly good custom username and still fail the gate purely on the
  // terms_accepted_at half -- confirmed live: 183 profiles are in exactly
  // this state (real username, terms_accepted_at null). Every one of them
  // would have hit this modal on their first post attempt and had whatever
  // they typed silently replace their existing username, with no warning
  // that a username already existed. /welcome already avoided this with its
  // needsUsername branch; this modal is the backstop path for the same gate
  // and needs the same branch, not a second, looser copy of the write.
  //
  // checking stays true (spinner state) until the profile read resolves, so
  // the form never renders with a guessed default -- same reasoning /welcome
  // uses for its own `checking` state.
  const [checking, setChecking] = useState(true)
  const [needsUsername, setNeedsUsername] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single()

      if (cancelled) return

      if (fetchError) {
        // Fail toward the safer branch: if we can't confirm a real username
        // already exists, ask for one rather than silently skipping straight
        // to terms-only and leaving has_custom_username still false. Worst
        // case here is asking for a username that already exists, which the
        // 23505 handler below already catches and reports clearly -- better
        // than the alternative failure mode this fix exists to close.
        console.error('[UsernameRequiredModal] Failed to load profile:', fetchError)
        setLoadError(true)
        setNeedsUsername(true)
        setChecking(false)
        return
      }

      const hasRealUsername = !!data?.username && !AUTO_GENERATED_PATTERN.test(data.username)
      setNeedsUsername(!hasRealUsername)
      setChecking(false)
    }

    loadProfile()
    return () => { cancelled = true }
  }, [userId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (needsUsername) {
      const trimmed = value.trim()
      if (!USERNAME_PATTERN.test(trimmed)) {
        setError('2-32 characters: letters, numbers, underscores, hyphens, and periods only.')
        return
      }
      if (AUTO_GENERATED_PATTERN.test(trimmed)) {
        setError('That username is reserved. Please choose another.')
        return
      }
    }

    setSubmitting(true)
    setError('')

    const supabase = createClient()
    // Sets every field has_completed_onboarding() AND is_verified_poster()
    // check, not just username. This modal is the backstop for someone who
    // reaches a write action without having gone through /welcome (stale
    // session, an account whose terms_accepted_at was never set despite
    // already having a real username, etc), so it needs to satisfy both
    // gates in one step, same as /welcome does.
    //
    // username and display_name are ONLY included in the update when
    // needsUsername is true -- an account that already has a real username
    // gets terms_accepted_at set and nothing else touched. This is the fix:
    // previously this update unconditionally overwrote username (and, after
    // the display_name fix earlier today, display_name too) with whatever
    // was typed, for every caller, including the 183 accounts that already
    // had a real username and only needed terms_accepted_at.
    //
    // display_name is a separate, user-editable column (see
    // src/lib/public-name.ts) that nothing in onboarding used to write --
    // is_verified_poster (migration 007) requires it non-empty, so an
    // account that only ever passed through this modal previously came out
    // the other side still permanently blocked from posting, with no
    // indication why. Defaulting it to the username, only on first set,
    // closes that; it's a starting value the user can still change later
    // from /profile.
    const update: Record<string, string> = { terms_accepted_at: new Date().toISOString() }
    if (needsUsername) {
      const trimmed = value.trim()
      update.username = trimmed
      update.display_name = trimmed
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(update)
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

    onSuccess(needsUsername ? value.trim() : '')
  }

  if (checking) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', padding: 20,
        }}
      >
        <div style={{
          background: 'var(--bg-primary)', border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)', padding: 28, maxWidth: 420, width: '100%',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Loading...</p>
        </div>
      </div>
    )
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
          {needsUsername ? 'Set a username to continue' : 'One quick thing before you continue'}
        </h2>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
          {needsUsername
            ? 'To comment, rate, or post sequences on LazyGrip, you need a username on your profile and to agree to keep things respectful and on-topic. This only takes a second.'
            : 'To comment, rate, or post sequences on LazyGrip, you need to agree to keep things respectful and on-topic. This only takes a second.'}
        </p>

        {loadError && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
            We couldn&apos;t confirm whether you already have a username, so we&apos;re asking again just in case.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {needsUsername && (
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
          )}

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
              disabled={submitting || (needsUsername && !value.trim())}
              style={{
                background: 'var(--accent)', color: 'white', border: 'none',
                borderRadius: 'var(--radius-md)', padding: '10px 20px',
                fontSize: 'var(--text-sm)', fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting || (needsUsername && !value.trim()) ? 0.6 : 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {submitting ? 'Saving...' : needsUsername ? 'Save username' : 'Continue'}
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
