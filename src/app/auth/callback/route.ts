import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

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
          return request.headers.get('cookie')
            ? request.headers.get('cookie')!.split('; ').map(c => {
                const [name, ...rest] = c.split('=')
                return { name, value: rest.join('=') }
              })
            : []
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
  }

  return response
}