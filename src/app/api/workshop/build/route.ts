import { NextRequest, NextResponse } from 'next/server'
import { buildGripFromModel } from '@/lib/workshop/gripBuilder'
import { decodeEMSExport } from '@/lib/workshop/emsDecoder'
import { getCatalogInfo } from '@/lib/workshop/spellCatalog'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

  try {
    const result = buildGripFromModel(body)
    const decoded = decodeEMSExport(result.export)
    return NextResponse.json({
      ...result,
      decoded: { ...decoded, meta: { ...decoded.meta, spellCatalog: getCatalogInfo() } },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to build GRIP export.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
