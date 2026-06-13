import Link from 'next/link'
import { Megaphone } from 'lucide-react'

// Update these two lines when you have a new announcement.
// Set ANNOUNCEMENT to null to hide the bar entirely.
const ANNOUNCEMENT = {
  text: 'New guide added: Settings — SQW, Key Down Casting, click rate, and how they all connect.',
  href: '/guide/settings',
}

export default function AnnouncementBar() {
  if (!ANNOUNCEMENT) return null

  return (
    <div style={{
      background: 'var(--accent-subtle)',
      borderBottom: '0.5px solid rgba(29,158,117,0.2)',
      padding: '8px 16px',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        <Megaphone size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <Link href={ANNOUNCEMENT.href} style={{
          fontSize: 13,
          color: 'var(--accent)',
          textDecoration: 'none',
          fontWeight: 500,
          lineHeight: 1.4,
        }}
          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
        >
          {ANNOUNCEMENT.text}
        </Link>
      </div>
    </div>
  )
}
