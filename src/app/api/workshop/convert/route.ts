import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Disconnected from the Workshop UI. The converter itself
// (convertGSEExportToGRIP in @/lib/workshop/index) is untouched
// and can be wired back in by restoring the body of this handler.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`workshop-convert:${ip}`, { limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 })
  }

  return NextResponse.json({ error: 'Not found.' }, { status: 404 })
}
