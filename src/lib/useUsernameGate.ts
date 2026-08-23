'use client'
import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Mirrors public.has_completed_onboarding() AND public.is_verified_poster() in
// Postgres -- both are required by AND on every posting/commenting/rating RLS
// insert policy (see supabase/migrations, "Onboarded verified authors can
// insert/comment/rate"). This used to only mirror has_completed_onboarding
// (username + terms), which is why an account could clear every client-side
// check, submit, and still get a bare "new row violates row-level security
// policy" from Postgres -- the email-confirmation and 60-minute-account-age
// halves of is_verified_poster live on auth.users, which the client can't
// query directly.
//
// checkGate() stays a plain ok/not-ok boolean. The full itemized breakdown
// (which condition(s) are failing, minutes remaining, etc) lives in
// PostingEligibilityChecklist, which calls get_posting_eligibility() itself
// once it's shown -- that avoids computing and threading a `reason` value
// through every call site just to throw it away in favor of the checklist's
// own fuller fetch. checkGate's job is only to decide whether to show the
// checklist at all, and to do that as cheaply as possible: username and
// terms are checked directly against `profiles` (already being fetched for
// display purposes at most call sites) before ever calling the RPC, so an
// account failing on those never pays for the extra round trip.
//
// This remains a UX convenience only, same as before. The DB-side RLS
// policies and has_completed_onboarding()/is_verified_poster() remain the
// actual enforcement; this can drift or be bypassed client-side and the
// database will still reject the write.

const AUTO_GENERATED_USERNAME = /^user_[0-9a-f]{8}$/

export interface UsernameGateResult {
  ok: boolean
  username: string | null
}

export function useUsernameGate() {
  const [checking, setChecking] = useState(false)

  const checkGate = useCallback(async (userId: string): Promise<UsernameGateResult> => {
    setChecking(true)
    try {
      const supabase = createClient()

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, terms_accepted_at')
        .eq('id', userId)
        .single()

      // Fail closed on the profile read itself: if we can't confirm
      // anything, treat as blocked rather than letting a write attempt
      // through to fail on RLS with no context.
      if (profileError || !profile?.username) {
        return { ok: false, username: profile?.username ?? null }
      }

      const hasRealUsername = !AUTO_GENERATED_USERNAME.test(profile.username)
      if (!hasRealUsername || !profile.terms_accepted_at) {
        return { ok: false, username: profile.username }
      }

      // Username and terms both check out. The remaining conditions
      // (display name, email/OAuth confirmation, account age) require the
      // get_posting_eligibility() RPC to check, since they read auth.users,
      // which isn't directly queryable from the client. Rather than call
      // that RPC here just to throw the detail away, checkGate calls it
      // once more, cheaply, only to decide ok/not-ok -- the checklist does
      // its own full fetch when and if it's actually shown, so there's no
      // real duplication of effort in the common case where everything's
      // fine and the checklist never renders.
      const { data: eligibility, error: eligibilityError } = await supabase
        .rpc('get_posting_eligibility', { check_user_id: userId })
        .single()

      if (eligibilityError || !eligibility) {
        // RPC failed to answer (network, transient error). Don't fail
        // closed here the way the profile read does -- username and terms
        // already passed, and the remaining conditions are true for the
        // overwhelming majority of accounts past that point. Blocking on an
        // RPC hiccup would trade a rare, informative failure for a common,
        // opaque one. The real RLS check on submit is still the backstop
        // either way.
        return { ok: true, username: profile.username }
      }

      return { ok: !!(eligibility as { eligible: boolean }).eligible, username: profile.username }
    } finally {
      setChecking(false)
    }
  }, [])

  return { checkGate, checking }
}
