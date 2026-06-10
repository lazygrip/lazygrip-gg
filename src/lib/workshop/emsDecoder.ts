// Credit: Beard3d_Gamer — emsDecoder.js converted to TypeScript

import { inflateRawSync } from 'zlib'
import { translateSpellTokens } from './spellCatalog'
import { findTalentStringInComments, stripTalentFromText, parseTalentImportHeader } from './talentExtract'

const EXPORT_PREFIX = /^!(EMS1|GRIP1)!/i

const CLASS_BY_ID: Record<number, string> = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest',
  6: 'Death Knight', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 10: 'Monk',
  11: 'Druid', 12: 'Demon Hunter', 13: 'Evoker',
}

const SPEC_BY_ID: Record<number, { name: string; classId: number }> = {
  62: { name: 'Arcane', classId: 8 }, 63: { name: 'Fire', classId: 8 }, 64: { name: 'Frost', classId: 8 },
  65: { name: 'Holy', classId: 2 }, 66: { name: 'Protection', classId: 2 }, 70: { name: 'Retribution', classId: 2 },
  71: { name: 'Arms', classId: 1 }, 72: { name: 'Fury', classId: 1 }, 73: { name: 'Protection', classId: 1 },
  102: { name: 'Balance', classId: 11 }, 103: { name: 'Feral', classId: 11 },
  104: { name: 'Guardian', classId: 11 }, 105: { name: 'Restoration', classId: 11 },
  250: { name: 'Blood', classId: 6 }, 251: { name: 'Frost', classId: 6 }, 252: { name: 'Unholy', classId: 6 },
  253: { name: 'Beast Mastery', classId: 3 }, 254: { name: 'Marksmanship', classId: 3 }, 255: { name: 'Survival', classId: 3 },
  256: { name: 'Discipline', classId: 5 }, 257: { name: 'Holy', classId: 5 }, 258: { name: 'Shadow', classId: 5 },
  259: { name: 'Assassination', classId: 4 }, 260: { name: 'Outlaw', classId: 4 }, 261: { name: 'Subtlety', classId: 4 },
  262: { name: 'Elemental', classId: 7 }, 263: { name: 'Enhancement', classId: 7 }, 264: { name: 'Restoration', classId: 7 },
  265: { name: 'Affliction', classId: 9 }, 266: { name: 'Demonology', classId: 9 }, 267: { name: 'Destruction', classId: 9 },
  268: { name: 'Brewmaster', classId: 10 }, 269: { name: 'Windwalker', classId: 10 }, 270: { name: 'Mistweaver', classId: 10 },
  577: { name: 'Havoc', classId: 12 }, 581: { name: 'Vengeance', classId: 12 },
  1480: { name: 'Devourer', classId: 12 },
  1467: { name: 'Devastation', classId: 13 }, 1468: { name: 'Preservation', classId: 13 }, 1473: { name: 'Augmentation', classId: 13 },
}

export interface EMSStep {
  number: number
  text: string
  preMarkers: string[]
  postMarkers: string[]
  chars: number
  limit: number
  source: unknown
}

export interface EMSVersion {
  index: number
  name: string
  stepFunction: string
  keyPress: string
  keyRelease: string
  resetOnCombat: boolean
  resetOnTarget: boolean
  resetOnGear: boolean
  resetOnSpec: boolean
  resetTimer: number
  actions: unknown[]
  steps: EMSStep[]
  source: Record<string, unknown>
}

export interface EMSSequence {
  name: string
  description: string
  class: string
  classId: number | null
  spec: string
  specId: number | null
  defaultVersion: number
  versions: EMSVersion[]
  steps: EMSStep[]
}

export interface EMSExportMeta {
  collectionName: string
  author: string
  description: string
  url: string
  talentString: string | null
  talentSource: string | null
}

export interface DecodedEMSExport {
  meta: {
    format: string
    version: unknown
    type: string | null
    locale: unknown
    checksum: unknown
    exportMeta: EMSExportMeta | null
    class?: string
    classId?: number | null
    spec?: string
    specId?: number | null
    profileSource?: string | null
  }
  sequences: EMSSequence[]
}

export function decodeEMSExport(input: string): DecodedEMSExport {
  const cleaned = String(input || '').trim().replace(/\s+/g, '')
  if (!cleaned) throw new Error('Paste a GRIP EMS export code first.')
  if (!EXPORT_PREFIX.test(cleaned)) throw new Error('Expected an export code beginning with !EMS1! or !GRIP1!.')

  const payload = cleaned.replace(EXPORT_PREFIX, '')
  const compressed = Buffer.from(payload, 'base64')
  if (!compressed.length) throw new Error('The export payload is empty or not valid Base64.')

  let inflated: Buffer
  try { inflated = inflateRawSync(compressed) } catch { throw new Error('The export payload could not be inflated as GRIP EMS data.') }

  const decoded = new CborReader(inflated).decode() as Record<string, unknown>
  const sequences = normalizeSequences(decoded)
  const exportMeta = resolveExportMeta(
    (decoded.exportMeta ?? decoded.ExportMeta) as Record<string, unknown> | undefined,
    sequences
  )
  const exportProfile = readExportProfile(decoded, sequences, exportMeta)

  for (const sequence of sequences) {
    if (!sequence.class && exportProfile.class) { sequence.class = exportProfile.class as string; sequence.classId = (exportProfile.classId as number | null) ?? null }
    if (!sequence.spec && exportProfile.spec) { sequence.spec = exportProfile.spec as string; sequence.specId = (exportProfile.specId as number | null) ?? null }
  }

  if (exportMeta?.talentSource === 'description' && exportMeta.talentString) {
    if (exportMeta.description) exportMeta.description = stripTalentFromText(exportMeta.description, exportMeta.talentString)
    for (const sequence of sequences) {
      if (sequence.description) sequence.description = stripTalentFromText(sequence.description, exportMeta.talentString)
    }
  }

  return {
    meta: {
      format: (decoded.format as string) || 'Unknown',
      version: decoded.version ?? null,
      type: (decoded.type as string) || null,
      locale: decoded.locale ?? null,
      checksum: decoded.checksum ?? null,
      exportMeta,
      ...exportProfile,
    },
    sequences,
  }
}

function resolveExportMeta(
  exportMeta: Record<string, unknown> | undefined,
  sequences: EMSSequence[]
): EMSExportMeta | null {
  const meta = normalizeRecord(exportMeta)
  let talentString = (meta.talentString ?? meta.TalentString) as string | null ?? null
  let talentSource: string | null = talentString ? 'exportMeta' : null

  if (!talentString) {
    talentString = findTalentStringInComments(meta, sequences)
    if (talentString) talentSource = 'description'
  }

  const hasContent = Object.keys(meta).length > 0 || talentString
  if (!hasContent) return null

  return {
    collectionName: (meta.collectionName ?? meta.CollectionName ?? '') as string,
    author: (meta.author ?? meta.Author ?? '') as string,
    description: (meta.description ?? meta.Description ?? '') as string,
    url: (meta.url ?? meta.Url ?? '') as string,
    talentString,
    talentSource,
  }
}

function normalizeSequences(decoded: Record<string, unknown>): EMSSequence[] {
  const entries = findSequenceEntries(decoded)

  return entries.map((entry, index) => {
    const sequence = normalizeRecord(entry.value)
    const versions = normalizeVersions(sequence)
    const defaultVersion = readDefaultVersion(sequence, versions.length)
    const fallbackSteps = extractSteps(sequence, versions.map(v => v.source))
    const activeVersion = versions[defaultVersion - 1] || versions.find(v => v.steps.length > 0)
    const steps = activeVersion ? activeVersion.steps : fallbackSteps
    const profile = readClassInfo(sequence)
    const nestedProfile = profile.class || profile.spec ? profile : findClassInfoDeep(sequence)

    return {
      name: (entry.name || sequence.name || sequence.Name || sequence.title || sequence.Title || `Sequence ${index + 1}`) as string,
      description: (sequence.description ?? sequence.Description ?? '') as string,
      class: nestedProfile.class,
      classId: nestedProfile.classId,
      spec: nestedProfile.spec,
      specId: nestedProfile.specId,
      defaultVersion,
      versions,
      steps,
    }
  }).filter(s => s.steps.length > 0 || s.versions.length > 0)
}

function findSequenceEntries(decoded: Record<string, unknown>): Array<{ name: string; value: unknown }> {
  if (decoded.type === 'COLLECTION') return entriesFromSequenceValue(decoded.sequences ?? decoded.Sequences)
  if (decoded.sequence || decoded.Sequence) {
    return [{ name: (decoded.name ?? decoded.Name ?? '') as string, value: decoded.sequence ?? decoded.Sequence }]
  }
  return entriesFromSequenceValue(decoded.sequences ?? decoded.Sequences)
}

function entriesFromSequenceValue(value: unknown): Array<{ name: string; value: unknown }> {
  if (Array.isArray(value)) {
    return value.map((seq, i) => {
      const record = normalizeRecord(seq)
      return { name: (record.name ?? record.Name ?? record.title ?? record.Title ?? `Sequence ${i + 1}`) as string, value: seq }
    })
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([name, seq]) => ({ name, value: seq }))
  }
  return []
}

function readExportProfile(
  decoded: Record<string, unknown>,
  sequences: EMSSequence[],
  resolvedExportMeta: EMSExportMeta | null
): Record<string, unknown> {
  const record = normalizeRecord(decoded)
  const directCandidates = [
    record, record.meta, record.Meta, record.metadata, record.Metadata,
    record.exportMeta, record.ExportMeta, record.sequence, record.Sequence,
  ].map(normalizeRecord)

  for (const candidate of directCandidates) {
    const profile = readClassInfo(candidate)
    if (profile.class || profile.spec) return { ...profile, profileSource: 'payload' }
  }

  const nestedProfile = findClassInfoDeep(record)
  if (nestedProfile.class || nestedProfile.spec) return { ...nestedProfile, profileSource: 'payload' }

  const uniqueProfiles: Array<{ class: string; classId: number | null; spec: string; specId: number | null }> = []
  for (const seq of sequences) {
    if (!seq.class && !seq.spec) continue
    const key = `${seq.classId ?? seq.class}|${seq.specId ?? seq.spec}`
    if (!uniqueProfiles.some((p: any) => `${p.classId ?? p.class}|${p.specId ?? p.spec}` === key)) {
      uniqueProfiles.push({ class: seq.class, classId: seq.classId, spec: seq.spec, specId: seq.specId })
    }
  }
  if (uniqueProfiles.length === 1) return { ...uniqueProfiles[0], profileSource: 'sequence' }

  const exportMetaRecord = normalizeRecord((record.exportMeta ?? record.ExportMeta) as Record<string, unknown>)
  const talentString = resolvedExportMeta?.talentString
    || (exportMetaRecord.talentString as string)
    || (exportMetaRecord.TalentString as string)
    || findTalentStringInComments(exportMetaRecord, sequences)
  const talentProfile = readProfileFromTalentString(talentString)
  if (talentProfile.class || talentProfile.spec) return { ...talentProfile, profileSource: resolvedExportMeta?.talentSource ?? 'exportMeta' }

  return {}
}

function readProfileFromTalentString(talentString: string | null | undefined): { class: string; classId: number | null; spec: string; specId: number | null } {
  const header = parseTalentImportHeader(talentString ?? null)
  if (!header?.specId) return { class: '', classId: null, spec: '', specId: null }
  const specInfo = SPEC_BY_ID[header.specId]
  if (!specInfo) return { class: '', classId: null, spec: '', specId: header.specId }
  return { class: CLASS_BY_ID[specInfo.classId] || '', classId: specInfo.classId, spec: specInfo.name, specId: header.specId }
}

function readClassInfo(record: Record<string, unknown>): { class: string; classId: number | null; spec: string; specId: number | null } {
  const normalized = normalizeRecord(record)
  const metadata = normalizeRecord((normalized.MetaData ?? normalized.metaData ?? normalized.Metadata ?? normalized.metadata ?? {}) as Record<string, unknown>)
  const source = { ...metadata, ...normalized }

  const classId = firstNumber(source, ['classID', 'classId', 'ClassID', 'ClassId', 'class_id', 'playerClassID', 'playerClassId'])
  const specId = firstNumber(source, ['specID', 'specId', 'SpecID', 'SpecId', 'spec_id', 'specializationID', 'specializationId', 'playerSpecID', 'playerSpecId'])
  const specInfo = specId ? SPEC_BY_ID[specId] : null
  const resolvedClassId = classId || (specInfo ? specInfo.classId : null)

  return {
    class: firstString(source, ['class', 'Class', 'className', 'ClassName', 'playerClass']) || CLASS_BY_ID[resolvedClassId!] || '',
    classId: resolvedClassId || null,
    spec: firstString(source, ['spec', 'Spec', 'specName', 'SpecName', 'specialization', 'playerSpec']) || (specInfo ? specInfo.name : ''),
    specId: specId || null,
  }
}

function findClassInfoDeep(value: unknown, seen = new Set<object>()): { class: string; classId: number | null; spec: string; specId: number | null } {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return { class: '', classId: null, spec: '', specId: null }
  seen.add(value as object)
  const record = normalizeRecord(value as Record<string, unknown>)
  const direct = readClassInfo(record)
  if (direct.class || direct.spec) return direct
  for (const child of Object.values(record)) {
    const nested = findClassInfoDeep(child, seen)
    if (nested.class || nested.spec) return nested
  }
  return { class: '', classId: null, spec: '', specId: null }
}

function normalizeVersions(sequence: Record<string, unknown>): EMSVersion[] {
  const entries = findVersionEntries(sequence)
  const versions = entries.map((entry, index) => {
    const version = normalizeRecord(entry.value as Record<string, unknown>)
    const steps = stepsFromActions((version.actions ?? version.Actions) as unknown[])
    const fallbackSteps = steps.length ? steps : stepsFromRecord(version)
    const keyName = entry.key && !/^\d+$/.test(String(entry.key)) ? entry.key : ''

    return {
      index: index + 1,
      name: (version.name ?? version.Name ?? version.label ?? version.Label ?? keyName ?? `Version ${index + 1}`) as string,
      stepFunction: (version.stepFunction ?? version.StepFunction ?? '') as string,
      keyPress: translateSpellTokens((version.keyPress ?? version.KeyPress ?? '') as string),
      keyRelease: translateSpellTokens((version.keyRelease ?? version.KeyRelease ?? '') as string),
      resetOnCombat: Boolean(version.resetOnCombat || version.Combat),
      resetOnTarget: Boolean(version.resetOnTarget || version.Head),
      resetOnGear: Boolean(version.resetOnGear),
      resetOnSpec: Boolean(version.resetOnSpec),
      resetTimer: ((version.resetTimer ?? version.Timer ?? 0) as number),
      actions: normalizeGripActions((version.actions ?? version.Actions) as unknown[]),
      steps: fallbackSteps,
      source: version,
    }
  }).filter(v => v.steps.length > 0)

  if (versions.length) return versions

  const steps = stepsFromRecord(sequence)
  return steps.length ? [{
    index: 1, name: 'Version 1',
    stepFunction: (sequence.stepFunction ?? sequence.StepFunction ?? '') as string,
    keyPress: translateSpellTokens((sequence.keyPress ?? sequence.KeyPress ?? '') as string),
    keyRelease: translateSpellTokens((sequence.keyRelease ?? sequence.KeyRelease ?? '') as string),
    resetOnCombat: Boolean(sequence.resetOnCombat || sequence.Combat),
    resetOnTarget: Boolean(sequence.resetOnTarget || sequence.Head),
    resetOnGear: Boolean(sequence.resetOnGear),
    resetOnSpec: Boolean(sequence.resetOnSpec),
    resetTimer: (sequence.resetTimer ?? sequence.Timer ?? 0) as number,
    actions: [], steps, source: sequence,
  }] : []
}

function findVersionEntries(sequence: Record<string, unknown>): Array<{ key: string; value: unknown }> {
  const candidates = [sequence.versions, sequence.Versions, sequence.versionData, sequence.VersionData, sequence.sequenceVersions, sequence.SequenceVersions].filter(Boolean)
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map((v, i) => ({ key: String(i + 1), value: v }))
    if (candidate && typeof candidate === 'object') return Object.entries(candidate as Record<string, unknown>).map(([key, v]) => ({ key, value: v }))
  }
  return []
}

function readDefaultVersion(sequence: Record<string, unknown>, versionCount: number): number {
  const raw = Number(sequence.defaultVersion ?? sequence.DefaultVersion ?? sequence.default ?? sequence.Default ?? 1)
  if (!Number.isFinite(raw) || raw < 1) return 1
  if (versionCount > 0 && raw > versionCount) return 1
  return Math.floor(raw)
}

function extractSteps(sequence: Record<string, unknown>, versions: Record<string, unknown>[]): EMSStep[] {
  for (const version of versions) {
    const steps = stepsFromActions((version.actions ?? version.Actions) as unknown[])
    if (steps.length) return steps
  }
  return stepsFromRecord(sequence)
}

export function stepsFromActions(actions: unknown[]): EMSStep[] {
  if (!Array.isArray(actions) || actions.length === 0) return []
  const flattened: Array<{ text: string; charText?: string; preMarkers?: string[]; postMarkers?: string[]; source?: unknown }> = []
  flattenActions(actions, flattened)
  return flattened.map((step, index) => ({
    number: index + 1,
    text: step.text,
    preMarkers: step.preMarkers || [],
    postMarkers: step.postMarkers || [],
    chars: stepCharCount(step as EMSStep),
    limit: 255,
    source: step.source || null,
  }))
}

function stepCharCount(step: EMSStep): number {
  const markers = [...(step.preMarkers || []), ...(step.postMarkers || [])]
  return Buffer.byteLength(((step as any).charText || step.text || '') + markers.join(''), 'utf8') + markers.length
}

function flattenActions(actions: unknown[], output: Array<{ text: string; charText?: string; preMarkers?: string[]; postMarkers?: string[]; source?: unknown }>): void {
  for (const action of actions) {
    const node = normalizeRecord(action as Record<string, unknown>)
    const type = String(node.type ?? node.Type ?? '').toLowerCase()

    if (type === 'action') { appendMacroSteps(output, (node.macro ?? node.Macro ?? '') as string, node); continue }
    if (type === 'loop') {
      const sf = (node.stepFunction ?? node.StepFunction ?? 'Sequential') as string
      const label = `(/Loop-${sf}-Start)`
      const endLabel = `(/Loop-${sf}-End)`
      const before = output.length
      const children = Array.isArray(node.children) ? node.children : []
      let attachedStart = false
      if (output[output.length - 1]) { (output[output.length - 1].postMarkers = output[output.length - 1].postMarkers || []).push(label); attachedStart = true }
      flattenActions(children, output)
      if (output.length > before) {
        if (!attachedStart && output[before]) { (output[before].preMarkers = output[before].preMarkers || []).push(label) }
        ;(output[output.length - 1].postMarkers = output[output.length - 1].postMarkers || []).push(endLabel)
      }
      continue
    }
    if (type === 'if') {
      const condition = (node.variable ?? node.Variable ?? node.condition ?? node.Condition ?? '') as string
      appendMarker(output, `(/If ${condition})`)
      const children = Array.isArray(node.children) ? node.children : []
      for (const branch of children) { if (Array.isArray(branch)) flattenActions(branch, output) }
      appendMarker(output, '(/EndIf)')
      continue
    }
    if (type === 'pause') {
      const text = node.ms ? `/pause ${node.ms}ms` : node.gcd ? `/pause ${node.gcd} gcd` : `/pause ${node.clicks || 1} clicks`
      appendMacroSteps(output, text, node); continue
    }
    if (type === 'embed') { appendMacroSteps(output, `/embed ${(node.sequence ?? node.Sequence ?? '') as string}`.trim(), node) }
  }
}

function appendMacroSteps(output: Array<{ text: string; charText?: string; preMarkers?: string[]; postMarkers?: string[]; source?: unknown }>, macro: string, source: unknown): void {
  String(macro || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(line => {
    const translated = translateSpellTokens(line)
    output.push({ text: translated.replace(/\s{2,}/g, ' '), charText: translated, source })
  })
}

function appendMarker(output: Array<{ postMarkers?: string[] }>, marker: string): void {
  if (output[output.length - 1]) {
    (output[output.length - 1].postMarkers = output[output.length - 1].postMarkers || []).push(marker)
  }
}

function stepsFromRecord(record: Record<string, unknown>): EMSStep[] {
  const candidates = [record.steps, record.Steps, record.actions, record.Actions, record.macroSteps, record.MacroSteps].filter(Boolean)
  for (const candidate of candidates) {
    const steps = normalizeStepList(candidate)
    if (steps.length) return steps
  }
  return []
}

function normalizeStepList(value: unknown): EMSStep[] {
  if (Array.isArray(value)) return value.map((s, i) => normalizeStep(s, i)).filter(s => s.text || s.postMarkers?.length)
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).sort(([a], [b]) => Number(a) - Number(b)).map(([, s], i) => normalizeStep(s, i)).filter(s => s.text || s.postMarkers?.length)
  }
  return []
}

function normalizeStep(step: unknown, index: number): EMSStep {
  if (typeof step === 'string') return buildStep(index, step, null, null)
  if (!step || typeof step !== 'object') return buildStep(index, '', null, null)
  const record = normalizeRecord(step as Record<string, unknown>)
  const text = firstString(record, ['macrotext', 'macroText', 'MacroText', 'text', 'Text', 'body', 'Body', 'value', 'Value', 'line', 'Line'])
  const marker = firstString(record, ['marker', 'Marker', 'label', 'Label', 'comment', 'Comment'])
  return buildStep(index, text, marker, record)
}

function buildStep(index: number, text: string, marker: string | null, source: unknown): EMSStep {
  const macro = translateSpellTokens(text)
  const resolvedMarker = marker && /^\(\/.+\)$/.test(marker) ? marker : null
  return {
    number: index + 1, text: macro, preMarkers: [],
    postMarkers: resolvedMarker ? [resolvedMarker] : [],
    chars: Buffer.byteLength(macro, 'utf8'), limit: 255, source,
  }
}

function normalizeGripActions(actions: unknown[], depth = 0): unknown[] {
  if (!Array.isArray(actions) || !actions.length) return []
  return actions.map((action, i) => normalizeGripAction(action, i + 1, depth)).filter(Boolean)
}

function normalizeGripAction(action: unknown, index: number, depth = 0): unknown {
  const node = normalizeRecord(action as Record<string, unknown>)
  const type = String(node.type ?? node.Type ?? '').toLowerCase()

  if (type === 'action') {
    const macro = String(node.macro ?? node.Macro ?? '').trim()
    if (!macro) return null
    const interval = Number(node.interval ?? node.Interval)
    const isRepeat = Number.isFinite(interval) && interval > 0
    return { index, kind: isRepeat ? 'Repeat' : 'Action', depth, label: isRepeat ? `Repeat · every ${interval}` : 'Action', text: translateSpellTokens(macro), interval: isRepeat ? interval : null, children: [] }
  }
  if (type === 'loop') {
    const sf = (node.stepFunction ?? node.StepFunction ?? 'Sequential') as string
    const repeat = node.repeat ?? node.Repeat ?? 1
    return { index, kind: 'Loop', depth, label: `Loop · ${sf} · ×${repeat}`, stepFunction: sf, repeat, text: '', children: normalizeGripActions(node.children as unknown[] || [], depth + 1) }
  }
  if (type === 'if') {
    const variable = (node.variable ?? node.Variable ?? node.condition ?? node.Condition ?? '') as string
    const branches = Array.isArray(node.children) ? node.children : []
    const children = branches.flatMap((branch: unknown) => normalizeGripActions(Array.isArray(branch) ? branch : [branch], depth + 1))
    return { index, kind: 'If', depth, label: variable ? `If · ${variable}` : 'If', variable, text: '', children }
  }
  if (type === 'pause') {
    const clicks = node.clicks ?? node.Clicks ?? 1
    return { index, kind: 'Pause', depth, label: `Pause · ${clicks} clicks`, text: '', children: [] }
  }
  if (type === 'embed') {
    const sequence = (node.sequence ?? node.Sequence ?? '') as string
    return { index, kind: 'Embed', depth, label: sequence ? `Embed · ${sequence}` : 'Embed', text: '', children: [] }
  }
  return null
}

export function normalizeRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return arrayToRecord(value)
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function arrayToRecord(value: unknown[]): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string') record[item[0]] = item[1]
    else if (item && typeof item === 'object' && !Array.isArray(item)) Object.assign(record, item)
  }
  return record
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = readRecordValue(record, key)
    if (typeof val === 'string') return val
  }
  return ''
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = Number(readRecordValue(record, key))
    if (Number.isFinite(val) && val > 0) return Math.floor(val)
  }
  return null
}

function readRecordValue(record: Record<string, unknown>, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(record, key)) return record[key]
  const lower = key.toLowerCase()
  const match = Object.keys(record).find(k => k.toLowerCase() === lower)
  return match ? record[match] : undefined
}

export class CborReader {
  private buffer: Buffer
  private offset: number

  constructor(buffer: Buffer) { this.buffer = buffer; this.offset = 0 }

  decode(): unknown {
    const value = decodeLuaStrings(this.readValue())
    if (this.offset !== this.buffer.length) throw new Error('The decoded CBOR payload has trailing data.')
    return value
  }

  private readValue(): unknown {
    const initial = this.readUInt8()
    const major = initial >> 5
    const additional = initial & 0x1f
    if (major === 0) return this.readLength(additional)
    if (major === 1) return -1 - this.readLength(additional)
    if (major === 2) return this.readBytes(additional)
    if (major === 3) return this.readString(additional)
    if (major === 4) return this.readArray(additional)
    if (major === 5) return this.readMap(additional)
    if (major === 6) return { tag: this.readLength(additional), value: this.readValue() }
    return this.readSimple(additional)
  }

  private readArray(additional: number): unknown[] {
    if (additional === 31) { const r: unknown[] = []; while (!this.nextIsBreak()) r.push(this.readValue()); this.offset += 1; return r }
    const length = this.readLength(additional)
    const r: unknown[] = []
    for (let i = 0; i < length; i++) r.push(this.readValue())
    return r
  }

  private readMap(additional: number): Record<string, unknown> {
    const r: Record<string, unknown> = {}
    if (additional === 31) { while (!this.nextIsBreak()) r[String(this.readValue())] = this.readValue(); this.offset += 1; return r }
    const length = this.readLength(additional)
    for (let i = 0; i < length; i++) r[String(this.readValue())] = this.readValue()
    return r
  }

  private readBytes(additional: number): Buffer {
    if (additional === 31) { const chunks: Buffer[] = []; while (!this.nextIsBreak()) chunks.push(this.readValue() as Buffer); this.offset += 1; return Buffer.concat(chunks) }
    const length = this.readLength(additional); this.require(length)
    const bytes = this.buffer.subarray(this.offset, this.offset + length); this.offset += length; return bytes
  }

  private readString(additional: number): string {
    if (additional === 31) { let v = ''; while (!this.nextIsBreak()) v += this.readValue(); this.offset += 1; return v }
    const length = this.readLength(additional); this.require(length)
    const v = this.buffer.toString('utf8', this.offset, this.offset + length); this.offset += length; return v
  }

  private readSimple(additional: number): unknown {
    if (additional === 20) return false; if (additional === 21) return true
    if (additional === 22) return null; if (additional === 23) return undefined
    if (additional === 24) return this.readUInt8()
    if (additional === 25) return this.readFloat16()
    if (additional === 26) return this.readFloat32()
    if (additional === 27) return this.readFloat64()
    if (additional === 31) throw new Error('Unexpected CBOR break marker.')
    throw new Error(`Unsupported CBOR simple value ${additional}.`)
  }

  private readLength(additional: number): number {
    if (additional < 24) return additional
    if (additional === 24) return this.readUInt8()
    if (additional === 25) { this.require(2); const v = this.buffer.readUInt16BE(this.offset); this.offset += 2; return v }
    if (additional === 26) { this.require(4); const v = this.buffer.readUInt32BE(this.offset); this.offset += 4; return v }
    if (additional === 27) { this.require(8); const v = this.buffer.readBigUInt64BE(this.offset); this.offset += 8; return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : Number(v) }
    throw new Error(`Unsupported CBOR length marker ${additional}.`)
  }

  private readUInt8(): number { this.require(1); return this.buffer[this.offset++] }
  private readFloat16(): number { const h = this.readLength(25); const e = (h & 0x7c00) >> 10; const f = h & 0x03ff; const s = h & 0x8000 ? -1 : 1; if (e === 0) return s * 2 ** -14 * (f / 2 ** 10); if (e === 31) return f ? NaN : s * Infinity; return s * 2 ** (e - 15) * (1 + f / 2 ** 10) }
  private readFloat32(): number { this.require(4); const v = this.buffer.readFloatBE(this.offset); this.offset += 4; return v }
  private readFloat64(): number { this.require(8); const v = this.buffer.readDoubleBE(this.offset); this.offset += 8; return v }
  private nextIsBreak(): boolean { this.require(1); return this.buffer[this.offset] === 0xff }
  private require(length: number): void { if (this.offset + length > this.buffer.length) throw new Error('The decoded CBOR payload ended unexpectedly.') }
}

function decodeLuaStrings(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  if (Array.isArray(value)) return value.map(decodeLuaStrings)
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) result[k] = decodeLuaStrings(v)
    return result
  }
  return value
}
