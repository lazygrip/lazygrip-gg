import { NextRequest, NextResponse } from 'next/server'
import { importToBuilderModel } from '@/lib/workshop/gripImport'

export async function POST(req: NextRequest) {
  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

  const { code } = body
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'code is required.' }, { status: 400 })

  try {
    const result = importToBuilderModel(code.trim())
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to import into builder.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
