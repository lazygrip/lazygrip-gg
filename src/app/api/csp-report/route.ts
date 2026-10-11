import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { parseCspReports } from '@/lib/csp-report'

// Receives Content-Security-Policy violation reports from browsers, so the
// policy in next.config.js can be tightened from measured data instead of a
// guess. Public by necessity: browsers send these with no cookies and no
// credentials. Everything about it is therefore defensive -- it only ever logs,
// never stores or acts on what it reads, caps the body, rate-limits per IP, and
// answers 204 for every outcome so a caller learns nothing from the response.
//
// Reports appear in the Vercel runtime logs as lines starting "[csp-report]".

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 8 * 1024
const NO_CONTENT = () => new NextResponse(null, { status: 204 })

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`csp-report:${ip}`, { limit: 60, windowMs: 60_000 })) return NO_CONTENT()

  const declared = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return NO_CONTENT()

  let text = ''
  try {
    text = (await req.text()).slice(0, MAX_BODY_BYTES)
  } catch {
    return NO_CONTENT()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return NO_CONTENT()
  }

  for (const record of parseCspReports(parsed)) {
    console.warn('[csp-report]', JSON.stringify(record))
  }
  return NO_CONTENT()
}
