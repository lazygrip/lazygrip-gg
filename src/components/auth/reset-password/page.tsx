'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)

  useEffect(() => {
    // Supabase's password recovery link lands here with a session already
    // established via the URL fragment. Confirm a session actually exists
    // before letting the person try to set a password — if the link was
    // expired or already used, there won't be one.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true)
      } else {
        setSessionError(true)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message || 'Something went wrong. Try requesting a new reset link.')
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push('/browse')
      router.refresh()
    }, 2000)
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
            Set a new password
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Choose a new password for your account.
          </p>
        </div>

        {sessionError ? (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#c41e3a', fontSize: 13, textAlign: 'center',
            }}>
              <AlertCircle size={14} />
              This reset link is invalid or has expired.
            </div>
            <a
              href="/auth/login"
              style={{ fontSize: 13, color: 'var(--accent)' }}
            >
              Request a new one
            </a>
          </div>
        ) : success ? (
          <div style={{
            background: 'var(--accent-subtle)',
            border: '0.5px solid rgba(29,158,117,0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            fontSize: 13, color: 'var(--accent-text)',
            lineHeight: 1.5,
          }}>
            Password updated. Taking you to the browse page...
          </div>
        ) : sessionReady ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              type="password"
              required
              minLength={8}
              style={inputStyle}
            />
            <input
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              type="password"
              required
              minLength={8}
              style={inputStyle}
            />

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: '#c41e3a', fontSize: 12,
              }}>
                <AlertCircle size={13} />
                {error}
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
              {loading ? '...' : 'Update password'}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            Checking your reset link...
          </p>
        )}
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
