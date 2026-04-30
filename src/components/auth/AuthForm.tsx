'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup'

export default function AuthPage({ mode = 'login' }: { mode?: Mode }) {
  const router = useRouter()
  const supabase = createClient()
  const [isLogin, setIsLogin] = useState(mode === 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/browse')
        router.refresh()
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
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleBattleNet() {
    await supabase.auth.signInWithOAuth({
      provider: 'battlenet' as any,
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
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
            {isLogin ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {isLogin ? 'Sign in to post sequences and rate others.' : 'Join LazyGrip.gg to share your GRIP sequences.'}
          </p>
        </div>

        {/* Battle.net */}
        <button onClick={handleBattleNet} style={{
          width: '100%', padding: '10px', marginBottom: 16,
          border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          background: '#148EFF',
          color: 'white',
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a7 7 0 110 14A7 7 0 0112 5z"/>
          </svg>
          Continue with Battle.net
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>or</span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
        </div>

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
            {!isLogin && (
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
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
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
              {loading ? '...' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess('') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--font-sans)',
            }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
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
