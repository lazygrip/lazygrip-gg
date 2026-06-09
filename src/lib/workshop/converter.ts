// Credit: Beard3d_Gamer — GSE to GRIP converter converted to TypeScript

import { decodeGSEExport, GSEBlock, GSESequence } from './gseDecoder'
import { encodeEMSExport, GRIP_PREFIX, GRIP_FORMAT_VERSION } from './emsEncoder'
import { stepsFromActions, EMSStep } from './emsDecoder'
import { formatMacroForGripExport } from './spellCatalog'
import { mergeKeyPress, extractKeyPressFromVersion, Block } from './keyPressExtract'

const DEFAULT_ICON = 134400
const STEP_FUNCTIONS = new Set(['Sequential', 'Priority', 'Random', 'ReversePriority'])
const INTERLEAVE_MIN = 2
const INTERLEAVE_MAX = 50
const LOOP_REPEAT_MAX = 50

export interface ConvertResult {
  export: string
  format: string
  version: number
  type: string
  sequenceCount: number
  sequenceNames: string[]
  warnings: string[]
}

export function convertGSEExportToGRIP(input: string): ConvertResult {
  const decoded = decodeGSEExport(input)
  return convertDecodedGSEToGRIP(decoded)
}

export function convertDecodedGSEToGRIP(decoded: ReturnType<typeof decodeGSEExport>): ConvertResult {
  const warnings: string[] = []
  const sequences = decoded.sequences || []
  const meta = decoded.meta || {}

  if (!sequences.length) throw new Error('The GSE export did not contain any sequences to convert.')

  const isCollection = sequences.length > 1 || (meta as any).type === 'COLLECTION'
  const payload = isCollection
    ? buildCollectionPayload(sequences, meta as any, warnings)
    : buildSinglePayload(sequences[0], meta as any, warnings)

  return {
    export: encodeEMSExport(payload, GRIP_PREFIX),
    format: 'GRIP-EMS',
    version: GRIP_FORMAT_VERSION,
    type: isCollection ? 'COLLECTION' : 'SEQUENCE',
    sequenceCount: sequences.length,
    sequenceNames: sequences.map(s => s.name),
    warnings,
  }
}

function buildSinglePayload(sequence: GSESequence, meta: Record<string, unknown>, warnings: string[]): unknown {
  return {
    format: 'GRIP-EMS',
    version: GRIP_FORMAT_VERSION,
    locale: 'enUS',
    name: sequence.name,
    sequence: buildSequencePayload(sequence, meta, warnings),
  }
}

function buildCollectionPayload(sequences: GSESequence[], meta: Record<string, unknown>, warnings: string[]): unknown {
  const exportMeta = (meta.exportMeta || {}) as Record<string, unknown>
  const payload: Record<string, unknown> = {
    format: 'GRIP-EMS',
    version: GRIP_FORMAT_VERSION,
    type: 'COLLECTION',
    locale: 'enUS',
    sequences: {},
  }
  if (exportMeta.collectionName || exportMeta.author || exportMeta.description) {
    payload.exportMeta = { collectionName: exportMeta.collectionName || '', author: exportMeta.author || '', description: exportMeta.description || '' }
  }
  for (const sequence of sequences) {
    (payload.sequences as Record<string, unknown>)[sequence.name] = buildSequencePayload(sequence, meta, warnings, sequence.name)
  }
  return payload
}

function buildSequencePayload(sequence: GSESequence, meta: Record<string, unknown>, warnings: string[], sequenceName = sequence.name): unknown {
  const exportMeta = (meta.exportMeta || {}) as Record<string, unknown>
  const versions = (sequence.versions || []).map((version, index) =>
    buildVersionPayload(version, warnings, `${sequenceName} · ${version.name || `Version ${index + 1}`}`)
  ).filter(Boolean)

  if (!versions.length) throw new Error(`Sequence "${sequenceName}" has no convertible macro blocks.`)

  return {
    icon: DEFAULT_ICON,
    author: exportMeta.author || '',
    description: sequence.description || exportMeta.description || '',
    help: '',
    classID: sequence.classId || (meta as any).classId || 0,
    specID: sequence.specId || (meta as any).specId || null,
    defaultVersion: sequence.defaultVersion || 1,
    versions,
  }
}

function buildVersionPayload(version: GSESequence['versions'][0], warnings: string[], label: string): unknown {
  const extracted = extractKeyPressFromVersion(version.blocks as unknown as Block[])
  const versionForMapping = {
    ...version,
    blocks: extracted.blocks as unknown as GSEBlock[],
    keyPress: mergeKeyPress(version.keyPress || '', extracted.keyPress),
  }
  const { actions, keyPress, keyRelease } = mapBlocksToActions(versionForMapping.blocks, warnings, label, versionForMapping)

  if (!actions.length) { warnings.push(`${label}: no actions were produced after conversion.`); return null }

  const steps = buildExportSteps(actions)
  if (!steps.length) warnings.push(`${label}: no flat steps were produced; import may fail until GRIP recompiles from actions.`)

  return {
    stepFunction: mapVersionStepFunction(version.stepFunction, actions),
    actions, steps,
    keyPress: keyPress || '',
    keyRelease: keyRelease || '',
    resetOnCombat: false, resetOnTarget: false, resetOnGear: false, resetOnSpec: false, resetTimer: 0,
  }
}

function mapBlocksToActions(
  blocks: GSEBlock[],
  warnings: string[],
  label: string,
  version: { keyPress?: string; keyRelease?: string } = {}
): { actions: unknown[]; keyPress: string; keyRelease: string } {
  let start = 0
  let end = blocks.length - 1
  let keyPress = formatMacroForGripExport(version.keyPress || '')
  let keyRelease = formatMacroForGripExport(version.keyRelease || '')

  if (blocks[0]?.kind === 'Repeat' && blocks[0].text) { keyPress = mergeKeyPress(keyPress, formatMacroForGripExport(blocks[0].text)); start = 1 }
  if (end >= start && blocks[end]?.kind === 'Repeat' && blocks[end].text) { keyRelease = mergeKeyPress(keyRelease, formatMacroForGripExport(blocks[end].text)); end -= 1 }

  const actions: unknown[] = []
  for (let i = start; i <= end; i++) {
    const node = mapBlockToAction(blocks[i], warnings, label)
    if (node) actions.push(node)
  }
  return { actions, keyPress, keyRelease }
}

function mapBlockToAction(block: GSEBlock, warnings: string[], label: string): unknown {
  if (!block) return null
  switch (block.kind) {
    case 'Action': return block.text ? { type: 'action', macro: formatMacroForGripExport(block.text) } : null
    case 'Repeat':
      if (!block.text) return null
      return { type: 'action', macro: formatMacroForGripExport(block.text), interval: clampInterval(block.interval) }
    case 'Loop': {
      const children = (block.children || []).map(c => mapBlockToAction(c, warnings, label)).filter(Boolean)
      if (!children.length) { warnings.push(`${label}: skipped empty loop.`); return null }
      return { type: 'loop', stepFunction: mapLoopStepFunction(block.stepFunction), repeat: clampLoopRepeat(block.repeat), children }
    }
    case 'Pause': return mapPauseBlock(block)
    case 'If': {
      const children = (block.children || []).map(c => mapBlockToAction(c, warnings, label)).filter(Boolean)
      if (!children.length) { warnings.push(`${label}: skipped empty If block.`); return null }
      return { type: 'if', variable: block.variable || '= true', children: [children, []] }
    }
    case 'Embed':
      if (!block.sequence) { warnings.push(`${label}: skipped embed with no sequence name.`); return null }
      return { type: 'embed', sequence: block.sequence }
    default: warnings.push(`${label}: skipped unsupported block type "${block.kind}".`); return null
  }
}

function mapPauseBlock(block: GSEBlock): unknown {
  const ms = block.ms
  if (ms === 'GCD' || ms === '~~GCD~~') return { type: 'pause', clicks: 2 }
  if (block.clicks && block.clicks > 0) return { type: 'pause', clicks: block.clicks }
  if (ms !== undefined && ms !== null && ms !== '') {
    const parsed = Number(ms)
    if (Number.isFinite(parsed) && parsed > 0) return { type: 'pause', clicks: Math.max(1, Math.ceil(parsed / 250)) }
  }
  return { type: 'pause', clicks: 1 }
}

function mapVersionStepFunction(stepFunction: string, actions: unknown[]): string {
  const normalized = normalizeStepFunction(stepFunction)
  if (normalized) return normalized
  const loop = (actions as any[]).find(a => a.type === 'loop')
  return mapLoopStepFunction(loop?.stepFunction)
}

function mapLoopStepFunction(stepFunction: string | undefined): string {
  return normalizeStepFunction(stepFunction || '') || 'Sequential'
}

function normalizeStepFunction(stepFunction: string): string {
  const value = String(stepFunction || '').trim()
  if (!value) return ''
  return [...STEP_FUNCTIONS].find(n => n.toLowerCase() === value.toLowerCase()) || value
}

function clampInterval(value: number | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return INTERLEAVE_MIN
  return Math.min(INTERLEAVE_MAX, Math.max(INTERLEAVE_MIN, Math.floor(parsed)))
}

function clampLoopRepeat(value: number | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.min(LOOP_REPEAT_MAX, Math.floor(parsed))
}

function buildExportSteps(actions: unknown[]): string[] {
  return stepsFromActions(actions as any[]).map(formatStepForExport).filter(Boolean) as string[]
}

function formatStepForExport(step: EMSStep): string {
  const pre = (step.preMarkers || []).join('')
  const post = (step.postMarkers || []).join('')
  const text = String(step.text || '').trim()
  return `${pre}${text}${post}`.trim() || text
}
