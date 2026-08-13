'use client'
import { useEffect, useState } from 'react'
import { Link2, X, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Shown to the AUTHOR of a published sequence when their account has no Discord
// identity connected. It exists because the two halves of that fact never met:
// every published sequence gets a Discord thread, the bot tags the author in it
// when it can, and an author who signed up with email or Battle.net has no way
// to find out that connecting Discord is what turns the tag on. The linking UI
// has existed on /profile the whole time; nothing pointed anyone at it.
//
// Measured 2026-08-13, which is the whole reason this component exists: of 12
// distinct sequence authors, 5 had no Discord connected, and 31 forum threads
// carried the room-facing "Authors: link your Discord" wording purely because
// their author had never linked. Those 5 are the entire audience here.
//
// WHY THE IDENTITY CHECK IS CLIENT-SIDE AND WHY THAT IS NOT A LEAK:
// getUserIdentities() returns the CALLER'S OWN identities from their own
// session, so this asks "do I have Discord connected", never "does someone
// else". The server route that answers the latter, /api/relay-identity, is
// deliberately walled off from browsers and is NOT used here. Do not be tempted
// to call it from client code to answer this question -- its own header says
// it must never return a Discord id to a browser, and this component does not
// need a Discord id at all, only a yes or no about the current user.
const DISMISS_KEY = 'discord-link-prompt-dismissed'

// Deliberately the same redirect string the /profile linking flow already uses,
// rather than the current sequence URL. Supabase only honours a redirect that
// is on the project's allowlist, that exact value is proven in production, and
// an arbitrary /sequences/<slug> URL is not something this repo can verify from
// the outside. The cost is that connecting lands the author on their profile
// instead of back here; the benefit is that it cannot fail on an unlisted
// redirect. Landing on the connected-accounts panel also shows Discord flipped
// to Connected, which is its own confirmation.
const LINK_REDIRECT_PATH = '/profile?tab=settings'

export default function DiscordLinkPrompt() {
  const [show, setShow] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      // Read the dismissal first so a dismissed prompt costs no network call.
      if (localStorage.getItem(DISMISS_KEY) === '1') return

      const supabase = createClient()
      const { data, error: identityError } = await supabase.auth.getUserIdentities()

      // A failure here stays SILENT and renders nothing. This is a nudge, not a
      // control: showing "connect Discord" to someone who already has it
      // connected because a lookup failed is worse than showing nothing.
      if (cancelled || identityError || !data) return

      const hasDiscord = (data.identities ?? []).some((i) => i.provider === 'discord')
      if (!hasDiscord) setShow(true)
    }

    check()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleConnect() {
    setError(null)
    setLinking(true)

    const supabase = createClient()
    const { data, error: linkError } = await supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}${LINK_REDIRECT_PATH}`,
      },
    })

    if (linkError) {
      setError(`Could not start the Discord connection: ${linkError.message}`)
      setLinking(false)
      return
    }

    if (data?.url) {
      window.location.href = data.url
      return
    }

    // No error and no URL is not a state the SDK documents. Say so rather than
    // leaving a button spinning forever with nothing happening.
    setError('Discord did not return a sign-in link. Try again from your profile.')
    setLinking(false)
  }

  if (!show) return null

  return (
    <div
      style={{
        background: 'var(--accent-subtle)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: '#5865F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Link2 size={14} color="white" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          This sequence has a Discord thread. It does not tag you.
        </div>
        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Every published sequence gets a thread in the GRIP Discord. This one went up without
          tagging you, because your profile has no Discord account connected. Connect one and you
          will be tagged on this thread and your others, usually within the hour.
        </p>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#c41e3a',
              fontSize: 'var(--text-xs)',
              marginTop: 8,
            }}
          >
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={linking}
          style={{
            marginTop: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            cursor: linking ? 'not-allowed' : 'pointer',
            opacity: linking ? 0.6 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Link2 size={13} />
          {linking ? 'Opening Discord...' : 'Connect Discord'}
        </button>
      </div>

      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1')
          setShow(false)
        }}
        title="Dismiss"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          opacity: 0.7,
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}
