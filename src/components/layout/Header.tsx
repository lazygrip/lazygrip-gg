'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, PlusCircle, LogOut, LayoutList, Bookmark, Settings, Sun, Moon, Menu, X, FileEdit, Lock, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { sanitizeAvatarUrl } from '@/lib/url-safety'
import SequenceMark from '@/components/ui/SequenceMark'

// Every Link here is prefetch={false}, for the same reason the homepage's are. The targets
// are all rendered per request with no loading boundary, and for such a route the default
// viewport prefetch is two requests per distinct href, neither of which renders the page:
// a route-tree fetch that returns only router state (walkTreeWithFlightRouterState in Next
// 16.3 skips the component tree for a prefetch of a route without `loading`), then a
// metadata-only prefetch that renders the target's <head>, so the target's generateMetadata
// runs, a database query on /sequences/[slug] and /user/[username]. The navigation still
// fetches the page in full on click. What the prefetch does cost is two function invocations
// per href per page view, billed to the target route. Measured on a local production build
// with the Next in the lockfile, 2026-10-15: each of those requests cost about 4 ms of route
// CPU (8 ms with the middleware counted, which Vercel bills on its own), a third of what
// rendering a layout-only page costs, and a /browse view fired 34 of them. Those are
// invocations #24 counts, with nothing to show for them.

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarColor, setAvatarColor] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [messageUnread, setMessageUnread] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  // The mobile menu is open FOR A PATHNAME, not open or closed on its own.
  //
  // Header renders from the layout, so an App Router navigation does not remount
  // it and the menu would otherwise stay open on top of the page just navigated
  // to. That was a `useEffect(() => setMobileMenuOpen(false), [pathname])` until
  // 2026-09-17. Deriving it closes the menu in the same render as the navigation
  // rather than in a second render afterwards, and there is no longer a window in
  // which the two can disagree.
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { theme, toggle } = useTheme()
  const pathname = usePathname()
  const mobileMenuOpen = menuOpenFor === pathname

  function closeMobileMenu() {
    setMenuOpenFor(null)
  }

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

  // Unread private messages, for the speech-bubble icon. An error (the function missing, a network
  // blip) leaves the count where it was: the icon is a convenience and must never break the header.
  const signedInUserId: string | null = user?.id ?? null

  useEffect(() => {
    if (!signedInUserId) return
    let cancelled = false
    const sb = createClient()
    async function refresh() {
      const { data, error } = await sb.rpc('unread_message_count')
      if (!cancelled && !error && typeof data === 'number') setMessageUnread(data)
    }
    refresh()
    const onRead = () => { refresh() }
    window.addEventListener('lg-messages-read', onRead)
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 60_000)
    return () => {
      cancelled = true
      window.removeEventListener('lg-messages-read', onRead)
      clearInterval(t)
    }
  }, [signedInUserId, pathname])

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
        setMessageUnread(0)
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

  const signOut = async () => {
    setDropdownOpen(false)
    closeMobileMenu()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const initial = username?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'
  const displayColor = avatarColor ?? '#1D9E75'
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl)

  const navLinks = [
    { href: '/browse', label: 'Browse' },
    { href: '/browse?sort=top_rated', label: 'Top Rated' },
    { href: '/browse/mythic-plus', label: 'Mythic+' },
    { href: '/browse/raid', label: 'Raid' },
    { href: '/guide', label: 'Guide' },
    { href: '/workshop', label: 'Workshop' },
    { href: '/creators', label: 'Creators' },
  ]

  return (
    <>
      <style>{`
        .desktop-nav { display: flex; }
        .mobile-menu-btn { display: none; }
        /* The seven nav pills plus the right-hand controls need about 1085px logged out and a
           little over 1140px logged in at the larger type size, so the hamburger takes over
           below 1200px instead of the old 768px. */
        @media (max-width: 1200px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .desktop-post-btn { display: none !important; }
        }
        /* Phone widths. People read this on phones with the system text size turned up, and
           px type scales with it, so a row that fits at the default size can push the
           hamburger (the only way to the nav) off the right edge once text is 30 to 50 percent
           bigger. It did exactly that on a real phone. So the row is built to survive that:
           the logo is the one thing allowed to shrink (its text ellipsizes), the search
           shortcut and Sign up step aside because Browse and Sign up are both in the menu, and
           Sign in stays visible as the one account button. */
        @media (max-width: 640px) {
          .hdr-search { display: none !important; }
          .hdr-signup { display: none !important; }
          .hdr-signin {
            border: 0.5px solid var(--border-strong);
            border-radius: var(--radius-md);
            padding: 6px 12px !important;
            color: var(--text-primary) !important;
            font-weight: 500;
            min-height: 40px;
            display: inline-flex;
            align-items: center;
          }
          .hdr-logo { font-size: 16px !important; gap: 6px !important; min-width: 0; flex-shrink: 1 !important; }
          .hdr-logo svg { flex-shrink: 0; }
          .hdr-logo-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .hdr-right { min-width: 0; }
        }
        /* Tap targets. The theme toggle and the hamburger were 32px squares, which is smaller
           than a fingertip and easy to miss on a phone. They are 44px here (the usual minimum),
           and Sign in is 40px tall above. The signed-in row follows the same rule: the
           notification bell is 44px and the avatar 40px. */
        @media (max-width: 640px) {
          .hdr-theme, .mobile-menu-btn, .hdr-bell { width: 44px !important; height: 44px !important; }
          .hdr-avatar { width: 40px !important; height: 40px !important; }
        }
        @media (max-width: 400px) {
          .hdr-bar { padding: 0 10px !important; }
          .hdr-inner { gap: 6px !important; }
          .hdr-logo svg { width: 24px !important; height: 24px !important; }
          .hdr-logo { font-size: 15px !important; }
        }
      `}</style>

      <header className="hdr-bar" style={{
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
        <div className="hdr-inner" style={{
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          {/* Logo — the same sequence mark used on the homepage hero, not the old generic
              shield icon. The two were never the same shape before, which is a big part of
              why the site read as "homepage got redesigned, rest didn't" even once it had. */}
          <Link prefetch={false} href="/" className="hdr-logo" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 'var(--text-base)',
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}>
            <SequenceMark size={30} />
            <span className="hdr-logo-text">LazyGrip<span style={{ color: 'var(--accent)' }}>.net</span></span>
          </Link>

          {/* Desktop Nav — active section gets a solid underline instead of relying on hover
              alone, so returning visitors always have a sense of where they are. */}
          {/* Pills, not plain text links — matches the chip language the rest of the site
              uses now (class chips, content-type chips, utility-bar triggers). Active page
              gets the same tinted accent-pill treatment as an active class chip; everything
              else is a ghost pill until hovered. */}
          <nav className="desktop-nav" style={{ gap: 4, flex: 1 }}>
            {navLinks.map(link => {
              const active = pathname === link.href.split('?')[0]
              return (
                <Link prefetch={false} key={link.href} href={link.href} style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  padding: '6px 14px',
                  borderRadius: 99,
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  border: active ? '0.5px solid rgba(29,158,117,0.25)' : '0.5px solid transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                  onMouseEnter={e => {
                    if (active) return
                    e.currentTarget.style.background = 'var(--bg-tertiary)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={e => {
                    if (active) return
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Spacer on mobile */}
          <div style={{ flex: 1 }} className="mobile-menu-btn" />

          {/* Right side */}
          <div className="hdr-right" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

            <Link prefetch={false} href="/browse" title="Search sequences" className="hdr-search" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)', textDecoration: 'none',
            }}>
              <Search size={16} />
            </Link>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="hdr-theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
              }}
            >
              <Sun size={16} className="theme-icon-dark" />
              <Moon size={16} className="theme-icon-light" />
            </button>

            {user ? (
              <>
                <Link prefetch={false} href="/post?new=1" className="desktop-post-btn" style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--accent)', color: 'white',
                  textDecoration: 'none', padding: '6px 12px',
                  borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}>
                  <PlusCircle size={14} />
                  Post Sequence
                </Link>

                {/* Messages */}
                <Link prefetch={false} href="/messages" title="Messages" className="hdr-bell" style={{
                  position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                  color: messageUnread > 0 ? 'var(--accent)' : 'var(--text-muted)',
                  textDecoration: 'none',
                }}>
                  <MessageCircle size={16} />
                  {messageUnread > 0 && (
                    <span style={{
                      position: 'absolute', top: 4, right: 4, width: 8, height: 8,
                      background: '#c0392b', borderRadius: '50%',
                      border: '1.5px solid var(--bg-primary)',
                    }} />
                  )}
                </Link>

                {/* Notification bell */}
                <Link prefetch={false} href="/notifications" title="Notifications" className="hdr-bell" style={{
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
                    className="hdr-avatar"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: '50%',
                      background: safeAvatarUrl ? 'transparent' : displayColor,
                      color: 'white', fontSize: 'var(--text-sm)', fontWeight: 600,
                      overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                      border: dropdownOpen ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    {safeAvatarUrl
                      ? <img src={safeAvatarUrl} alt={username ?? 'avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {username ?? user?.email}
                        </div>
                        {username && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user?.email}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '6px 0' }}>
                        <DropdownLink href="/profile?tab=posted" icon={<LayoutList size={14} />} label="My Sequences" onClick={() => setDropdownOpen(false)} />
                        <DropdownLink href="/profile?tab=drafts" icon={<FileEdit size={14} />} label="Drafts" onClick={() => setDropdownOpen(false)} />
                        <DropdownLink href="/profile?tab=private" icon={<Lock size={14} />} label="Private" onClick={() => setDropdownOpen(false)} />
                        <DropdownLink href="/profile?tab=saved" icon={<Bookmark size={14} />} label="Saved" onClick={() => setDropdownOpen(false)} />
                        <DropdownLink href="/messages" icon={<MessageCircle size={14} />} label={messageUnread > 0 ? `Messages (${messageUnread})` : 'Messages'} onClick={() => setDropdownOpen(false)} />
                        <DropdownLink href="/profile?tab=settings" icon={<Settings size={14} />} label="Settings" onClick={() => setDropdownOpen(false)} />
                      </div>
                      <div style={{ borderTop: '0.5px solid var(--border)', padding: '6px 0' }}>
                        <button
                          onClick={signOut}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 16px', background: 'none', border: 'none',
                            cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
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
                <Link prefetch={false} href="/auth/login" className="hdr-signin" style={{
                  fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
                  textDecoration: 'none', padding: '6px 12px',
                  whiteSpace: 'nowrap',
                }}>
                  Sign in
                </Link>
                <Link prefetch={false} href="/auth/signup" className="hdr-signup" style={{
                  fontSize: 'var(--text-sm)', fontWeight: 500,
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
              onClick={() => setMenuOpenFor(prev => (prev === pathname ? null : pathname))}
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
        }} onClick={closeMobileMenu}>
          <div style={{
            background: 'var(--bg-primary)',
            borderBottom: '0.5px solid var(--border)',
            padding: '8px 0 16px',
          }} onClick={e => e.stopPropagation()}>

            {/* Nav links */}
            {navLinks.map(link => (
              <Link
                prefetch={false}
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                style={{
                  display: 'block',
                  padding: '12px 20px',
                  fontSize: 'var(--text-base)',
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
                    prefetch={false}
                    href="/post?new=1"
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      background: 'var(--accent)', color: 'white',
                      textDecoration: 'none', padding: '12px',
                      borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 500,
                    }}
                  >
                    <PlusCircle size={16} />
                    Post Sequence
                  </Link>
                  <Link
                    prefetch={false}
                    href="/profile?tab=posted"
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <LayoutList size={15} /> My Sequences
                  </Link>
                  <Link
                    prefetch={false}
                    href="/profile?tab=drafts"
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <FileEdit size={15} /> Drafts
                  </Link>
                  <Link
                    prefetch={false}
                    href="/profile?tab=private"
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <Lock size={15} /> Private
                  </Link>
                  <Link
                    prefetch={false}
                    href="/profile?tab=saved"
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <Bookmark size={15} /> Saved
                  </Link>
                  <Link
                    prefetch={false}
                    href="/messages"
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <MessageCircle size={15} /> {messageUnread > 0 ? `Messages (${messageUnread})` : 'Messages'}
                  </Link>
                  <Link
                    prefetch={false}
                    href="/profile?tab=settings"
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}
                  >
                    <Settings size={15} /> Settings
                  </Link>
                  <button
                    onClick={signOut}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 4px', fontSize: 'var(--text-sm)',
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
                    prefetch={false}
                    href="/auth/signup"
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent)', color: 'white',
                      textDecoration: 'none', padding: '12px',
                      borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 500,
                    }}
                  >
                    Sign up
                  </Link>
                  <Link
                    prefetch={false}
                    href="/auth/login"
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      textDecoration: 'none', padding: '12px',
                      borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
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
      prefetch={false}
      href={href}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px', fontSize: 'var(--text-sm)',
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
