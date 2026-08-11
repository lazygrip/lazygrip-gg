'use client'
import Link from 'next/link'
import { Megaphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'

// Update these two lines when you have a new announcement.
// Set ANNOUNCEMENT to null to hide the bar entirely.
const ANNOUNCEMENT: { text: string; href: string } | null = {
  text: 'Commenting, rating, and posting now require a username on your profile. Set yours in a few seconds.',
  href: '/welcome',
}

// Keyed to the announcement text itself, not a fixed id — so a new announcement in the
// future automatically reappears for everyone even if they'd dismissed an older one.
const DISMISS_KEY = ANNOUNCEMENT ? `announcement-dismissed:${ANNOUNCEMENT.text}` : ''

export default function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!ANNOUNCEMENT) return
    if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true)
  }, [])

  if (!ANNOUNCEMENT || dismissed) return null

  return (
    <div style={{
      background: 'var(--accent-subtle)',
      borderBottom: '0.5px solid var(--border)',
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
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--accent-text)',
          textDecoration: 'none',
          lineHeight: 1.4,
        }}>
          {ANNOUNCEMENT.text}
        </Link>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1')
            setDismissed(true)
          }}
          title="Dismiss"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, flexShrink: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--accent-text)', opacity: 0.7, marginLeft: 2,
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
