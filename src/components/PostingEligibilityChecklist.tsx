'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, CheckCircle2, Circle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

// Mirrors public.profiles_username_format CHECK constraint:
// username !~ '^user_[0-9a-f]{8}$' and username ~ '^[A-Za-z0-9_.-]{2,32}$'
// Keep in sync -- this is a UX pre-check only, the DB constraint is the real
// enforcement and will reject anything this regex missed.
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{2,32}$/
const AUTO_GENERATED_PATTERN = /^user_[0-9a-f]{8}$/

interface PostingEligibilityChecklistProps {
  userId: string
  // Called once every condition is satisfied. The caller decides what
  // happens next (close a modal, redirect, retry the original submit) --
  // this component's only job is getting the account to eligible=true.
  onEligible: () => void
  onClose: () => void
}

interface Eligibility {
  has_username: boolean
  has_accepted_terms: boolean
  has_display_name: boolean
  email_or_oauth_confirmed: boolean
  account_age_ok: boolean
  minutes_until_eligible: number
  eligible: boolean
}

type RowState = 'ok' | 'blocked' | 'waiting'

// WHY THIS COMPONENT EXISTS, AND WHY IT REPLACES ONE-REASON-AT-A-TIME.
//
// UsernameRequiredModal (still used elsewhere as the single-reason fallback)
// shows whichever condition useUsernameGate's checkGate() found first, then
// closes once that one condition is resolved. An account missing two
// conditions -- say, no display name AND an unconfirmed email -- clears the
// modal, resubmits, and hits the exact same class of opaque failure a
// second time on the condition nobody told them about. That's the gap this
// closes: one call to get_posting_eligibility(), every unresolved condition
// shown at once, so a person sees the whole list up front instead of
// discovering it one submit at a time.
//
// get_posting_eligibility() itself is unchanged from when it was added --
// this component is purely a new consumer of it, no DB changes needed here.
export default function PostingEligibilityChecklist({ userId, onEligible, onClose }: PostingEligibilityChecklistProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [displayNameError, setDisplayNameError] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [savingTerms, setSavingTerms] = useState(false)
  const [savingDisplayName, setSavingDisplayName] = useState(false)

  const fetchEligibility = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .rpc('get_posting_eligibility', { check_user_id: userId })
      .single()

    if (error || !data) {
      setLoadError(true)
      setLoading(false)
      return
    }

    setLoadError(false)
    setEligibility(data as Eligibility)
    setLoading(false)

    if ((data as Eligibility).eligible) {
      onEligible()
    }
  }, [userId, onEligible])

  useEffect(() => {
    fetchEligibility()
  }, [fetchEligibility])

  async function saveUsername() {
    const trimmed = username.trim()
    if (!USERNAME_PATTERN.test(trimmed)) {
      setUsernameError('2-32 characters: letters, numbers, underscores, hyphens, and periods only.')
      return
    }
    if (AUTO_GENERATED_PATTERN.test(trimmed)) {
      setUsernameError('That username is reserved. Please choose another.')
      return
    }

    setSavingUsername(true)
    setUsernameError('')
    const supabase = createClient()

    // display_name defaults to the username on first set, same reasoning as
    // /welcome and UsernameRequiredModal: is_verified_poster() requires a
    // non-empty display_name, and nothing else in onboarding writes it. If
    // the account already has a display_name (rare at this point, since
    // has_display_name would already be true and this row wouldn't render),
    // this still only sets it -- it never overwrites an existing one, since
    // this branch only renders when has_display_name is false.
    const update: Record<string, string> = { username: trimmed, display_name: trimmed }

    const { error } = await supabase.from('profiles').update(update).eq('id', userId)
    setSavingUsername(false)

    if (error) {
      if (error.code === '23505') setUsernameError('That username is already taken.')
      else if (error.code === '23514') setUsernameError('That username isn\'t allowed. Try letters, numbers, underscores, hyphens, or periods.')
      else setUsernameError('Something went wrong. Please try again.')
      return
    }

    setUsername('')
    fetchEligibility()
  }

  async function saveDisplayName() {
    const trimmed = displayName.trim()
    if (!trimmed) {
      setDisplayNameError('Enter a display name.')
      return
    }

    setSavingDisplayName(true)
    setDisplayNameError('')
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', userId)
    setSavingDisplayName(false)

    if (error) {
      setDisplayNameError('Something went wrong. Please try again.')
      return
    }

    setDisplayName('')
    fetchEligibility()
  }

  async function acceptTerms() {
    setSavingTerms(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', userId)
    setSavingTerms(false)

    if (!error) fetchEligibility()
  }

  if (loading) {
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
        <Card style={{ padding: 32, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Checking your account...</p>
        </Card>
      </div>
    )
  }

  if (loadError || !eligibility) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', padding: 20,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <Card style={{ padding: 32, maxWidth: 480, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertCircle size={18} color="#c41e3a" />
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
              Couldn&apos;t check your account
            </h2>
          </div>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
            Something went wrong checking what&apos;s needed before you can post. Try again in a moment.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="primary" onClick={() => { setLoading(true); fetchEligibility() }}>Try again</Button>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </Card>
      </div>
    )
  }

  // Rows, in the order a person can actually act on them: self-service items
  // first (username, terms, display name), then the wait-only items last,
  // since there's nothing to click on those.
  const rows: Array<{
    key: string
    label: string
    state: RowState
    detail?: string
  }> = [
    {
      key: 'username',
      label: 'Username set',
      state: eligibility.has_username ? 'ok' : 'blocked',
    },
    {
      key: 'terms',
      label: 'Community guidelines accepted',
      state: eligibility.has_accepted_terms ? 'ok' : 'blocked',
    },
    {
      key: 'display_name',
      label: 'Display name set',
      state: eligibility.has_display_name ? 'ok' : 'blocked',
    },
    {
      key: 'email',
      label: 'Email confirmed or Discord/Battle.net login',
      state: eligibility.email_or_oauth_confirmed ? 'ok' : 'waiting',
      detail: eligibility.email_or_oauth_confirmed
        ? undefined
        : 'Check your inbox for a confirmation link, or sign in again through Discord/Battle.net.',
    },
    {
      key: 'age',
      label: 'Account established',
      state: eligibility.account_age_ok ? 'ok' : 'waiting',
      detail: eligibility.account_age_ok
        ? undefined
        : `New accounts can post, comment, and rate once they're a little established -- about ${eligibility.minutes_until_eligible} more minute${eligibility.minutes_until_eligible === 1 ? '' : 's'}.`,
    },
  ]

  const allOk = rows.every(r => r.state === 'ok')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="eligibility-checklist-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', padding: 20, overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card style={{ padding: 32, maxWidth: 520, width: '100%', margin: '40px 0' }}>
        <h2 id="eligibility-checklist-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
          {allOk ? "You're all set" : 'A few things before you can post'}
        </h2>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
          {allOk
            ? 'Everything checks out. You can comment, rate, and post sequences now.'
            : 'Commenting, rating, and posting on LazyGrip need all of these. Handle what you can below -- the rest just needs a little time or a quick check of your inbox.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: allOk ? 24 : 8 }}>
          {rows.map(row => (
            <div key={row.key} style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {row.state === 'ok' && <CheckCircle2 size={17} color="var(--accent, #4a9)" style={{ flexShrink: 0 }} />}
                {row.state === 'blocked' && <Circle size={17} color="#c41e3a" style={{ flexShrink: 0 }} />}
                {row.state === 'waiting' && <Clock size={17} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                <span style={{
                  fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
                  color: row.state === 'ok' ? 'var(--text-secondary)' : 'var(--text-primary)',
                  textDecoration: row.state === 'ok' ? 'line-through' : 'none',
                  opacity: row.state === 'ok' ? 0.7 : 1,
                }}>
                  {row.label}
                </span>
              </div>

              {row.detail && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4, marginLeft: 27, lineHeight: 1.4, fontFamily: 'var(--font-sans)' }}>
                  {row.detail}
                </p>
              )}

              {/* Inline fix for username -- only rendered while it's the
                  blocking state, so filling it in and refetching removes
                  this form entirely on the next render. */}
              {row.key === 'username' && row.state === 'blocked' && (
                <div style={{ marginLeft: 27, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Choose a username..."
                      disabled={savingUsername}
                      style={{
                        flex: 1, padding: '8px 10px', fontSize: 'var(--text-sm)',
                        border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    />
                    <Button variant="secondary" onClick={saveUsername} disabled={savingUsername || !username.trim()}>
                      {savingUsername ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                  {usernameError && (
                    <p style={{ fontSize: 'var(--text-xs)', color: '#c41e3a', marginTop: 6, fontFamily: 'var(--font-sans)' }}>{usernameError}</p>
                  )}
                </div>
              )}

              {/* Inline fix for terms -- a single button, no form. */}
              {row.key === 'terms' && row.state === 'blocked' && (
                <div style={{ marginLeft: 27, marginTop: 8 }}>
                  <Button variant="secondary" onClick={acceptTerms} disabled={savingTerms}>
                    {savingTerms ? 'Saving...' : 'Agree to keep things respectful and on-topic'}
                  </Button>
                </div>
              )}

              {/* Inline fix for display name -- only reachable if someone
                  has a real username already (set through a path other than
                  this checklist or the old modal, e.g. profile edit) but
                  never had a display_name written. The username and terms
                  flows above both default display_name from the username,
                  so this row is rare, but it's a real state per the
                  is_verified_poster() query and needs its own fix path. */}
              {row.key === 'display_name' && row.state === 'blocked' && (
                <div style={{ marginLeft: 27, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Name people will see..."
                      disabled={savingDisplayName}
                      style={{
                        flex: 1, padding: '8px 10px', fontSize: 'var(--text-sm)',
                        border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    />
                    <Button variant="secondary" onClick={saveDisplayName} disabled={savingDisplayName || !displayName.trim()}>
                      {savingDisplayName ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                  {displayNameError && (
                    <p style={{ fontSize: 'var(--text-xs)', color: '#c41e3a', marginTop: 6, fontFamily: 'var(--font-sans)' }}>{displayNameError}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {allOk ? (
            <Button variant="primary" onClick={onEligible}>Continue</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => { setLoading(true); fetchEligibility() }}>Refresh</Button>
              <Button variant="secondary" onClick={onClose}>Close</Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
