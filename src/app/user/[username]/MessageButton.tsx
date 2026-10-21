'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * The profile header's message control.
 *
 * On someone else's profile it opens a conversation with them. On your own it is
 * the way into your inbox and carries the unread count. It replaces the "Chat"
 * pill that used to sit at the right end of the tab row, which was a stub.
 *
 * Signed-out visitors still get the link: /messages sends them to sign in, so
 * the button is never missing from a profile just because nobody is logged in.
 */
export default function MessageButton({
  username,
  isOwnProfile,
}: {
  username: string
  isOwnProfile: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!isOwnProfile) return
    let cancelled = false
    supabase.rpc('unread_message_count').then(({ data, error }) => {
      if (!cancelled && !error && typeof data === 'number') setUnread(data)
    })
    return () => { cancelled = true }
  }, [isOwnProfile, supabase])

  const href = isOwnProfile ? '/messages' : `/messages?with=${encodeURIComponent(username)}`

  return (
    <Link
      prefetch={false}
      href={href}
      className="pf-msg-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '8px 16px',
        background: isOwnProfile ? 'var(--bg-primary)' : 'var(--accent)',
        color: isOwnProfile ? 'var(--text-primary)' : '#fff',
        border: isOwnProfile ? '0.5px solid var(--border-strong)' : '0.5px solid var(--accent)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <MessageCircle size={15} />
      {isOwnProfile ? 'Messages' : 'Message'}
      {isOwnProfile && unread > 0 && (
        <span style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          background: '#c0392b', color: '#fff',
          fontSize: 11, fontWeight: 700, lineHeight: '18px', textAlign: 'center',
        }}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
