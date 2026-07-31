import { NextRequest, NextResponse } from 'next/server'
import { decodeEMSExport, decodeGSEExport } from '@/lib/workshop/index'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`decode-grip:${ip}`, { limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 })
  }

  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

  const { code } = body
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'code is required.' }, { status: 400 })

  const cleaned = code.trim().replace(/\s+/g, '')

  try {
    if (/^!GSE3!/i.test(cleaned)) {
      const decoded = decodeGSEExport(cleaned)
      return NextResponse.json({
        meta: { ...decoded.meta, format: 'GSE3' },
        sequences: decoded.sequences.map(seq => ({
          name: seq.name,
          description: seq.description,
          class: seq.class,
          classId: seq.classId,
          spec: seq.spec,
          specId: seq.specId,
          defaultVersion: seq.defaultVersion,
          versions: (seq.versions || []).map((v: any) => ({
            index: v.index,
            name: v.name,
            stepFunction: v.stepFunction,
            keyPress: v.keyPress,
            keyRelease: v.keyRelease,
            actions: v.blocks,
            steps: v.steps,
          })),
          steps: seq.steps,
        })),
      })
    }

    if (/^!(EMS1|GRIP1)!/i.test(cleaned)) {
      const decoded = decodeEMSExport(cleaned)
      return NextResponse.json({
        meta: decoded.meta,
        sequences: decoded.sequences.map(seq => ({
          name: seq.name,
          description: seq.description,
          class: seq.class,
          classId: seq.classId,
          spec: seq.spec,
          specId: seq.specId,
          defaultVersion: seq.defaultVersion,
          versions: (seq.versions || []).map((v: any) => ({
            index: v.index,
            name: v.name,
            stepFunction: v.stepFunction,
            keyPress: v.keyPress,
            keyRelease: v.keyRelease,
            actions: v.actions,
            steps: v.steps,
          })),
          steps: seq.steps,
        })),
      })
    }

    return NextResponse.json({ error: 'Paste an !EMS1!, !GRIP1!, or !GSE3! export code.' }, { status: 422 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to decode export.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
