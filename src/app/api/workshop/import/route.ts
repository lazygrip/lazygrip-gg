import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

  const { code } = body
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'code is required.' }, { status: 400 })

  let data: any
  try {
    const res = await fetch('https://toolbox.lazygrip.net/api/import-to-builder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TOOLBOX_SECRET}`,
      },
      body: JSON.stringify({ code: code.trim() }),
    })
    data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Unable to import into builder.' }, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Toolbox service unavailable.' }, { status: 502 })
  }

  const model = data.model || {}

  const sequences = Array.isArray(model.sequences) ? model.sequences.map((seq: any) => ({
    id: seq.id,
    name: seq.name,
    description: seq.description,
    help: seq.help,
    classId: seq.classId,
    specId: seq.specId,
    defaultVersion: seq.defaultVersion,
    versions: Array.isArray(seq.versions) ? seq.versions.map((v: any) => ({
      id: v.id,
      name: v.name,
      stepFunction: v.stepFunction,
      keyPress: v.keyPress,
      keyRelease: v.keyRelease,
      resetOnCombat: v.resetOnCombat,
      resetOnTarget: v.resetOnTarget,
      resetOnGear: v.resetOnGear,
      resetOnSpec: v.resetOnSpec,
      resetTimer: v.resetTimer,
      actions: v.actions,
    })) : [],
  })) : []

  return NextResponse.json({
    model: {
      exportMeta: {
        collectionName: model.exportMeta?.collectionName || '',
        author: model.exportMeta?.author || '',
        description: model.exportMeta?.description || '',
        originalAuthor: model.exportMeta?.originalAuthor || '',
        originalAuthorRealm: model.exportMeta?.originalAuthorRealm || '',
        authorLocked: Boolean(model.exportMeta?.authorLocked),
        lockedAuthor: model.exportMeta?.lockedAuthor || '',
        privacyMode: model.exportMeta?.privacyMode || 'public',
      },
      variables: Array.isArray(model.variables) ? model.variables.map((v: any) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        type: v.type,
        value: v.value,
        function: v.function,
      })) : [],
      standaloneMacros: Array.isArray(model.standaloneMacros) ? model.standaloneMacros.map((m: any) => ({
        id: m.id,
        name: m.name,
        macro: m.macro,
      })) : [],
      sequences,
    },
    warnings: data.warnings || [],
    type: data.type || null,
  })
}