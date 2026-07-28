import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Cookie-free client for rows that are public by definition: published sequences and site config.
//
// server.ts builds its client from cookies(), and reading cookies() opts the whole route into
// dynamic rendering, so no amount of `revalidate` can ever cache a route that touches it. This
// client carries no session, so a render that only uses it stays cacheable. It must never be used
// for anything that depends on who is asking.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
