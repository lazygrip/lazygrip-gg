'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// /profile is fully absorbed into the public /user/[username] profile page
// as of the 2026-09-14 consolidation (Slowdog's call to fold My
// Sequences/Saved/Drafts/Private/Settings into owner-only tabs there
// instead of maintaining a second, private-only profile page -- see
// ProfileTabs.tsx). Kept as a thin redirect rather than deleted outright:
// Header.tsx still links here in 10 places (desktop dropdown + mobile
// drawer) and DiscordLinkPrompt.tsx's OAuth redirectTo still points at
// /profile?tab=settings. Redirecting here preserves every one of those
// without touching them -- only the actual page content moved.
const TAB_MAP: Record<string, string> = {
  posted: 'sequences',
  private: 'sequences',
  saved: 'saved',
  drafts: 'drafts',
  settings: 'settings',
}

export default function ProfileRedirectPage() {
  return (
    <Suspense fallback={null}>
      <ProfileRedirectInner />
    </Suspense>
  )
}

function ProfileRedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function go() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      if (!profile?.username) { router.replace('/'); return }

      const rawTab = searchParams.get('tab')
      const tab = rawTab ? (TAB_MAP[rawTab] ?? 'sequences') : 'sequences'
      router.replace(`/user/${encodeURIComponent(profile.username)}?tab=${tab}`)
    }
    go()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ maxWidth: 900, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>Redirecting...</p>
    </div>
  )
}
