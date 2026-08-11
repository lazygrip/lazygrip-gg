'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { MessageSquare, Star, Bell, Reply } from 'lucide-react'

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data } = await supabase
        .from('notifications')
        .select('*, sequence:sequences(slug, title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotifications(data ?? [])
      setLoading(false)

      // Mark all as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
    }
    load()
  }, [])

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
    setNotifications(n => n.map(x => ({ ...x, is_read: true })))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (loading) return (
    <div style={{ maxWidth: 700, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Notifications
          {unreadCount > 0 && (
            <span style={{
              marginLeft: 10,
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              background: '#c0392b',
              color: 'white',
              borderRadius: 10,
              padding: '2px 8px',
              verticalAlign: 'middle',
            }}>
              {unreadCount} new
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{
            fontSize: 'var(--text-sm)', color: 'var(--accent)',
            background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}>
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '60px 24px',
          textAlign: 'center',
        }}>
          <Bell size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>No notifications yet.</p>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', marginTop: 4 }}>
            You'll be notified when someone comments on or rates your sequences.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {notifications.map(n => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationRow({ notification: n }: { notification: any }) {
  // Explicit three-way rather than isComment ? A : B: a binary here means
  // any future notification type falls through to the rating icon by
  // default, silently, the way 'reply' would have if this had stayed a
  // boolean check. Falling through to Bell for anything unrecognized is
  // the same reasoning: a visibly generic icon beats a wrong specific one.
  const icon = n.type === 'comment'
    ? <MessageSquare size={15} color="var(--accent)" />
    : n.type === 'reply'
    ? <Reply size={15} color="var(--accent)" />
    : n.type === 'rating'
    ? <Star size={15} color="#c69b3a" />
    : <Bell size={15} color="var(--text-muted)" />

  // rating gets its own gold-tinted background, everything else (comment,
  // reply, and any future type) shares the accent tint. Matches the icon
  // switch's grouping: rating is the odd one out visually, not the norm to
  // special-case away from.
  const iconBg = n.type === 'rating' ? 'rgba(198,155,58,0.12)' : 'rgba(29,158,117,0.12)'

  const inner = (
    <div style={{
      background: n.is_read ? 'var(--bg-primary)' : 'var(--accent-subtle)',
      border: '0.5px solid var(--border)',
      borderLeft: n.is_read ? '0.5px solid var(--border)' : '3px solid var(--accent)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: n.sequence?.slug ? 'pointer' : 'default',
      transition: 'background 0.15s',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', marginBottom: 2 }}>
          {n.message}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
      {!n.is_read && (
        <div style={{
          width: 8, height: 8,
          borderRadius: '50%',
          background: 'var(--accent)',
          flexShrink: 0,
        }} />
      )}
    </div>
  )

  if (n.sequence?.slug) {
    return (
      <Link href={`/sequences/${n.sequence.slug}`} style={{ textDecoration: 'none' }}>
        {inner}
      </Link>
    )
  }

  return inner
}
