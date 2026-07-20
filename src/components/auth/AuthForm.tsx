'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, AlertCircle, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'reset'

export default function AuthPage({ mode = 'login', onSuccess }: { mode?: Mode, onSuccess?: (user: any) => void }) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [view, setView] = useState<Mode>(mode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showResend, setShowResend] = useState(false)
  const [resending, setResending] = useState(false)
  const isLogin = view === 'login'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setShowResend(false)
    setLoading(true)

    try {
      if (view === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })
        if (error) throw error
        setSuccess('If an account exists for that email, a reset link is on its way. Check your inbox.')
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (onSuccess) {
          const { data: { user } } = await supabase.auth.getUser()
          onSuccess(user)
        } else {
          router.push('/browse')
          router.refresh()
        }
      } else {
        if (username.length < 3) throw new Error('Username must be at least 3 characters.')
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username } }
        })
        if (error) throw error
        setSuccess('Account created! Check your email to confirm your address, then sign in.')
      }
    } catch (err: any) {
      const message = err.message || 'Something went wrong.'
      setError(message)
      if (message.toLowerCase().includes('email not confirmed')) {
        setShowResend(true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })
    setResending(false)
    if (error) {
      setError('Failed to resend confirmation email. Try again.')
    } else {
      setError('')
      setShowResend(false)
      setSuccess('Confirmation email sent. Check your inbox and click the link to verify your account.')
    }
  }

  async function handleDiscord() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    })

    if (error || !data.url) {
      setError('Failed to initiate Discord login.')
      return
    }

    window.location.href = data.url
  }

  async function handleBattlenet() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'custom:battlenet' as any,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    })

    if (error || !data.url) {
      setError('Failed to initiate Battle.net login.')
      return
    }

    window.location.href = data.url
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '32px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40,
            background: 'var(--accent)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <Shield size={22} color="white" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {view === 'reset' ? 'Reset password' : isLogin ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {view === 'reset'
              ? "Enter your email and we'll send you a reset link."
              : isLogin ? 'Sign in to post sequences and rate others.' : 'Join LazyGrip.net to share your GRIP sequences.'}
          </p>
        </div>

        {view !== 'reset' && (
          <>
            {/* Discord */}
            <button onClick={handleDiscord} style={{
              width: '100%', padding: '10px', marginBottom: 12,
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: '#5865F2',
              color: 'white',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.05a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.026 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Continue with Discord
            </button>

            {/* Battle.net */}
            <button onClick={handleBattlenet} style={{
              width: '100%', padding: '10px', marginBottom: 8,
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: '#148EFF',
              color: 'white',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.311 6.997 3.887L12 12.086 5.003 8.198 12 4.311zM5 9.887l6 3.334v6.469l-6-3.334V9.887zm8 9.803v-6.469l6-3.334v6.469l-6 3.334z"/>
              </svg>
              Continue with Battle.net
            </button>

            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
              Already have an account with Discord or email? Sign in with that first, then connect Battle.net from your profile settings to keep one account.
            </p>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
            }}>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>or</span>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
            </div>
          </>
        )}

        {success ? (
          <div style={{
            background: 'var(--accent-subtle)',
            border: '0.5px solid rgba(29,158,117,0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            fontSize: 13, color: 'var(--accent-text)',
            lineHeight: 1.5,
          }}>
            {success}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {view === 'signup' && (
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                required
                minLength={3}
                style={inputStyle}
              />
            )}
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              required
              style={inputStyle}
            />
            {view !== 'reset' && (
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                required
                minLength={8}
                style={inputStyle}
              />
            )}

            {isLogin && (
              <button
                type="button"
                onClick={() => { setView('reset'); setError(''); setSuccess(''); setShowResend(false) }}
                style={{
                  alignSelf: 'flex-end',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-sans)',
                  marginTop: -6,
                }}
              >
                Forgot password?
              </button>
            )}

            {error && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: '#c41e3a', fontSize: 12,
                }}>
                  <AlertCircle size={13} />
                  {error}
                </div>
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: '0.5px solid var(--border-strong)',
                      borderRadius: 'var(--radius-md)', padding: '7px 12px',
                      cursor: resending ? 'not-allowed' : 'pointer',
                      fontSize: 12, color: 'var(--accent)',
                      fontFamily: 'var(--font-sans)',
                      opacity: resending ? 0.7 : 1,
                    }}
                  >
                    <Mail size={12} />
                    {resending ? 'Sending...' : 'Resend confirmation email'}
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '10px',
              background: 'var(--accent)', color: 'white',
              border: 'none', borderRadius: 'var(--radius-md)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontSize: 14, fontWeight: 500,
              fontFamily: 'var(--font-sans)',
            }}>
              {loading ? '...' : view === 'reset' ? 'Send reset link' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
          {view === 'reset' ? (
            <button
              onClick={() => { setView('login'); setError(''); setSuccess(''); setShowResend(false) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--font-sans)',
              }}
            >
              Back to sign in
            </button>
          ) : (
            <>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { setView(isLogin ? 'signup' : 'login'); setError(''); setSuccess(''); setShowResend(false) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--font-sans)',
                }}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '0.5px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
}
