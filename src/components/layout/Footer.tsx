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
          Community content on LazyGrip.net is licensed under{' '}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            CC BY-NC-SA 4.0
          </a>
          . Free to share and adapt with attribution, for non-commercial use only.
        </div>
      </div>
    </footer>
  )
}
