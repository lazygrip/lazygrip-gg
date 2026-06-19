import Link from 'next/link'
import { Megaphone } from 'lucide-react'

// Update these two lines when you have a new announcement.
// Set ANNOUNCEMENT to null to hide the bar entirely.
const ANNOUNCEMENT = {
  text: 'NEW: The GRIP-EMS Community Forum is live. Join the conversation at forum.lazygrip.net.',
  href: 'https://forum.lazygrip.net',
}

export default function AnnouncementBar() {
  if (!ANNOUNCEMENT) return null

  return (
    <div style={{
      background: 'var(--accent)',
      padding: '10px 16px',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}>
        <Megaphone size={15} style={{ color: 'white', flexShrink: 0 }} />
        <Link href={ANNOUNCEMENT.href} style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'white',
          textDecoration: 'underline',
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
        }}>
          {ANNOUNCEMENT.text}
        </Link>
      </div>
    </div>
  )
}
