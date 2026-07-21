import { NextRequest, NextResponse } from 'next/server'
import { searchSpells } from '@/lib/workshop/index'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || ''
  const classId = Number(searchParams.get('classId')) || 0
  const limit = Number(searchParams.get('limit')) || 12

  if (query.length < 2) return NextResponse.json({ results: [] })

  try {
    const results = searchSpells({ query, classId, limit })
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
