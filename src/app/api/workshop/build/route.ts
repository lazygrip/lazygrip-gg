import { NextRequest, NextResponse } from 'next/server'
import { buildGripFromModel, enforceAuthorLock, decodeEMSExport } from '@/lib/workshop/index'

function normalizeActionKind(node: any): any {
  const normalized = {
    ...node,
    kind: node.kind === 'Step' ? 'Action' : node.kind,
  }
  if (Array.isArray(normalized.children)) {
    normalized.children = normalized.children.map(normalizeActionKind)
  }
  return normalized
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

  try {
    enforceAuthorLock(body as any)
    const result = buildGripFromModel(body as any)
    const decoded = decodeEMSExport(result.export)
    const data: any = { ...result, decoded }

    if (data?.decoded?.sequences) {
      data.decoded.sequences = data.decoded.sequences.map((seq: any) => ({
        ...seq,
        versions: Array.isArray(seq.versions) ? seq.versions.map((v: any) => ({
          ...v,
          actions: Array.isArray(v.actions) ? v.actions.map(normalizeActionKind) : v.actions,
        })) : seq.versions,
      }))
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to build GRIP export.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
