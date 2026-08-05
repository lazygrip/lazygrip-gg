import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that stay reachable with no onboarding check, regardless of login
// state. Browsing, auth flows, the welcome page itself, and API routes must
// never redirect here, or the site becomes unusable for logged-out visitors
// and for the auth flow itself. Confirmed against the actual src/app route
// list on 2026-08-05 -- /post is deliberately NOT exempt, since that's the
// posting form and is exactly the page that should trigger the redirect.
const EXEMPT_PREFIXES = [
  '/welcome',
  '/auth',
  '/api',
  '/browse',
  '/sequences', // reading a sequence page is browsing; posting/commenting is
                // still blocked at the DB/RLS layer regardless of this check
  '/guide',
  '/workshop',
  '/profile',
  '/notifications',
  '/user',
  '/about',
  '/changelog',
  '/faq',
  '/privacy',
  '/tos',
]

function isExempt(pathname: string): boolean {
  if (pathname === '/') return true
  return EXEMPT_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

const AUTO_GENERATED_USERNAME = /^user_[0-9a-f]{8}$/

export async function middleware(request: NextRequest) {
  // Let the callback route handle itself — middleware interferes with PKCE exchange
  if (request.nextUrl.pathname.startsWith('/auth/callback')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Logged-out visitors are never blocked here — browsing stays open.
  // Exempt routes (welcome, auth, api, browsing pages) also always pass
  // through, so the redirect below only ever fires for a logged-in user
  // hitting a page that requires posting/commenting/rating.
  if (!user || isExempt(request.nextUrl.pathname)) {
    return supabaseResponse
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, terms_accepted_at')
    .eq('id', user.id)
    .single()

  const hasRealUsername = !!profile?.username && !AUTO_GENERATED_USERNAME.test(profile.username)
  const onboardingComplete = hasRealUsername && !!profile?.terms_accepted_at

  if (!onboardingComplete) {
    const redirectUrl = new URL('/welcome', request.url)
    redirectUrl.searchParams.set('returnTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
