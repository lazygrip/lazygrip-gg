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

  // has_completed_onboarding() is this exact check, in the database, since
  // migration 008: a username that is present, non-blank and does not match
  // '^user_[0-9a-f]{8}$', AND terms_accepted_at is not null. Its own comment
  // calls it "the real posting gate". Calling it instead of reading the two
  // columns means `authenticated` no longer needs SELECT on terms_accepted_at
  // to serve a page load -- the point of M14's authenticated half, since a
  // column grant cannot say "own row only" and the SELECT policy is using(true).
  //
  // 014 revoked this function from anon and kept it for authenticated, which
  // is the role middleware runs as: the request carries the user's session.
  //
  // Fails closed exactly as the column read did. On any error `data` is null,
  // which is falsy, so the redirect fires rather than the request passing.
  const { data: onboardingComplete } = await supabase
    .rpc('has_completed_onboarding', { check_user_id: user.id })

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
