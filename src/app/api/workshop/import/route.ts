import { NextRequest, NextResponse } from 'next/server'
import { importToBuilderModel, attachAuthorLockToken } from '@/lib/workshop/index'

export async function POST(req: NextRequest) {
  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

  const { code } = body
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'code is required.' }, { status: 400 })

  let data: any
  try {
    data = importToBuilderModel(code.trim())
    if (data.model) {
      attachAuthorLockToken(data.model)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to import into builder.'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  const model = data.model || {}

  const sequences = Array.isArray(model.sequences) ? model.sequences.map((seq: any) => ({
    id: seq.id,
    name: seq.name,
    description: seq.description,
    help: seq.help,
    comments: seq.comments || '',
    changelog: seq.changelog || '',
    talentString: seq.talentString || '',
    talentBuild: seq.talentBuild || '',
    url: seq.url || '',
    contentTypes: Array.isArray(seq.contentTypes) ? seq.contentTypes : [],
    contextOverrides: seq.contextOverrides || {},
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
      repeatCount: Math.min(50, Math.max(1, Number(v.repeatCount) || 1)),
      resetModifiers: v.resetModifiers || null,
      useSpellIds: Boolean(v.useSpellIds),
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
        authorLockTokens: model.exportMeta?.authorLockTokens || undefined,
        privacyMode: model.exportMeta?.privacyMode || 'public',
        wowPatch: model.exportMeta?.wowPatch || '',
        talentString: model.exportMeta?.talentString || '',
        pseudonym: model.exportMeta?.pseudonym || '',
        exporterName: model.exportMeta?.exporterName || '',
        exporterRealm: model.exportMeta?.exporterRealm || '',
        region: model.exportMeta?.region || '',
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
