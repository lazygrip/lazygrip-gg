import { NextRequest, NextResponse } from 'next/server'
import { convertGseToEms } from '@/lib/workshop/convertGse'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Converts a pasted GSE export into a GRIP-EMS export. It needs no account: the page
// runs the same decoder the builder uses, stores nothing, and carries the source
// author through to the result (see lib/workshop/convertGse.ts).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`workshop-convert:${ip}`, { limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 })
  }

  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

  const { code } = body
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'code is required.' }, { status: 400 })

  try {
    return NextResponse.json(convertGseToEms(code))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to convert this export.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
