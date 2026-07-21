import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // PKCE: OAuth and email links come back with ?code=. Exchange it for a
  // session (the code verifier lives in the @supabase/ssr cookie) before the
  // user lands anywhere. Without this server-side exchange the PKCE flow has no
  // handoff and login would hang.
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/browse`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/confirm`)
}