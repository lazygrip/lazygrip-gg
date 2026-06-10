// Credit: Beard3d_Gamer — builds GRIP exports from the builder model

import { deflateRawSync } from 'zlib'
import { encodeCbor } from './cborEncode'
import { formatMacroForGripExport } from './spellCatalog'

const GRIP_PREFIX = '!GRIP1!'
const GRIP_FORMAT_VERSION = 5
const DEFAULT_ICON = 134400
const STEP_FUNCTIONS = new Set(['Sequential', 'Priority', 'Random', 'ReversePriority'])
const LOOP_REPEAT_MAX = 50

function encodeGripExport(payload: unknown): string {
  const encoded = encodeCbor(payload)
  const compressed = deflateRawSync(Buffer.from(encoded))
  return `${GRIP_PREFIX}${compressed.toString('base64')}`
}

function normalizeStepFunction(sf: unknown): string {
  const value = String(sf || '').trim()
  if (!value) return 'Sequential'
  return [...STEP_FUNCTIONS].find(n => n.toLowerCase() === value.toLowerCase()) || 'Sequential'
}

function clampLoopRepeat(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.min(LOOP_REPEAT_MAX, Math.floor(parsed))
}

function prefixWarning(contextLabel: string, message: string): string {
  return contextLabel ? `${contextLabel}: ${message}` : message
}

interface BuilderAction {
  type: string
  macro?: string
  disabled?: boolean
  interval?: number
  name?: string
  label?: string
  children?: BuilderAction[]
  repeat?: number
  stepFunction?: string
  clicks?: number
  ms?: number
  sequence?: string
  variable?: string
  then?: BuilderAction[]
  else?: BuilderAction[]
}

function buildGripFlatSteps(actions: BuilderAction[]): string[] {
  const steps: string[] = []
  function walk(node: BuilderAction) {
    const type = String(node.type || 'action').toLowerCase()
    if (type === 'action') {
      const macro = formatMacroForGripExport(node.macro || '')
      if (macro.trim()) steps.push(macro)
      return
    }
    if (type === 'loop') {
      const repeat = clampLoopRepeat(node.repeat)
      for (let r = 0; r < repeat; r++) (node.children || []).forEach(walk)
      return
    }
    if (type === 'if') {
      ;(node.then || []).forEach(walk)
      ;(node.else || []).forEach(walk)
      return
    }
    if (type === 'pause') {
      const clicks = Number(node.clicks)
      steps.push(Number.isFinite(clicks) && clicks > 0 ? `/pause ${Math.floor(clicks)} clicks` : '/pause 1 clicks')
      return
    }
    if (type === 'embed') {
      const sequence = String(node.sequence || '').trim()
      if (sequence) steps.push(`/embed ${sequence}`)
    }
  }
  ;(actions || []).forEach(walk)
  return steps
}

function attachNodeMetadata(target: Record<string, unknown>, action: BuilderAction): Record<string, unknown> {
  const name = String(action.name || '').trim()
  const label = String(action.label || '').trim()
  if (name) target.name = name
  if (label) target.label = label
  if (action.disabled) target.disabled = true
  return target
}

function createActionNormalizer(warnings: string[], contextLabel: string) {
  let blockNumber = 0
  function warn(msg: string) { warnings.push(prefixWarning(contextLabel, msg)) }

  function normalize(action: BuilderAction): Record<string, unknown> | null {
    if (!action || typeof action !== 'object') return null
    blockNumber++
    const num = blockNumber
    const type = String(action.type || 'action').toLowerCase()

    if (type === 'action') {
      const macro = formatMacroForGripExport(action.macro || '')
      if (!macro.trim()) return null
      const node: Record<string, unknown> = { macro, type: 'action' }
      if (action.disabled) node.disabled = true
      const interval = Number(action.interval)
      if (Number.isFinite(interval) && interval > 0) node.interval = Math.min(50, Math.max(2, Math.floor(interval)))
      return attachNodeMetadata(node, action)
    }

    if (type === 'loop') {
      const children = (action.children || []).map(normalize).filter(Boolean) as Record<string, unknown>[]
      if (!children.length) { warn(`Loop #${num} has no steps inside — it was left out of the export.`); return null }
      return attachNodeMetadata({ type: 'loop', stepFunction: normalizeStepFunction(action.stepFunction), repeat: clampLoopRepeat(action.repeat), children }, action)
    }

    if (type === 'pause') {
      const clicks = Number(action.clicks)
      if (Number.isFinite(clicks) && clicks > 0) return attachNodeMetadata({ type: 'pause', clicks: Math.floor(clicks) }, action)
      const ms = Number(action.ms)
      if (Number.isFinite(ms) && ms > 0) return attachNodeMetadata({ type: 'pause', clicks: Math.max(1, Math.ceil(ms / 250)) }, action)
      return attachNodeMetadata({ type: 'pause', clicks: 1 }, action)
    }

    if (type === 'if') {
      const thenBranch = (action.then || []).map(normalize).filter(Boolean) as Record<string, unknown>[]
      const elseBranch = (action.else || []).map(normalize).filter(Boolean) as Record<string, unknown>[]
      if (!thenBranch.length && !elseBranch.length) { warn(`If #${num} has nothing in Then or Else — it was left out.`); return null }
      return attachNodeMetadata({ type: 'if', variable: String(action.variable || '= true').trim() || '= true', children: [thenBranch, elseBranch] }, action)
    }

    if (type === 'embed') {
      const sequence = String(action.sequence || '').trim()
      if (!sequence) { warn(`Block #${num} is an embed without a sequence name — it was left out.`); return null }
      return attachNodeMetadata({ type: 'embed', sequence }, action)
    }

    warn(`Block #${num} uses unsupported type "${type}" — it was left out.`)
    return null
  }

  return normalize
}

interface BuilderVersion {
  actions?: BuilderAction[]
  stepFunction?: string
  keyPress?: string
  keyRelease?: string
  resetOnCombat?: boolean
  resetOnTarget?: boolean
  resetOnGear?: boolean
  resetOnSpec?: boolean
  resetTimer?: number
}

interface BuilderSequence {
  name?: string
  description?: string
  help?: string
  classId?: number
  specId?: number | null
  defaultVersion?: number
  versions?: BuilderVersion[]
}

interface BuilderModel {
  sequences?: BuilderSequence[]
  exportMeta?: { collectionName?: string; author?: string; description?: string }
  author?: string
  type?: string
  variables?: Array<{ name?: string; description?: string; value?: string; function?: string; type?: string }>
  standaloneMacros?: Array<{ name?: string; macro?: string }>
}

function buildVersionPayload(version: BuilderVersion, warnings: string[], contextLabel: string) {
  const normalize = createActionNormalizer(warnings, contextLabel)
  const sourceActions = version.actions || []
  const actions = sourceActions.map(a => normalize(a as BuilderAction)).filter(Boolean)
  if (!actions.length) throw new Error(prefixWarning(contextLabel, 'Add at least one block with macro text.'))
  const steps = buildGripFlatSteps(sourceActions as BuilderAction[])
  if (!steps.length) warnings.push(prefixWarning(contextLabel, 'No exportable steps were found in this version.'))
  return {
    stepFunction: normalizeStepFunction(version.stepFunction),
    actions,
    steps,
    stepLabels: [],
    keyPress: formatMacroForGripExport(version.keyPress || ''),
    keyRelease: formatMacroForGripExport(version.keyRelease || ''),
    resetOnCombat: Boolean(version.resetOnCombat),
    resetOnTarget: Boolean(version.resetOnTarget),
    resetOnGear: Boolean(version.resetOnGear),
    resetOnSpec: Boolean(version.resetOnSpec),
    resetTimer: Math.max(0, Number(version.resetTimer) || 0),
  }
}

function buildSequencePayload(sequence: BuilderSequence, model: BuilderModel, warnings: string[]) {
  const name = String(sequence.name || '').trim() || 'Untitled'
  const versions = (sequence.versions || []).map((version, index) => {
    const sequences = Array.isArray(model.sequences) ? model.sequences : []
    const parts: string[] = []
    if (sequences.length > 1) parts.push(name)
    if ((sequence.versions || []).length > 1) parts.push(String(version).toString() || `Version ${index + 1}`)
    return buildVersionPayload(version, warnings, parts.join(' · '))
  })
  if (!versions.length) throw new Error(`Sequence "${name}" needs at least one version with blocks.`)
  const defaultVersion = Math.min(Math.max(1, Number(sequence.defaultVersion) || 1), versions.length)
  const exportMeta = model.exportMeta || {}
  return {
    name,
    payload: {
      icon: DEFAULT_ICON,
      author: String(exportMeta.author || model.author || '').trim(),
      description: String(sequence.description || '').trim(),
      help: String(sequence.help || '').trim(),
      classID: Number(sequence.classId) || 0,
      specID: sequence.specId ? Number(sequence.specId) : null,
      defaultVersion,
      versions,
    },
  }
}

export function buildGripFromModel(model: BuilderModel): {
  export: string; format: string; version: number; type: string; sequenceCount: number; sequenceNames: string[]; warnings: string[]
} {
  const warnings: string[] = []
  const inputSequences = Array.isArray(model.sequences) ? model.sequences : []
  if (!inputSequences.length) throw new Error('Add at least one sequence to the collection.')

  const builtSequences = inputSequences.map(s => buildSequencePayload(s, model, warnings))
  const sequenceNames = builtSequences.map(s => s.name)
  const isCollection = String(model.type || '').toUpperCase() === 'COLLECTION' || builtSequences.length > 1
  const exportMeta = model.exportMeta || {}

  let payload: Record<string, unknown>
  if (isCollection) {
    payload = { format: 'GRIP-EMS', version: GRIP_FORMAT_VERSION, type: 'COLLECTION', locale: 'enUS', sequences: {} }
    if (exportMeta.collectionName || exportMeta.author || exportMeta.description) {
      payload.exportMeta = { collectionName: String(exportMeta.collectionName || '').trim(), author: String(exportMeta.author || '').trim(), description: String(exportMeta.description || '').trim() }
    }
    for (const seq of builtSequences) {
      (payload.sequences as Record<string, unknown>)[seq.name] = seq.payload
    }
  } else {
    const seq = builtSequences[0]
    payload = { format: 'GRIP-EMS', version: GRIP_FORMAT_VERSION, locale: 'enUS', name: seq.name, sequence: seq.payload }
  }

  const variables = (model.variables || []).map(v => {
    const name = String(v?.name || '').trim()
    if (!name) return null
    const entry: Record<string, unknown> = { name }
    const description = String(v?.description || '').trim()
    if (description) { entry.description = description; entry.comments = description }
    if (v?.type === 'text') {
      if (!v.value) return null
      entry.value = formatMacroForGripExport(v.value)
      return entry
    }
    if (!v?.function) return null
    entry.function = v.function
    return entry
  }).filter(Boolean)

  const macros = (model.standaloneMacros || []).map(item => {
    const name = String(item?.name || '').trim()
    const macro = formatMacroForGripExport(item?.macro || '')
    if (!name || !macro.trim()) return null
    return { name, macro }
  }).filter(Boolean)

  if (variables.length) payload.variables = variables
  if (macros.length) payload.macros = macros

  return {
    export: encodeGripExport(payload),
    format: 'GRIP-EMS',
    version: GRIP_FORMAT_VERSION,
    type: isCollection ? 'COLLECTION' : 'SEQUENCE',
    sequenceCount: builtSequences.length,
    sequenceNames,
    warnings,
  }
}
