'use client'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Ban, Flag, MessageCircle, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sanitizeAvatarUrl } from '@/lib/url-safety'

const MAX_LENGTH = 2000
const POLL_MS = 10_000

type InboxRow = {
  conversation_id: string
  other_id: string
  other_username: string
  other_display_name: string | null
  other_avatar_url: string | null
  other_avatar_color: string | null
  last_message_at: string
  last_body: string | null
  last_sender_id: string | null
  unread: boolean
  blocked_by_me: boolean
}

type Person = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_color: string | null
}

type Message = { id: string; sender_id: string; body: string; created_at: string }

function Avatar({ person, size }: { person: Pick<Person, 'username' | 'avatar_url' | 'avatar_color'>; size: number }) {
  const url = sanitizeAvatarUrl(person.avatar_url)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: url ? 'transparent' : (person.avatar_color ?? '#1D9E75'),
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.42), fontWeight: 600,
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (person.username?.[0]?.toUpperCase() ?? '?')}
    </div>
  )
}

function MessagesInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const withUsername = params.get('with')

  const [meId, setMeId] = useState<string | null>(null)
  const [inbox, setInbox] = useState<InboxRow[]>([])
  const [inboxLoaded, setInboxLoaded] = useState(false)
  const [inboxError, setInboxError] = useState<string | null>(null)

  const [person, setPerson] = useState<Person | null>(null)
  const [personMissing, setPersonMissing] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportedIds, setReportedIds] = useState<string[]>([])
  const [reportError, setReportError] = useState<string | null>(null)

  const endRef = useRef<HTMLDivElement>(null)

  const activeRow = useMemo(
    () => (withUsername ? inbox.find(r => r.other_username.toLowerCase() === withUsername.toLowerCase()) ?? null : null),
    [inbox, withUsername],
  )
  const conversationId = activeRow?.conversation_id ?? null

  const loadInbox = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_inbox')
    if (error) {
      setInboxError('Messages could not be loaded right now. Try again in a moment.')
    } else {
      setInboxError(null)
      setInbox((data ?? []) as InboxRow[])
    }
    setInboxLoaded(true)
  }, [supabase])

  const loadMessages = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(200)
    setMessages(((data ?? []) as Message[]).slice().reverse())
  }, [supabase])

  // Who am I, and the first inbox load.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) { router.push('/auth/login'); return }
      setMeId(user.id)
      await loadInbox()
    }
    boot()
    return () => { cancelled = true }
  }, [supabase, router, loadInbox])

  // Resolve the person being talked to. The inbox already knows everyone with a
  // conversation; anyone else (a first message) is looked up by username.
  useEffect(() => {
    let cancelled = false
    async function resolve() {
      if (!withUsername) { setPerson(null); setPersonMissing(false); return }
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, avatar_color')
        .eq('username', withUsername)
        .maybeSingle()
      if (cancelled) return
      setPerson((data as Person | null) ?? null)
      setPersonMissing(!data)
      if (data) {
        const { data: b } = await supabase.from('user_blocks').select('blocked_id').eq('blocked_id', data.id).maybeSingle()
        if (!cancelled) setBlocked(!!b)
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [supabase, withUsername])

  // Load the thread, and keep it fresh while the tab is open.
  useEffect(() => {
    if (!conversationId) return
    let cancelled = false
    async function tick() {
      if (cancelled) return
      await loadMessages(conversationId as string)
    }
    tick()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') { tick(); loadInbox() }
    }, POLL_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [conversationId, loadMessages, loadInbox])

  // Reading the thread marks it read.
  const unreadHere = activeRow?.unread === true
  useEffect(() => {
    if (!conversationId || !unreadHere) return
    let cancelled = false
    supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId }).then(async () => {
      if (cancelled) return
      await loadInbox()
      window.dispatchEvent(new Event('lg-messages-read'))
    })
    return () => { cancelled = true }
  }, [supabase, conversationId, unreadHere, loadInbox, messages.length])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, person?.id])

  async function send() {
    if (!person || sending) return
    const body = draft.trim()
    if (!body) return
    setSending(true)
    setSendError(null)
    const { error } = await supabase.rpc('send_message', { p_recipient_id: person.id, p_body: body })
    setSending(false)
    if (error) {
      setSendError(error.message || 'That message could not be sent.')
      return
    }
    setDraft('')
    await loadInbox()
    if (conversationId) await loadMessages(conversationId)
  }

  // The first message in a new conversation has no id yet. Once the inbox shows
  // the row, the thread effect above takes over.

  async function toggleBlock() {
    if (!person) return
    const { error } = await supabase.rpc(blocked ? 'unblock_user' : 'block_user', { p_user_id: person.id })
    if (!error) {
      setBlocked(!blocked)
      loadInbox()
    }
  }

  async function submitReport(messageId: string) {
    setReportError(null)
    // Through the server route, not the database directly: the route is what emails the site
    // owner, and migration 052 stops signed-in members calling the report function themselves.
    let failure: string | null = null
    try {
      const res = await fetch('/api/messages/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, reason: reportReason.trim() || null }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) failure = json?.error || 'That report could not be sent.'
    } catch {
      failure = 'That report could not be sent. Check your connection and try again.'
    }
    if (failure) {
      setReportError(failure)
      return
    }
    setReportedIds(ids => [...ids, messageId])
    setReportingId(null)
    setReportReason('')
  }

  const threadOpen = !!withUsername
  const isSelf = !!person && person.id === meId

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px' }}>
      <style>{`
        .msg-shell { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; align-items: start; }
        .msg-row:hover { background: var(--bg-secondary); }
        @media (max-width: 720px) {
          .msg-shell { grid-template-columns: minmax(0, 1fr); }
          .msg-list-open .msg-thread { display: none; }
          .msg-thread-open .msg-list { display: none; }
        }
      `}</style>

      <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 16 }}>Messages</h1>

      <div className={`msg-shell ${threadOpen ? 'msg-thread-open' : 'msg-list-open'}`}>
        {/* Inbox */}
        <div className="msg-list" style={{
          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          {!inboxLoaded ? (
            <p style={{ padding: 20, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading...</p>
          ) : inboxError ? (
            <p style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{inboxError}</p>
          ) : inbox.length === 0 ? (
            <p style={{ padding: 20, color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
              No messages yet. Open a member&apos;s profile and press Message to start one.
            </p>
          ) : (
            inbox.map(row => {
              const active = withUsername?.toLowerCase() === row.other_username.toLowerCase()
              return (
                <Link
                  key={row.conversation_id}
                  prefetch={false}
                  href={`/messages?with=${encodeURIComponent(row.other_username)}`}
                  className="msg-row"
                  style={{
                    display: 'flex', gap: 10, padding: '12px 14px', textDecoration: 'none',
                    borderBottom: '0.5px solid var(--border)',
                    background: active ? 'var(--accent-subtle)' : undefined,
                  }}
                >
                  <Avatar person={{ username: row.other_username, avatar_url: row.other_avatar_url, avatar_color: row.other_avatar_color }} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: 'var(--text-sm)', fontWeight: row.unread ? 700 : 500, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {row.other_display_name || row.other_username}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {formatDistanceToNow(new Date(row.last_message_at), { addSuffix: false })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{
                        fontSize: 'var(--text-xs)', color: row.unread ? 'var(--text-primary)' : 'var(--text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>
                        {row.last_sender_id === meId ? 'You: ' : ''}{row.last_body}
                      </span>
                      {row.unread && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>

        {/* Thread */}
        <div className="msg-thread" style={{
          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden', minHeight: 420,
          display: 'flex', flexDirection: 'column',
        }}>
          {!withUsername ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: 40, color: 'var(--text-muted)', textAlign: 'center',
            }}>
              <MessageCircle size={28} />
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>Pick a conversation, or open a profile and press Message.</p>
            </div>
          ) : personMissing ? (
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>That member could not be found.</p>
              <Link prefetch={false} href="/messages" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-text)' }}>Back to messages</Link>
            </div>
          ) : !person ? (
            <p style={{ padding: 24, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading...</p>
          ) : (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderBottom: '0.5px solid var(--border)',
              }}>
                <Link prefetch={false} href="/messages" aria-label="Back to all messages" className="msg-back" style={{
                  display: 'inline-flex', color: 'var(--text-muted)',
                }}>
                  <ArrowLeft size={16} />
                </Link>
                <Avatar person={person} size={32} />
                <Link prefetch={false} href={`/user/${encodeURIComponent(person.username)}`} style={{
                  flex: 1, minWidth: 0, textDecoration: 'none', color: 'var(--text-primary)',
                  fontSize: 'var(--text-base)', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {person.display_name || person.username}
                  {person.display_name && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}> @{person.username}</span>
                  )}
                </Link>
                {!isSelf && (
                  <button onClick={toggleBlock} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                    background: 'transparent', border: '0.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
                    fontSize: 'var(--text-xs)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}>
                    <Ban size={12} />
                    {blocked ? 'Unblock' : 'Block'}
                  </button>
                )}
              </div>

              <div style={{
                flex: 1, overflowY: 'auto', maxHeight: 520, padding: '16px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {messages.length === 0 && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', margin: 'auto 0' }}>
                    {isSelf ? 'You can’t message yourself.' : `Say hello to ${person.display_name || person.username}.`}
                  </p>
                )}
                {messages.map(m => {
                  const mine = m.sender_id === meId
                  const reported = reportedIds.includes(m.id)
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                      <div style={{
                        padding: '8px 12px', borderRadius: 12,
                        background: mine ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontSize: 'var(--text-sm)', lineHeight: 1.5,
                        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                      }}>
                        {m.body}
                      </div>
                      <div style={{
                        display: 'flex', gap: 10, marginTop: 3, fontSize: 11, color: 'var(--text-muted)',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                      }}>
                        <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                        {!mine && !reported && reportingId !== m.id && (
                          <button onClick={() => { setReportingId(m.id); setReportError(null) }} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none',
                            padding: 0, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-sans)',
                          }}>
                            <Flag size={10} /> Report
                          </button>
                        )}
                        {reported && <span>Reported</span>}
                      </div>
                      {reportingId === m.id && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input
                            value={reportReason}
                            onChange={e => setReportReason(e.target.value)}
                            maxLength={500}
                            placeholder="What is wrong with this message? (optional)"
                            style={{
                              padding: '6px 10px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
                              background: 'var(--bg-primary)', color: 'var(--text-primary)',
                              border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => submitReport(m.id)} style={{
                              padding: '4px 10px', fontSize: 'var(--text-xs)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                            }}>Send report</button>
                            <button onClick={() => { setReportingId(null); setReportReason('') }} style={{
                              padding: '4px 10px', fontSize: 'var(--text-xs)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                              background: 'transparent', color: 'var(--text-secondary)',
                              border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                            }}>Cancel</button>
                          </div>
                          {reportError && <span style={{ fontSize: 11, color: '#c0392b' }}>{reportError}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              {!isSelf && (
                <div style={{ padding: 12, borderTop: '0.5px solid var(--border)' }}>
                  {sendError && (
                    <p role="alert" style={{ fontSize: 'var(--text-xs)', color: '#c0392b', margin: '0 0 8px' }}>{sendError}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value.slice(0, MAX_LENGTH))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                      }}
                      rows={2}
                      placeholder={blocked ? 'You have blocked this member.' : 'Write a message'}
                      disabled={blocked}
                      style={{
                        flex: 1, resize: 'vertical', minHeight: 44, maxHeight: 200, padding: '8px 10px',
                        fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', lineHeight: 1.5,
                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                        border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                      }}
                    />
                    <button
                      onClick={send}
                      disabled={sending || blocked || draft.trim().length === 0}
                      aria-label="Send message"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                        background: 'var(--accent)', color: '#fff', border: 'none',
                        borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 600,
                        fontFamily: 'var(--font-sans)',
                        cursor: sending || blocked || draft.trim().length === 0 ? 'default' : 'pointer',
                        opacity: sending || blocked || draft.trim().length === 0 ? 0.5 : 1,
                      }}
                    >
                      <Send size={14} /> Send
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Private between you and this member. Be kind; reported messages can be reviewed by the site team.</span>
                    <span>{draft.length}/{MAX_LENGTH}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 980, margin: '80px auto', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>}>
      <MessagesInner />
    </Suspense>
  )
}
