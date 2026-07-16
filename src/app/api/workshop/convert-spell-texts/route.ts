import { NextRequest, NextResponse } from 'next/server'
import { translateSpellTokens, formatMacroToBareSpellIds } from '@/lib/workshop_new/index'

export async function POST(req: NextRequest) {
  let body: { direction?: string; texts?: unknown[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

  const { direction, texts } = body

  if (direction !== 'toids' && direction !== 'tonames') {
    return NextResponse.json({ error: 'direction must be toids or tonames.' }, { status: 400 })
  }

  if (!Array.isArray(texts)) {
    return NextResponse.json({ error: 'texts must be an array.' }, { status: 400 })
  }

  try {
    const converted = texts.map(text => {
      const str = String(text ?? '')
      return direction === 'toids' ? formatMacroToBareSpellIds(str) : translateSpellTokens(str)
    })
    return NextResponse.json({ texts: converted })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to convert spell text.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
