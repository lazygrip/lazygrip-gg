import Link from 'next/link'
import { Shield } from 'lucide-react'

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--bg-primary)',
      borderTop: '0.5px solid var(--border)',
      padding: '16px 24px',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <Shield size={14} color="var(--accent)" />
          <span>LazyGrip.net — Not affiliated with Blizzard Entertainment or the GRIP-EMS addon.</span>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          {[
            { href: '/about', label: 'About' },
            { href: '/faq', label: 'FAQ' },
            { href: '/tos', label: 'Terms' },
            { href: '/privacy', label: 'Privacy' },
          ].map(link => (
            <Link key={link.href} href={link.href} style={{
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
