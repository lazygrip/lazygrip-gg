import { NextRequest, NextResponse } from 'next/server'

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
    const res = await fetch('https://toolbox.lazygrip.net/api/build-grip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TOOLBOX_SECRET}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Unable to build GRIP export.' }, { status: res.status })

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
  } catch {
    return NextResponse.json({ error: 'Toolbox service unavailable.' }, { status: 502 })
  }
}