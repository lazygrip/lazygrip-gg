'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Search, PlusCircle, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        loadProfile(data.user.id)
        loadUnread(data.user.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
        loadUnread(session.user.id)
      } else {
        setUsername(null)
        setAvatarUrl(null)
        setUnreadCount(0)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', userId)
      .single()
    if (data) {
      setUsername(data.username)
      setAvatarUrl(data.avatar_url ?? null)
    }
  }

  async function loadUnread(userId: string) {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setUnreadCount(count ?? 0)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const initial = username?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'

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
          <Image
            src="/icon.png"
            alt="LazyGrip logo"
            width={64}
            height={64}
            style={{ borderRadius: 7 }}
          />
          LazyGrip<span style={{ color: 'var(--accent)' }}>.net</span>
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
          <Link href="/browse" title="Search sequences" style={{
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

              {/* Notification bell */}
              <Link href="/notifications" title="Notifications" style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                color: unreadCount > 0 ? 'var(--accent)' : 'var(--text-muted)',
                textDecoration: 'none',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    background: '#c0392b',
                    borderRadius: '50%',
                    border: '1.5px solid var(--bg-primary)',
                  }} />
                )}
              </Link>

              {/* Avatar */}
              <Link href="/profile" title="Your profile" style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: avatarUrl ? 'transparent' : 'var(--accent-subtle)',
                color: 'var(--accent-text)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username ?? 'avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initial
                )}
              </Link>

              <button onClick={signOut} title="Sign out" style={{
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
