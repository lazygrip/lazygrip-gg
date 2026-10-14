'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import GuideSearch from '@/components/guide/GuideSearch'

const NAV = [
  { href: '/guide', label: 'Overview' },
  { href: '/guide/installation', label: 'Installation' },
  { href: '/guide/settings', label: 'Settings' },
  { href: '/guide/how-it-works', label: 'How it works' },
  { href: '/guide/features-and-behavior', label: 'Features and behavior' },
  { href: '/guide/building-sequences', label: 'Building sequences' },
  { href: '/guide/from-legacy-program', label: 'Coming from the legacy program' },
  { href: '/guide/validating', label: 'Validating your work' },
  { href: '/guide/blizzard-and-addons', label: 'Blizzard and addons' },
  { href: '/guide/wow-forever', label: 'WoW: Forever' },
]

// Below 860px the sidebar stops being a 200px column beside the content (which left roughly
// 100px of reading width on a phone and made every guide page two or three times as tall as it
// needed to be) and becomes a menu bar on top of the page. The nav list collapses behind a
// button that shows where you are, the search box stays visible, and the content gets the
// full width. Above 860px nothing about the desktop layout changes.
const GUIDE_CSS = `
  .guide-shell { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
  .guide-cols { display: flex; gap: 48px; align-items: flex-start; }
  .guide-side { width: 200px; flex-shrink: 0; position: sticky; top: 80px; align-self: flex-start; display: flex; flex-direction: column; gap: 2px; }
  .guide-toggle { display: none; }
  .guide-list { display: flex; flex-direction: column; gap: 2px; }
  .guide-heading { margin-bottom: 8px; }
  .guide-main { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  @media (max-width: 860px) {
    .guide-shell { padding: 20px 16px 40px; }
    .guide-cols { flex-direction: column; gap: 24px; align-items: stretch; }
    .guide-side { width: 100%; position: static; align-self: stretch; gap: 10px; }
    .guide-heading { display: none; }
    .guide-toggle {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      width: 100%; min-height: 48px; padding: 0 14px; cursor: pointer;
      background: var(--bg-primary); color: var(--text-primary);
      border: 0.5px solid var(--border-strong); border-radius: var(--radius-md);
      font: inherit; font-size: var(--text-sm); font-weight: 600; text-align: left;
    }
    .guide-toggle span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .guide-list { display: none; }
    .guide-list.guide-list-open { display: flex; }
    .guide-list a { padding: 12px 14px !important; }
  }
`

function GuideSidebar() {
  const pathname = usePathname()
  // Open FOR A PATHNAME, same pattern the site header uses: navigating to another guide page
  // changes the pathname, so the menu closes by itself without an effect to reset it.
  const [openFor, setOpenFor] = useState<string | null>(null)
  const open = openFor === pathname
  const current = NAV.find(item => item.href === pathname)?.label ?? 'Guide'
  return (
    <aside className="guide-side">
      <button
        type="button"
        className="guide-toggle"
        aria-expanded={open}
        aria-controls="guide-nav-list"
        onClick={() => setOpenFor(open ? null : pathname)}
      >
        <span>Guide: {current}</span>
        <span aria-hidden="true">{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
      </button>
      <p className="guide-heading" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Guide
      </p>
      <nav id="guide-nav-list" aria-label="Guide pages" className={open ? 'guide-list guide-list-open' : 'guide-list'}>
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{
                fontSize: 'var(--text-sm)',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                background: active ? 'var(--accent-subtle)' : 'transparent',
                display: 'block',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      {/* Placed after the nav list, not the header above it -- this is the site-wide
          search icon's blind spot (it only reaches /browse, i.e. sequences, and people
          don't reliably notice it up there anyway). This one is scoped to the guide's
          own sections and sits right where you're already looking once you're in
          the guide. */}
      <GuideSearch />
    </aside>
  )
}

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="guide-shell">
      <style>{GUIDE_CSS}</style>
      <div className="guide-cols">
        <GuideSidebar />
        <main className="guide-main">
          {children}
        </main>
      </div>
    </div>
  )
}
