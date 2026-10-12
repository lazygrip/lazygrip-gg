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
    return NextResponse.redirect(`${origin}/auth/login?auth_error=failed`)
  }

  // When the provider or the database refuses a sign in, Supabase sends the
  // person back here with ?error=...&error_description=... and no code. That case
  // used to fall through to /auth/confirm, which says "Signing you in..." forever,
  // so a failed signup looked like a hang and the real reason never reached
  // anyone. Map it to a fixed code and send the person to the login page, which
  // shows a plain message. The description is only matched against, never copied
  // into the redirect, so nothing a stranger controls gets reflected onto the page.
  const providerError = searchParams.get('error') || searchParams.get('error_code')
  if (providerError) {
    const description = (searchParams.get('error_description') || '').toLowerCase()
    const reason = description.includes('getting user email') ? 'no_email' : 'failed'
    return NextResponse.redirect(`${origin}/auth/login?auth_error=${reason}`)
  }

  // No code and no error: the tokens may be in the URL hash, which only the
  // browser can see, so hand off to the client page as before.
  return NextResponse.redirect(`${origin}/auth/confirm`)
}