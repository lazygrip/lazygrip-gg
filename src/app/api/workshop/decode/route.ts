import { NextRequest, NextResponse } from 'next/server'

interface ToolboxActionNode {
  index: number
  kind: string
  depth: number
  label: string
  text?: string
  stepFunction?: string
  repeat?: number
  interval?: number | null
  variable?: string
  children?: ToolboxActionNode[]
}

function normalizeEmsActionKind(node: ToolboxActionNode): ToolboxActionNode {
  const normalized: ToolboxActionNode = {
    ...node,
    kind: node.kind === 'Step' ? 'Action' : node.kind,
  }
  if (Array.isArray(normalized.children)) {
    normalized.children = normalized.children.map(normalizeEmsActionKind)
  }
  return normalized
}

export async function POST(req: NextRequest) {
  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

  const { code } = body
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'code is required.' }, { status: 400 })

  const cleaned = code.trim().replace(/\s+/g, '')

  if (!/^!(EMS1|GRIP1|GSE3)!/i.test(cleaned)) {
    return NextResponse.json({ error: 'Paste an !EMS1!, !GRIP1!, or !GSE3! export code.' }, { status: 422 })
  }

  let data: any
  try {
    const res = await fetch('https://toolbox.lazygrip.net/api/decode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TOOLBOX_SECRET}`,
      },
      body: JSON.stringify({ code: cleaned }),
    })
    data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Failed to decode export.' }, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Toolbox service unavailable.' }, { status: 502 })
  }

  const isGSE = data?.meta?.format === 'GSE3'

  const sequences = Array.isArray(data.sequences) ? data.sequences.map((seq: any) => ({
    name: seq.name,
    description: seq.description,
    class: seq.class,
    classId: seq.classId,
    spec: seq.spec,
    specId: seq.specId,
    defaultVersion: seq.defaultVersion,
    authorLocked: Boolean(seq.originalAuthor),
    lockedAuthor: seq.originalAuthor || '',
    privacyMode: seq.privacyMode || 'public',
    versions: Array.isArray(seq.versions) ? seq.versions.map((v: any) => {
      const rawActions = isGSE ? v.blocks : v.actions
      const actions = Array.isArray(rawActions)
        ? (isGSE ? rawActions : rawActions.map(normalizeEmsActionKind))
        : []
      return {
        index: v.index,
        name: v.name,
        stepFunction: v.stepFunction,
        keyPress: v.keyPress,
        keyRelease: v.keyRelease,
        actions,
        steps: v.steps,
      }
    }) : [],
    steps: seq.steps,
  })) : []

  return NextResponse.json({
    meta: isGSE ? { ...data.meta, format: 'GSE3' } : data.meta,
    sequences,
  })
}