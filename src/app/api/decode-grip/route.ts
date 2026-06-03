import { NextRequest, NextResponse } from 'next/server'
import { decodeGripString } from '@/lib/gripDecoder'

export async function POST(req: NextRequest) {
  let body: { exportString?: string; sequenceIndex?: number }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { exportString, sequenceIndex } = body

  if (!exportString || typeof exportString !== 'string') {
    return NextResponse.json(
      { error: 'exportString is required.' },
      { status: 400 }
    )
  }

  try {
    const { sequences } = decodeGripString(exportString)

    // Multiple sequences and no index specified: return the names so the UI
    // can present a picker to the author.
    if (sequences.length > 1 && sequenceIndex === undefined) {
      return NextResponse.json({
        multipleSequences: true,
        sequences: sequences.map((s, i) => ({ name: s.name, index: i })),
      })
    }

    const targetIndex = sequenceIndex ?? 0

    if (targetIndex < 0 || targetIndex >= sequences.length) {
      return NextResponse.json(
        { error: `Sequence index ${targetIndex} is out of range.` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      multipleSequences: false,
      steps: sequences[targetIndex].steps,
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to decode export string.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
