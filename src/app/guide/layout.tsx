'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
]

function GuideSidebar() {
  const pathname = usePathname()
  return (
    <aside style={{
      width: 200,
      flexShrink: 0,
      position: 'sticky',
      top: 80,
      alignSelf: 'flex-start',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Guide
      </p>
      {NAV.map(item => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
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
      {/* Placed after the nav list, not the header above it -- this is the site-wide
          search icon's blind spot (it only reaches /browse, i.e. sequences, and people
          don't reliably notice it up there anyway). This one is scoped to the guide's
          own 55 sections and sits right where you're already looking once you're in
          the guide. */}
      <GuideSearch />
    </aside>
  )
}

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
        <GuideSidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
