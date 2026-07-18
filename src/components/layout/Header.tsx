'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Search, PlusCircle, LogOut, LayoutList, Bookmark, Settings, Sun, Moon, Menu, X, FileEdit } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import { useTheme } from '@/components/ThemeProvider'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarColor, setAvatarColor] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { theme, toggle } = useTheme()

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
        setAvatarColor(null)
        setUnreadCount(0)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url, avatar_color')
      .eq('id', userId)
      .single()
    if (data) {
      setUsername(data.username)
      setAvatarUrl(data.avatar_url ?? null)
      setAvatarColor(data.avatar_color ?? null)
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
    setDropdownOpen(false)
    setMobileMenuOpen(false)
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const initial = username?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'
  const displayColor = avatarColor ?? '#1D9E75'

  const navLinks = [
    { href: '/browse', label: 'Browse' },
    { href: '/browse?sort=top_rated', label: 'Top Rated' },
    { href: '/browse?content_type=mythic_plus', label: 'Mythic+' },
    { href: '/browse?content_type=raid', label: 'Raid' },
    { href: '/guide', label: 'Guide' },
    { href: '/workshop', label: 'Workshop' },
  ]

  return (
    <>
      <style>{`
        .desktop-nav { display: flex; }
        .mobile-menu-btn { display: none; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .desktop-post-btn { display: none !important; }
        }
      `}</style>

      <header style={{
        background: 'var(--bg-primary)',
        borderBottom: '0.5px solid var(--border)',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
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
          gap: 16,
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
            flexShrink: 0,
          }}>
            <Image src="/icon.png" alt="LazyGrip logo" width={64} height={64} style={{ borderRadius: 7 }} />
            LazyGrip<span style={{ color: 'var(--accent)' }}>.net</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="desktop-nav" style={{ gap: 4, flex: 1 }}>
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
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

          {/* Spacer on mobile */}
          <div style={{ flex: 1 }} className="mobile-menu-btn" />

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

            <Link href="/browse" title="Search sequences" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)', textDecoration: 'none',
            }}>
              <Search size={16} />
            </Link>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
              }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {user ? (
              <>
                <Link href="/post?new=1" className="desktop-post-btn" style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--accent)', color: 'white',
                  textDecoration: 'none', padding: '6px 12px',
                  borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}>
                  <PlusCircle size={14} />
                  Post Sequence
                </Link>

                {/* Notification bell */}
                <Link href="/notifications" title="Notifications" style={{
                  position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                  color: unreadCount > 0 ? 'var(--accent)' : 'var(--text-muted)',
                  textDecoration: 'none',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: 4, right: 4, width: 8, height: 8,
                      background: '#c0392b', borderRadius: '50%',
                      border: '1.5px solid var(--bg-primary)',
                    }} />
                  )}
                </Link>

                {/* Avatar + dropdown */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <div
                    onClick={() => setDropdownOpen(prev => !prev)}
                    title="Your profile"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: '50%',
                      background: avatarUrl ? 'transparent' : displayColor,
                      color: 'white', fontSize: 13, fontWeight: 600,
                      overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                      border: dropdownOpen ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    {avatarUrl
                      ? <img src={avatarUrl} alt={username ?? 'avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initial
                    }
                  </div>

                  {dropdownOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                      width: 220,
                      background: 'var(--bg-primary)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      overflow: 'hidden', zIndex: 200,
                    }}>
                      <div style={{ padding: '14px 16px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {username ?? user?.email}
                        </div>
                        {username && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user?.email}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '6px 0' }}>
                        <DropdownLink href="/profile?tab=posted" icon={<LayoutList size={14} />} label="My Sequences" onClick={() => setDropdownOpen(false)} />
                        <DropdownLink href="/profile?tab=drafts" icon={<FileEdit size={14} />} label="Drafts" onClick={() => setDropdownOpen(false)} />
                        <DropdownLink href="/profile?tab=saved" icon={<Bookmark size={14} />} label="Saved" onClick={() => setDropdownOpen(false)} />
                        <DropdownLink href="/profile?tab=settings" icon={<Settings size={14} />} label="Settings" onClick={() => setDropdownOpen(false)} />
                      </div>
                      <div style={{ borderTop: '0.5px solid var(--border)', padding: '6px 0' }}>
                        <button
                          onClick={signOut}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 16px', background: 'none', border: 'none',
                            cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-sans)', textAlign: 'left',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-tertiary)'
                            e.currentTarget.style.color = '#c0392b'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'none'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                          }}
                        >
                          <LogOut size={14} />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login" style={{
                  fontSize: 13, color: 'var(--text-secondary)',
                  textDecoration: 'none', padding: '6px 12px',
                  whiteSpace: 'nowrap',
                }}>
                  Sign in
                </Link>
                <Link href="/auth/signup" style={{
                  fontSize: 13, fontWeight: 500,
                  background: 'var(--accent)', color: 'white',
                  textDecoration: 'none', padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  whiteSpace: 'nowrap',
                }}>
                  Sign up
                </Link>
              </>
            )}

            {/* Hamburger -- mobile only */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'none',
                alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)', flexShrink: 0,
              }}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: 56,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99,
          background: 'rgba(0,0,0,0.4)',
        }} onClick={() => setMobileMenuOpen(false)}>
          <div style={{
            background: 'var(--bg-primary)',
            borderBottom: '0.5px solid var(--border)',
            padding: '8px 0 16px',
          }} onClick={e => e.stopPropagation()}>

            {/* Nav links */}
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '12px 20px',
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  borderBottom: '0.5px solid var(--border)',
                }}
              >
                {link.label}
              </Link>
            ))}

            {/* Auth actions */}
            <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {user ? (
                <>
                  <Link
                    href="/post?new=1"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      background: 'var(--accent)', color: 'white',
                      textDecoration: 'none', padding: '12px',
                      borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500,
                    }}
                  >
                    <PlusCircle size={16} />
                    Post Sequence
                  </Link>
                  <Link
                    href="/profile?tab=posted"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 14,
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <LayoutList size={15} /> My Sequences
                  </Link>
                  <Link
                    href="/profile?tab=drafts"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 14,
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <FileEdit size={15} /> Drafts
                  </Link>
                  <Link
                    href="/profile?tab=saved"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 14,
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <Bookmark size={15} /> Saved
                  </Link>
                  <Link
                    href="/profile?tab=settings"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 14,
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <Settings size={15} /> Settings
                  </Link>
                  <button
                    onClick={signOut}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 14,
                      color: '#c0392b', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left',
                    }}
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent)', color: 'white',
                      textDecoration: 'none', padding: '12px',
                      borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500,
                    }}
                  >
                    Sign up
                  </Link>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      textDecoration: 'none', padding: '12px',
                      borderRadius: 'var(--radius-md)', fontSize: 14,
                      border: '0.5px solid var(--border-strong)',
                    }}
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DropdownLink({ href, icon, label, onClick }: {
  href: string
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px', fontSize: 13,
        color: 'var(--text-secondary)', textDecoration: 'none',
        transition: 'background 0.1s, color 0.1s',
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
      {icon}
      {label}
    </Link>
  )
}
