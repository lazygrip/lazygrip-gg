'use client'
import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Mirrors public.has_completed_onboarding() in Postgres, which requires BOTH
// a custom username (not the 'user_<hash>' fallback from handle_new_user())
// AND a recorded terms_accepted_at from the /welcome interstitial. Keep this
// pattern and the two-condition check in sync with the DB function -- if
// either changes, this must change too, or the client-side pre-check will
// wrongly pass someone the DB will still reject.
const AUTO_GENERATED_USERNAME = /^user_[0-9a-f]{8}$/

export interface UsernameGateResult {
  ok: boolean
  username: string | null
}

/**
 * Client-side pre-check for whether the current user is allowed to post,
 * comment, or rate. Mirrors the DB-side has_completed_onboarding() gate so
 * the UI can show a clear modal *before* attempting a write, instead of
 * parsing a generic Postgres RLS-denial error after a failed request (which
 * carries no information about *why* it was denied).
 *
 * This is a UX convenience only -- it is not the source of truth. The DB-side
 * RLS policies and has_completed_onboarding()/is_verified_poster() functions
 * remain the actual enforcement; this can drift or be bypassed client-side
 * and the database will still reject the write.
 */
export function useUsernameGate() {
  const [checking, setChecking] = useState(false)

  const checkGate = useCallback(async (userId: string): Promise<UsernameGateResult> => {
    setChecking(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('username, terms_accepted_at')
        .eq('id', userId)
        .single()

      if (error || !data?.username) {
        // Fail closed: if we can't confirm a valid username, treat as blocked
        // rather than silently letting a write attempt through to fail on RLS.
        return { ok: false, username: data?.username ?? null }
      }

      const hasRealUsername = !AUTO_GENERATED_USERNAME.test(data.username)
      const ok = hasRealUsername && !!data.terms_accepted_at
      return { ok, username: data.username }
    } finally {
      setChecking(false)
    }
  }, [])

  return { checkGate, checking }
}
