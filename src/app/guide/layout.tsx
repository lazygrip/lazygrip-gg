'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/guide', label: 'Overview' },
  { href: '/guide/installation', label: 'Installation' },
  { href: '/guide/settings', label: 'Settings' },
  { href: '/guide/how-it-works', label: 'How it works' },
  { href: '/guide/building-sequences', label: 'Building sequences' },
  { href: '/guide/from-gse', label: 'Coming from GSE' },
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
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Guide
      </p>
      {NAV.map(item => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              fontSize: 13,
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
      <div style={{ marginTop: 20, padding: '10px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Current version</p>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>GRIP-EMS v2.3.8</p>
      </div>
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
