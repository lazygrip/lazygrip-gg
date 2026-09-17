'use client'
import Link from 'next/link'
import { Megaphone, X } from 'lucide-react'
import { useSyncExternalStore } from 'react'

// Update these two lines when you have a new announcement.
// Set ANNOUNCEMENT to null to hide the bar entirely.
const ANNOUNCEMENT: { text: string; href: string } | null = {
  text: 'Commenting, rating, and posting now require a username on your profile. Set yours in a few seconds.',
  href: '/welcome',
}

// Keyed to the announcement text itself, not a fixed id — so a new announcement in the
// future automatically reappears for everyone even if they'd dismissed an older one.
const DISMISS_KEY = ANNOUNCEMENT ? `announcement-dismissed:${ANNOUNCEMENT.text}` : ''

// localStorage IS THE STORE, READ AS ONE.
//
// This used to be `useState(false)` plus a mount effect that read localStorage and
// called setDismissed, which is a copy of a value that already lives somewhere
// else. Reading it through useSyncExternalStore keeps one copy, and the `storage`
// event subscription means dismissing the bar in one tab clears it in every other
// open tab, which the state-plus-effect version could not do at all.
//
// The server snapshot is always false: localStorage does not exist there, and the
// bar has to be in the server HTML for the visitor who has not dismissed it.
const dismissListeners = new Set<() => void>()

// Set only when localStorage refused the write, so the in-memory fallback can
// never mask a real stored value. Part of the snapshot rather than read beside
// it, or flipping it would not re-render anything.
let dismissedThisView = false

function readDismissed(): boolean {
  if (dismissedThisView) return true
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    // Safari in private mode, and any profile with site data blocked, throw here
    // rather than returning null. Showing the bar is the right answer then.
    return false
  }
}

function subscribeDismissed(onChange: () => void) {
  dismissListeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    dismissListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // Nothing to persist to. The bar still closes for this page view, because the
    // listeners below re-read and this tab's own render is driven by that read --
    // so a blocked-storage visitor gets a dismiss that does not survive navigation
    // rather than a dismiss button that does nothing.
    dismissedThisView = true
  }
  for (const listener of dismissListeners) listener()
}

export default function AnnouncementBar() {
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => false)

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
          onClick={dismiss}
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
