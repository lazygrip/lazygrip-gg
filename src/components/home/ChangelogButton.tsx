'use client'
import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ScrollText } from 'lucide-react'

const KEY = 'lg-ems-changelog-seen'
const EVENT = 'lg-ems-changelog-seen-change'

const STORAGE_BLOCKED = 'blocked'

function read(): string | null {
  try { return window.localStorage.getItem(KEY) } catch { return STORAGE_BLOCKED }
}
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

// The Changelog button beside the current-version pill. It pulses and says New until this
// visitor has opened the changelog for the latest release, then goes quiet. The "seen" mark lives
// only in this browser, so nothing about the visitor is sent anywhere, and without storage the
// button simply stays calm. Visitors who ask their system to reduce motion get a steady badge
// instead of a pulse.
export default function ChangelogButton({ latest }: { latest: string }) {
  // On the server, and until the browser has been read, the button stays calm so the page never flashes.
  const seen = useSyncExternalStore(subscribe, read, () => latest)
  const fresh = seen !== latest && seen !== STORAGE_BLOCKED

  const markSeen = () => {
    try { window.localStorage.setItem(KEY, latest) } catch { /* storage unavailable, stay calm */ }
    window.dispatchEvent(new Event(EVENT))
  }

  return (
    <>
      <style>{`
        .home-cl { display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 99px; text-decoration: none;
          font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary); background: var(--bg-tertiary); border: 0.5px solid var(--border-strong); }
        .home-cl:hover { border-color: var(--accent); color: var(--text-primary); }
        .home-cl:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .home-cl.fresh { color: var(--text-primary); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--bg-tertiary)); animation: home-cl-pulse 1.8s ease-in-out infinite; }
        .home-cl .badge { padding: 0 7px; border-radius: 99px; font-size: 10px; line-height: 16px; background: var(--accent); color: white; }
        @keyframes home-cl-pulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); }
          50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent) 0%, transparent); }
        }
        @media (prefers-reduced-motion: reduce) { .home-cl.fresh { animation: none; } }
      `}</style>
      <Link prefetch={false} href="/guide/ems-changelog" onClick={markSeen} className={fresh ? 'home-cl fresh' : 'home-cl'}
        aria-label={fresh ? `Changelog, new release v${latest}` : 'Changelog'}>
        <ScrollText size={13} strokeWidth={2.2} aria-hidden />
        Changelog
        {fresh && <span className="badge">New</span>}
      </Link>
    </>
  )
}
