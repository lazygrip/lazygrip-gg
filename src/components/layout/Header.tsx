'use client'
import Link from 'next/link'
import { Shield, Search, PlusCircle, User, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <header style={{
      background: 'var(--bg-primary)',
      borderBottom: '0.5px solid var(--border)',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1200,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}>
        {/* Logo */}
        <Link href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
          color: 'var(--text-primary)',
          fontWeight: 600,
          fontSize: 16,
          letterSpacing: '-0.02em',
        }}>
          <div style={{
            width: 28,
            height: 28,
            background: 'var(--accent)',
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Shield size={15} color="white" strokeWidth={2.5} />
          </div>
          LazyGrip<span style={{ color: 'var(--accent)' }}>.gg</span>
        </Link>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {[
            { href: '/browse', label: 'Browse' },
            { href: '/browse?sort=top_rated', label: 'Top Rated' },
            { href: '/browse?content_type=mythic_plus', label: 'Mythic+' },
            { href: '/browse?content_type=raid', label: 'Raid' },
          ].map(link => (
            <Link key={link.href} href={link.href} style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-tertiary)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/browse" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}>
            <Search size={16} />
          </Link>

          {user ? (
            <>
              <Link href="/post" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--accent)',
                color: 'white',
                textDecoration: 'none',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
              }}>
                <PlusCircle size={14} />
                Post Sequence
              </Link>
              <Link href="/profile" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--accent-subtle)',
                color: 'var(--accent-text)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
              }}>
                <User size={15} />
              </Link>
              <button onClick={signOut} style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
              }}>
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                padding: '6px 12px',
              }}>
                Sign in
              </Link>
              <Link href="/auth/signup" style={{
                fontSize: 13,
                fontWeight: 500,
                background: 'var(--accent)',
                color: 'white',
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
              }}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
