// Credit: Beard3d_Gamer — imports any export or raw macro text into the builder model

import { decodeEMSExport } from './emsDecoder'
import { decodeGSEExport } from './gseDecoder'
import { convertGSEExportToGRIP } from './converter'
import { translateSpellTokens, formatMacroToBareSpellIds } from './spellCatalog'
import { inflateRawSync } from 'zlib'
import { CborReader, normalizeRecord } from './emsDecoder'

const STEP_FUNCTIONS = new Set(['Sequential', 'Priority', 'Random', 'ReversePriority'])
const LOOP_REPEAT_MAX = 50
const DEFAULT_VARIABLE_FUNCTION = `function()\n    return true\nend`

let nextNodeId = 1
let nextSequenceId = 1
let nextVersionId = 1
let nextGripVariableId = 1
let nextStandaloneMacroId = 1

function resetIdCounters() {
  nextNodeId = 1; nextSequenceId = 1; nextVersionId = 1
  nextGripVariableId = 1; nextStandaloneMacroId = 1
}

function newNodeId() { return String(nextNodeId++) }
function newSequenceId() { return String(nextSequenceId++) }
function newVersionId() { return String(nextVersionId++) }
function newGripVariableId() { return String(nextGripVariableId++) }
function newStandaloneMacroId() { return String(nextStandaloneMacroId++) }

function isGripExportCode(code: string): boolean {
  return /^!(?:EMS1|GRIP1)!/i.test(String(code || '').trim().replace(/\s+/g, ''))
}

function isGseExportCode(code: string): boolean {
  return /^!GSE3!/i.test(String(code || '').trim().replace(/\s+/g, ''))
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

function formatMacroForBuilder(macro: unknown, useSpellIds: boolean): string {
  const text = String(macro || '')
  if (!text.trim()) return ''
  const translated = translateSpellTokens(text)
  return useSpellIds ? formatMacroToBareSpellIds(translated) : translated
}

function attachImportedMetadata(target: Record<string, unknown>, node: Record<string, unknown>): Record<string, unknown> {
  const name = String(node.name || node.Name || '').trim()
  const label = String(node.label || node.Label || '').trim()
  if (name) target.name = name
  if (label) target.label = label
  if (node.disabled || node.Disabled) target.disabled = true
  return target
}

function pauseClicks(node: Record<string, unknown>): number {
  const clicks = Number(node.clicks || node.Clicks)
  if (Number.isFinite(clicks) && clicks > 0) return Math.floor(clicks)
  const ms = Number(node.ms || node.Ms)
  if (Number.isFinite(ms) && ms > 0) return Math.max(1, Math.ceil(ms / 250))
  return 1
}

function mapRawAction(action: unknown, warnings: string[]): Record<string, unknown> | null {
  const node = normalizeRecord(action)
  const type = String(node.type || node.Type || '').toLowerCase()

  if (type === 'action') {
    const macro = String(node.macro || node.Macro || '').trim()
    if (!macro) return null
    const step = attachImportedMetadata({ id: newNodeId(), type: 'action', macro }, node)
    const interval = Number(node.interval || node.Interval)
    if (Number.isFinite(interval) && interval >= 2) step.interval = Math.min(50, Math.floor(interval))
    return step
  }
  if (type === 'loop') {
    const children = mapRawActionsToBuilder(node.children || node.Children, warnings)
    if (!children.length) { warnings.push('Skipped empty loop while importing.'); return null }
    return attachImportedMetadata({ id: newNodeId(), type: 'loop', stepFunction: normalizeStepFunction(node.stepFunction || node.StepFunction), repeat: clampLoopRepeat(node.repeat ?? node.Repeat ?? 1), children }, node)
  }
  if (type === 'if') {
    const branches = Array.isArray(node.children) ? node.children as unknown[][] : []
    const thenBranch = mapRawActionsToBuilder(Array.isArray(branches[0]) ? branches[0] : [], warnings)
    const elseBranch = mapRawActionsToBuilder(Array.isArray(branches[1]) ? branches[1] : [], warnings)
    if (!thenBranch.length && !elseBranch.length) { warnings.push('Skipped empty If block while importing.'); return null }
    return attachImportedMetadata({ id: newNodeId(), type: 'if', variable: String(node.variable || node.Variable || '= true').trim() || '= true', then: thenBranch, else: elseBranch }, node)
  }
  if (type === 'pause') return attachImportedMetadata({ id: newNodeId(), type: 'pause', clicks: pauseClicks(node) }, node)
  if (type === 'embed') {
    const sequence = String(node.sequence || node.Sequence || '').trim()
    if (!sequence) { warnings.push('Skipped embed without a sequence name while importing.'); return null }
    return attachImportedMetadata({ id: newNodeId(), type: 'embed', sequence }, node)
  }
  warnings.push(`Skipped unsupported block type "${type}" while importing.`)
  return null
}

function mapRawActionsToBuilder(actions: unknown, warnings: string[]): Record<string, unknown>[] {
  if (!Array.isArray(actions)) return []
  return actions.map(a => mapRawAction(a, warnings)).filter(Boolean) as Record<string, unknown>[]
}

function formatStepText(step: Record<string, unknown>): string {
  const pre = ((step.preMarkers as string[]) || []).join('')
  const post = ((step.postMarkers as string[]) || []).join('')
  return `${pre}${step.text || ''}${post}`.trim()
}

function mapStepsToBuilder(steps: unknown[], warnings: string[]): Record<string, unknown>[] {
  const actions: Record<string, unknown>[] = []
  for (const step of steps || []) {
    const text = formatStepText(step as Record<string, unknown>)
    if (!text) continue
    if (/^\(\/(?:Loop|If|EndIf)\b/i.test(text)) continue
    const pauseMsMatch = text.match(/^\/pause\s+(\d+)\s*ms$/i)
    if (pauseMsMatch) { actions.push({ id: newNodeId(), type: 'pause', clicks: Math.max(1, Math.ceil(Number(pauseMsMatch[1]) / 250)) }); continue }
    const pauseClicksMatch = text.match(/^\/pause\s+(\d+)\s*clicks?$/i)
    if (pauseClicksMatch) { actions.push({ id: newNodeId(), type: 'pause', clicks: Number(pauseClicksMatch[1]) }); continue }
    const embedMatch = text.match(/^\/embed\s+(.+)$/i)
    if (embedMatch) { actions.push({ id: newNodeId(), type: 'embed', sequence: embedMatch[1].trim() }); continue }
    actions.push({ id: newNodeId(), type: 'action', macro: text })
  }
  if (!actions.length && (steps || []).length) warnings.push('Imported flat steps only; block structure may be simplified.')
  return actions
}

function applySpellDisplay(version: Record<string, unknown>, useSpellIds: boolean) {
  version.keyPress = formatMacroForBuilder(version.keyPress, useSpellIds)
  version.keyRelease = formatMacroForBuilder(version.keyRelease, useSpellIds)
  version.useSpellIds = useSpellIds
  function walk(nodes: Record<string, unknown>[]) {
    for (const node of nodes || []) {
      if (node.type === 'action') node.macro = formatMacroForBuilder(node.macro, useSpellIds)
      else if (node.type === 'loop') walk(node.children as Record<string, unknown>[])
      else if (node.type === 'if') { walk(node.then as Record<string, unknown>[]); walk(node.else as Record<string, unknown>[]) }
    }
  }
  walk(version.actions as Record<string, unknown>[])
}

function importVersion(decodedVersion: Record<string, unknown>, warnings: string[]): Record<string, unknown> {
  const source = normalizeRecord(decodedVersion.source || {})
  const rawActions = source.actions || source.Actions
  let actions: Record<string, unknown>[] = []
  if (Array.isArray(rawActions) && rawActions.length) {
    actions = mapRawActionsToBuilder(rawActions, warnings)
  } else if (Array.isArray(decodedVersion.steps) && (decodedVersion.steps as unknown[]).length) {
    actions = mapStepsToBuilder(decodedVersion.steps as unknown[], warnings)
  }
  const version: Record<string, unknown> = {
    id: newVersionId(),
    name: decodedVersion.name || 'Default',
    stepFunction: normalizeStepFunction(decodedVersion.stepFunction),
    keyPress: String(decodedVersion.keyPress || ''),
    keyRelease: String(decodedVersion.keyRelease || ''),
    resetOnCombat: Boolean(decodedVersion.resetOnCombat),
    resetOnTarget: Boolean(decodedVersion.resetOnTarget),
    resetOnGear: Boolean(decodedVersion.resetOnGear),
    resetOnSpec: Boolean(decodedVersion.resetOnSpec),
    resetTimer: Math.max(0, Number(decodedVersion.resetTimer) || 0),
    useSpellIds: false,
    actions,
  }
  applySpellDisplay(version, false)
  return version
}

function importSequence(sequence: Record<string, unknown>, warnings: string[]): Record<string, unknown> | null {
  let versions = ((sequence.versions as Record<string, unknown>[]) || []).map(v => importVersion(v, warnings))
  if (!versions.length && Array.isArray(sequence.steps) && (sequence.steps as unknown[]).length) {
    versions = [importVersion({ name: 'Default', stepFunction: sequence.stepFunction || 'Sequential', keyPress: sequence.keyPress || '', keyRelease: sequence.keyRelease || '', resetOnCombat: sequence.resetOnCombat, resetOnTarget: sequence.resetOnTarget, resetOnGear: sequence.resetOnGear, resetOnSpec: sequence.resetOnSpec, resetTimer: sequence.resetTimer, steps: sequence.steps, source: sequence }, warnings)]
  }
  if (!versions.length) { warnings.push(`Sequence "${sequence.name || 'Untitled'}" had no importable content.`); return null }
  return {
    id: newSequenceId(),
    name: sequence.name || 'IMPORTED_SEQUENCE',
    description: sequence.description || '',
    help: String(sequence.help || '').trim(),
    classId: Number(sequence.classId) || 0,
    specId: sequence.specId ? Number(sequence.specId) : null,
    defaultVersion: Math.min(Math.max(1, Number(sequence.defaultVersion) || 1), versions.length),
    versions,
  }
}

function mapImportedVariables(variables: unknown): Record<string, unknown>[] {
  if (!Array.isArray(variables)) return []
  return variables.map(entry => {
    const node = normalizeRecord(entry)
    const name = String(node.name || node.Name || '').trim()
    if (!name) return null
    const description = String(node.description || node.Description || node.comments || node.Comments || '').trim()
    const value = String(node.value || node.Value || node.text || node.Text || '').trim()
    const fn = String(node.function || node.Function || node.body || node.Body || '').trim()
    const isText = Boolean(value) && !fn
    return { id: newGripVariableId(), name, description, type: isText ? 'text' : 'function', value: isText ? formatMacroForBuilder(value, false) : '', function: isText ? '' : (fn || DEFAULT_VARIABLE_FUNCTION) }
  }).filter(Boolean) as Record<string, unknown>[]
}

function mapImportedStandaloneMacros(macros: unknown): Record<string, unknown>[] {
  if (!Array.isArray(macros)) return []
  return macros.map(entry => {
    const node = normalizeRecord(entry)
    const name = String(node.name || node.Name || '').trim()
    const macro = formatMacroForBuilder(node.macro || node.Macro || node.body || node.Body || '', false)
    if (!name || !macro.trim()) return null
    return { id: newStandaloneMacroId(), name, macro }
  }).filter(Boolean) as Record<string, unknown>[]
}

function decodeEMSPayload(exportString: string): Record<string, unknown> {
  const cleaned = String(exportString || '').trim().replace(/\s+/g, '')
  const payload = cleaned.replace(/^!(EMS1|GRIP1)!/i, '')
  const inflated = inflateRawSync(Buffer.from(payload, 'base64'))
  return new CborReader(inflated).decode() as Record<string, unknown>
}

function enforceSpellNamesDefault(model: Record<string, unknown>) {
  for (const macro of (model.standaloneMacros as Record<string, unknown>[]) || []) {
    macro.macro = formatMacroForBuilder(macro.macro, false)
  }
  for (const sequence of (model.sequences as Record<string, unknown>[]) || []) {
    for (const version of (sequence.versions as Record<string, unknown>[]) || []) {
      delete version.UseSpellIds; delete version.useSpellIDs
      applySpellDisplay(version, false)
    }
  }
}

function importFromDecoded(decoded: ReturnType<typeof decodeEMSExport>, rawPayload: Record<string, unknown> = {}): {
  model: Record<string, unknown>; warnings: string[]; type: string | null
} {
  const warnings: string[] = []
  const meta = decoded.meta || {}
  const exportMeta = (meta.exportMeta || {}) as Record<string, unknown>
  const sequences = decoded.sequences
    .map(s => importSequence(s as unknown as Record<string, unknown>, warnings))
    .filter(Boolean) as Record<string, unknown>[]
  if (!sequences.length) throw new Error('No sequences with importable content were found.')
  const variables = mapImportedVariables(rawPayload.variables || rawPayload.Variables)
  const standaloneMacros = mapImportedStandaloneMacros(rawPayload.macros || rawPayload.Macros)
  return {
    model: {
      exportMeta: { collectionName: exportMeta.collectionName || exportMeta.CollectionName || '', author: exportMeta.author || exportMeta.Author || '', description: exportMeta.description || exportMeta.Description || '' },
      variables, standaloneMacros, sequences,
    },
    warnings,
    type: meta.type || null,
  }
}

function importPlainMacro(text: string): { model: Record<string, unknown>; warnings: string[]; type: string } {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) throw new Error('Paste a GRIP export or macro text to import.')
  const actions = lines.map(line => ({ id: newNodeId(), type: 'action', macro: formatMacroForBuilder(line, false) }))
  return {
    model: {
      exportMeta: { collectionName: '', author: '', description: '' },
      variables: [], standaloneMacros: [],
      sequences: [{ id: newSequenceId(), name: 'IMPORTED_MACRO', description: '', help: '', classId: 0, specId: null, defaultVersion: 1, versions: [{ id: newVersionId(), name: 'Default', stepFunction: 'Sequential', keyPress: '', keyRelease: '', resetOnCombat: false, resetOnTarget: false, resetOnGear: false, resetOnSpec: false, resetTimer: 0, useSpellIds: false, actions }] }],
    },
    warnings: [],
    type: 'SEQUENCE',
  }
}

export function importToBuilderModel(input: string): { model: Record<string, unknown>; warnings: string[]; type: string | null } {
  const code = String(input || '').trim()
  resetIdCounters()
  if (!code) throw new Error('Paste a GRIP export or macro text to import.')

  if (isGripExportCode(code)) {
    const rawPayload = decodeEMSPayload(code)
    const result = importFromDecoded(decodeEMSExport(code), rawPayload)
    enforceSpellNamesDefault(result.model)
    return result
  }

  if (isGseExportCode(code)) {
    const decodedGse = decodeGSEExport(code)
    const converted = convertGSEExportToGRIP(code)
    const rawPayload = decodeEMSPayload(converted.export)
    const imported = importFromDecoded(decodeEMSExport(converted.export), rawPayload)
    imported.warnings = [...(converted.warnings || []), ...(imported.warnings || [])]
    enforceSpellNamesDefault(imported.model)
    return imported
  }

  const result = importPlainMacro(code)
  enforceSpellNamesDefault(result.model)
  return result
}
