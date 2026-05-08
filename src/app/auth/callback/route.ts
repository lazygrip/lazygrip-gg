import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/browse'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
  }

  const response = NextResponse.redirect(`${origin}${next}`)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookie = request.headers.get('cookie')
          if (!cookie) return []
          return cookie.split('; ').map(c => {
            const [name, ...rest] = c.split('=')
            return { name, value: rest.join('=') }
          })
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: ResponseCookie }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('OAuth exchange error:', error.message, error.status)
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  return response
}