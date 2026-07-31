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
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            <Shield size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span>LazyGrip.net is a community site, independently owned and operated. Not affiliated with or endorsed by Blizzard Entertainment, and not an official GRIP-EMS site.</span>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { href: '/guide', label: 'Guide' },
              { href: '/changelog', label: 'Changelog' },
              { href: '/about', label: 'About' },
              { href: '/faq', label: 'FAQ' },
              { href: '/tos', label: 'Terms' },
              { href: '/privacy', label: 'Privacy' },
              { href: 'https://forum.lazygrip.net', label: 'Forum' },
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
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Sequences stay the property of the people who wrote them. By posting you confirm you wrote the sequence or have the author&apos;s permission. If your work is here without permission, email{' '}
          <a
            href="mailto:admin@lazygrip.net"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            admin@lazygrip.net
          </a>
          {' '}and it comes down.
        </div>
      </div>
    </footer>
  )
}
