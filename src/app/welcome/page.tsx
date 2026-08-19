'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

// Mirrors public.profiles_username_format CHECK constraint:
// username !~ '^user_[0-9a-f]{8}$' and username ~ '^[A-Za-z0-9_.-]{2,32}$'
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{2,32}$/
const AUTO_GENERATED_PATTERN = /^user_[0-9a-f]{8}$/

function WelcomeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Where to send the user once onboarding is complete. Falls back to /browse
  // if nothing was passed (e.g. direct navigation to /welcome).
  const returnTo = searchParams.get('returnTo') || '/browse'

  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [needsUsername, setNeedsUsername] = useState(true)
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in at all -- nothing to onboard, send back to browse.
        router.replace('/browse')
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, terms_accepted_at')
        .eq('id', user.id)
        .single()

      // Already fully done -- shouldn't normally land here (middleware should
      // have skipped the redirect), but guard against a stale link or back-button.
      if (profile?.terms_accepted_at && profile?.username && !AUTO_GENERATED_PATTERN.test(profile.username)) {
        router.replace(returnTo)
        return
      }

      // Returning user with a real username already, just missing the
      // guidelines acknowledgment -- short form, no username field.
      const hasRealUsername = !!profile?.username && !AUTO_GENERATED_PATTERN.test(profile.username)
      setNeedsUsername(!hasRealUsername)
      setChecking(false)
    }
    load()
  }, [router, returnTo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return

    if (needsUsername) {
      const trimmed = username.trim()
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
    const update: Record<string, string> = { terms_accepted_at: new Date().toISOString() }
    // display_name is a SEPARATE column from username (see src/lib/public-name.ts --
    // it's deliberately free text the account holder can customize later from
    // /profile). But is_verified_poster (migration 007) requires display_name to
    // be non-empty, and nothing else in onboarding ever wrote it, which meant
    // every account that completed onboarding here still failed the posting
    // eligibility check with no explanation. Defaulting it to the username at
    // the same moment username is set closes that gap; it's a starting value,
    // not a permanent tie -- the user can still change it independently later.
    if (needsUsername) {
      update.username = username.trim()
      update.display_name = username.trim()
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', userId)

    setSubmitting(false)

    if (updateError) {
      if (updateError.code === '23505') {
        setError('That username is already taken.')
      } else if (updateError.code === '23514') {
        setError('That username isn\'t allowed. Try letters, numbers, underscores, hyphens, or periods.')
      } else {
        setError('Something went wrong. Please try again.')
      }
      return
    }

    router.replace(returnTo)
  }

  if (checking) {
    return (
      <div style={{ maxWidth: 480, margin: '120px auto', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', fontFamily: 'var(--font-sans)' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px' }}>
      <Card style={{ padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
          Welcome back to LazyGrip
        </h1>

        {needsUsername ? (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
            Before you comment, rate, or post, pick a name people will know you by.
          </p>
        ) : (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
            One quick thing before you continue.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {needsUsername && (
            <input
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Choose a username..."
              disabled={submitting}
              style={{
                width: '100%', padding: '9px 12px', fontSize: 'var(--text-sm)',
                border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)', marginBottom: 16,
              }}
            />
          )}

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
            By continuing, you agree to keep comments and sequences respectful and on-topic,
            and to not impersonate other members or post someone else's work as your own.
          </p>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(196,30,58,0.08)', border: '0.5px solid rgba(196,30,58,0.2)',
              borderRadius: 'var(--radius-md)', padding: '8px 12px',
              color: '#c41e3a', fontSize: 'var(--text-xs)', marginBottom: 16,
            }}>
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={submitting || (needsUsername && !username.trim())}
            style={{ padding: '10px', fontSize: 'var(--text-sm)' }}
          >
            {submitting ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 480, margin: '120px auto', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', fontFamily: 'var(--font-sans)' }}>Loading...</p>
      </div>
    }>
      <WelcomeForm />
    </Suspense>
  )
}
