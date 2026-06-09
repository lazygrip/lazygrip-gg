// Credit: Beard3d_Gamer — gseDecoder.js converted to TypeScript

import { inflateRawSync, inflateSync, unzipSync } from 'zlib'
import { encodeCbor } from './cborEncode'
import { CborReader, normalizeRecord } from './emsDecoder'
import { translateSpellTokens } from './spellCatalog'
import { parseTalentImportHeader } from './talentExtract'

const EXPORT_PREFIX = /^!GSE3!/i
const BLOCK_TYPES = new Set(['Action', 'Loop', 'Repeat', 'Pause', 'If', 'Embed'])

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

export interface GSEBlock {
  index: number
  kind: string
  depth: number
  label: string
  text: string
  children: GSEBlock[]
  stepFunction?: string
  repeat?: number
  variable?: string
  interval?: number | null
  ms?: string | number
  clicks?: number
  sequence?: string
}

export interface GSEVersion {
  index: number
  name: string
  stepFunction: string
  keyPress: string
  keyRelease: string
  blocks: GSEBlock[]
  steps: unknown[]
}

export interface GSESequence {
  name: string
  description: string
  class: string
  classId: number | null
  spec: string
  specId: number | null
  defaultVersion: number
  metaData: Record<string, unknown>
  versions: GSEVersion[]
  steps: unknown[]
}

export interface DecodedGSEExport {
  meta: {
    format: string
    type: string
    class: string
    classId: number | null
    spec: string
    specId: number | null
    profileSource: string | null
    exportMeta: { author: string; description: string; collectionName: string; url: string }
  }
  sequences: GSESequence[]
}

export function decodeGSEExport(input: string): DecodedGSEExport {
  const cleaned = String(input || '').trim().replace(/\s+/g, '')
  if (!cleaned) throw new Error('Paste a GSE export code first.')
  if (!EXPORT_PREFIX.test(cleaned)) throw new Error('Expected an export code beginning with !GSE3!.')

  const payload = cleaned.replace(EXPORT_PREFIX, '')
  const compressed = Buffer.from(payload, 'base64')
  if (!compressed.length) throw new Error('The export payload is empty or not valid Base64.')

  let inflated: Buffer
  try { inflated = decompressGSEPayload(compressed) } catch { throw new Error('The export payload could not be inflated as GSE3 data.') }

  let decoded: unknown
  try { decoded = unwrapCborValue(new CborReader(inflated).decode()) } catch { throw new Error('The export payload is not valid GSE3 CBOR data.') }

  const sequences = normalizeImportPayload(decoded)
  const exportProfile = readSequenceProfile(sequences[0])

  for (const sequence of sequences) {
    if (!sequence.class && exportProfile.class) { sequence.class = exportProfile.class; sequence.classId = exportProfile.classId }
    if (!sequence.spec && exportProfile.spec) { sequence.spec = exportProfile.spec; sequence.specId = exportProfile.specId }
  }

  const primary = sequences[0] || {}
  const metaData = (primary as any).metaData || {}
  const rootType = decoded && typeof decoded === 'object' && !Array.isArray(decoded)
    ? ((decoded as any).type || (decoded as any).Type)
    : null

  return {
    meta: {
      format: 'GSE3',
      type: rootType || (sequences.length > 1 ? 'COLLECTION' : 'SEQUENCE'),
      class: exportProfile.class || (primary as any).class || '',
      classId: exportProfile.classId || (primary as any).classId || null,
      spec: exportProfile.spec || (primary as any).spec || '',
      specId: exportProfile.specId || (primary as any).specId || null,
      profileSource: exportProfile.profileSource || null,
      exportMeta: {
        author: metaData.Author || metaData.author || '',
        description: metaData.Help || metaData.help || '',
        collectionName: '',
        url: '',
      },
    },
    sequences,
  }
}

function normalizeImportPayload(decoded: unknown): GSESequence[] {
  const entries = collectSequenceEntries(unwrapCollectionContainer(unwrapCborValue(decoded)))
  if (!entries.length) throw new Error('The GSE export did not contain a recognizable sequence.')
  return entries.map((entry, index) => normalizeSequence(entry.name || `Sequence ${index + 1}`, entry.value))
}

function unwrapCollectionContainer(root: unknown): unknown {
  if (!root || typeof root !== 'object' || Array.isArray(root)) return root
  const record = normalizeRecord(root)
  const nested = record.payload || record.Payload
  if (nested && typeof nested === 'object') return nested
  return root
}

function collectSequenceEntries(container: unknown): Array<{ name: string; value: unknown }> {
  if (Array.isArray(container)) {
    if (container.length >= 2 && typeof container[1] === 'object' && container[1] !== null) {
      return [{ name: typeof container[0] === 'string' ? container[0] : 'Sequence', value: container[1] }]
    }
    return container.filter(item => item && typeof item === 'object').map((item, i) => ({
      name: normalizeRecord(item).MetaData?.Name || normalizeRecord(item).metaData?.name || `Sequence ${i + 1}` as string,
      value: item,
    }))
  }
  if (!container || typeof container !== 'object') return []
  const record = normalizeRecord(container)
  const sequenceMap = record.Sequences || record.sequences
  if (sequenceMap && typeof sequenceMap === 'object') {
    return Object.entries(sequenceMap as Record<string, unknown>).filter(([, v]) => v && typeof v === 'object').map(([name, value]) => ({ name, value }))
  }
  if (record.MetaData || record.metaData || record.Versions || record.Macros || record.Actions || record.actions) {
    return [{ name: (record.MetaData as any)?.Name || (record.metaData as any)?.name || 'Sequence', value: record }]
  }
  return Object.entries(record).filter(([, v]) => v && typeof v === 'object').filter(([, v]) => {
    const s = normalizeRecord(v)
    return s.MetaData || s.metaData || s.Versions || s.Macros || s.Actions || s.actions
  }).map(([name, value]) => ({ name, value }))
}

function normalizeSequence(name: string, sequence: unknown): GSESequence {
  const record = normalizeRecord(sequence)
  const metaData = normalizeRecord((record.MetaData || record.metaData || {}) as Record<string, unknown>)
  const profile = readClassInfo(metaData)
  const versions = normalizeVersions(record)
  const defaultVersion = readDefaultVersion(record, versions.length)
  if (!versions.length) throw new Error('The GSE export did not contain any macro blocks.')
  return {
    name: (metaData.Name || metaData.name || name) as string,
    description: (metaData.Help || metaData.help || '') as string,
    class: profile.class,
    classId: profile.classId,
    spec: profile.spec,
    specId: profile.specId,
    defaultVersion,
    metaData,
    versions,
    steps: versions[defaultVersion - 1]?.steps || versions[0]?.steps || [],
  }
}

function normalizeVersions(sequence: Record<string, unknown>): GSEVersion[] {
  const versionEntries = sequence.Versions || sequence.Macros || sequence.versions || sequence.macros
  let versions: GSEVersion[] = []
  if (versionEntries) {
    versions = Array.isArray(versionEntries)
      ? versionEntries.map((v, i) => normalizeVersion(v, i + 1))
      : Object.entries(versionEntries as Record<string, unknown>).sort(([a], [b]) => Number(a) - Number(b)).map(([, v], i) => normalizeVersion(v, i + 1))
  } else if (sequence.Actions || sequence.actions) {
    versions = [normalizeVersion(sequence, 1)]
  }
  return versions.filter(v => v.blocks.length > 0)
}

function normalizeVersion(version: unknown, index: number): GSEVersion {
  const record = normalizeRecord(version)
  const actions = record.Actions || record.actions || record
  const blocks = normalizeBlocks(actions)
  const flatSteps = flattenBlocks(blocks)
  return {
    index,
    name: (record.Label || record.label || record.Name || record.name || `Version ${index}`) as string,
    stepFunction: (record.StepFunction || record.stepFunction || '') as string,
    keyPress: String(record.KeyPress || record.keyPress || '').trim(),
    keyRelease: String(record.KeyRelease || record.keyRelease || '').trim(),
    blocks,
    steps: flatSteps.map((step, i) => ({
      number: i + 1, text: step.text, kind: step.kind, label: step.label,
      depth: step.depth, chars: step.text.length, limit: 255,
      preMarkers: step.label ? [step.label] : [], postMarkers: [],
    })),
  }
}

export function normalizeBlocks(container: unknown, depth = 0): GSEBlock[] {
  return getChildEntries(container).flatMap((entry, index) => {
    if (typeof entry.value === 'string') {
      const text = translateSpellTokens(entry.value.trim())
      if (!text) return []
      return [{ index: index + 1, kind: 'Action', depth, label: 'Action', text, children: [] }]
    }
    return [normalizeBlock(entry.value, index + 1, depth)]
  })
}

function normalizeBlock(block: unknown, index: number, depth: number): GSEBlock {
  if (typeof block === 'string') {
    return { index, kind: 'Action', depth, label: 'Action', text: translateSpellTokens(block.trim()), children: [] }
  }
  const record = normalizeRecord(block)
  const kind = resolveBlockKind(record)

  if (kind === 'Loop' || kind === 'If') {
    const children = normalizeBlocks(extractNestedContainer(record), depth + 1)
    return {
      index, kind, depth, label: buildBlockLabel(kind, record),
      stepFunction: (record.StepFunction || record.stepFunction || 'Sequential') as string,
      repeat: readNumber(record.Repeat, record.repeat) ?? undefined,
      variable: (record.Variable || record.variable || '') as string,
      children, text: '',
    }
  }
  if (kind === 'Repeat') {
    return {
      index, kind, depth, label: buildBlockLabel(kind, record),
      interval: readNumber(record.Interval, record.interval),
      text: translateSpellTokens(extractBlockText(record)), children: [],
    }
  }
  if (kind === 'Pause') {
    return {
      index, kind, depth, label: buildBlockLabel(kind, record),
      ms: (record.MS || record.ms || '') as string,
      clicks: readNumber(record.Clicks, record.clicks) ?? undefined,
      text: '', children: [],
    }
  }
  if (kind === 'Embed') {
    return {
      index, kind, depth, label: buildBlockLabel(kind, record),
      sequence: (record.Sequence || record.sequence || '') as string,
      text: '', children: [],
    }
  }
  return { index, kind: 'Action', depth, label: 'Action', text: translateSpellTokens(extractBlockText(record)), children: [] }
}

function flattenBlocks(blocks: GSEBlock[], output: GSEBlock[] = []): GSEBlock[] {
  for (const block of blocks) {
    output.push(block)
    if (block.children?.length) flattenBlocks(block.children, output)
  }
  return output
}

function extractBlockText(block: Record<string, unknown>): string {
  if (block.macro) return String(block.macro)
  if (block.spell) {
    const unit = block.unit ? `@${block.unit} ` : ''
    return `/cast ${unit}${translateSpellTokens(String(block.spell))}`.trim()
  }
  if (block.item) return `/use ${block.item}`
  const stackLines = getChildEntries(block).map(e => e.value).filter(v => typeof v === 'string' && (v as string).trim()).map(v => (v as string).trim())
  if (stackLines.length) return stackLines.join('\n')
  return Object.entries(block).filter(([k]) => !/^(type|Type|Interval|Repeat|StepFunction|Variable|Sequence|MS|Clicks|Disabled)$/i.test(k)).filter(([, v]) => typeof v === 'string' && (v as string).trim()).map(([, v]) => (v as string).trim()).join('\n')
}

function buildBlockLabel(kind: string, block: Record<string, unknown>): string {
  if (kind === 'Loop') {
    const parts = ['Loop']
    const sf = block.StepFunction || block.stepFunction
    const repeat = block.Repeat || block.repeat
    if (sf) parts.push(sf as string)
    if (repeat !== undefined && repeat !== null && repeat !== '') parts.push(`×${repeat}`)
    return parts.join(' · ')
  }
  if (kind === 'Repeat') { const interval = block.Interval || block.interval; return interval ? `Repeat · every ${interval}` : 'Repeat' }
  if (kind === 'Pause') {
    if (block.MS !== undefined && block.MS !== null && block.MS !== '') return String(block.MS) === 'GCD' ? 'Pause · GCD' : `Pause · ${block.MS}ms`
    if (block.Clicks || block.clicks) return `Pause · ${block.Clicks || block.clicks} clicks`
    return 'Pause'
  }
  if (kind === 'If') { const v = block.Variable || block.variable; return v ? `If · ${v}` : 'If' }
  if (kind === 'Embed') { const s = block.Sequence || block.sequence; return s ? `Embed · ${s}` : 'Embed' }
  return kind
}

function getChildEntries(container: unknown): Array<{ key: string; value: unknown }> {
  if (Array.isArray(container)) return container.filter(v => v !== undefined && v !== null).map((v, i) => ({ key: String(i + 1), value: v }))
  if (!container || typeof container !== 'object') return []
  return Object.entries(container as Record<string, unknown>).filter(([k]) => /^\d+$/.test(k)).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => ({ key: k, value: v }))
}

function extractNestedContainer(record: Record<string, unknown>): unknown {
  if (Array.isArray(record)) return record
  const nestedKeys = new Set(['Actions', 'actions', 'Type', 'type', 'Repeat', 'repeat', 'StepFunction', 'stepFunction', 'Interval', 'interval', 'Variable', 'variable', 'Sequence', 'sequence', 'MS', 'ms', 'Clicks', 'clicks', 'Disabled', 'disabled', 'Name', 'name'])
  const entries = Object.entries(record).filter(([k]) => /^\d+$/.test(k) || !nestedKeys.has(k))
  if (!entries.length) return record
  return Object.fromEntries(entries)
}

function resolveBlockKind(record: Record<string, unknown>): string {
  const blockType = String(record.Type || record.type || 'Action')
  const match = [...BLOCK_TYPES].find(t => t.toLowerCase() === blockType.toLowerCase())
  if (match) return match
  if (record.Interval || record.interval) return 'Repeat'
  if (record.Repeat !== undefined || record.repeat !== undefined || record.StepFunction || record.stepFunction) return 'Loop'
  if (record.Variable || record.variable) return 'If'
  if (record.Sequence || record.sequence) return 'Embed'
  if (record.MS !== undefined || record.ms !== undefined || record.Clicks || record.clicks) return 'Pause'
  return 'Action'
}

function decompressGSEPayload(compressed: Buffer): Buffer {
  const attempts = [() => inflateRawSync(compressed), () => inflateSync(compressed), () => unzipSync(compressed)]
  let lastError: unknown
  for (const attempt of attempts) { try { return attempt() } catch (e) { lastError = e } }
  throw lastError
}

function unwrapCborValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return value
  if (Array.isArray(value)) return value.map(item => unwrapCborValue(item, depth + 1))
  if (!value || typeof value !== 'object') return value
  if (Object.prototype.hasOwnProperty.call(value, 'tag') && Object.prototype.hasOwnProperty.call(value, 'value')) {
    const keys = Object.keys(value as object)
    if (keys.length <= 2 || (keys.length === 3 && keys.includes('tag') && keys.includes('value'))) {
      return unwrapCborValue((value as any).value, depth + 1)
    }
  }
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) result[k] = unwrapCborValue(v, depth + 1)
  return result
}

function readSequenceProfile(sequence: GSESequence | undefined): { class: string; classId: number | null; spec: string; specId: number | null; profileSource: string | null } {
  if (!sequence) return { class: '', classId: null, spec: '', specId: null, profileSource: null }
  return { ...readClassInfo(sequence.metaData || {}), profileSource: sequence.metaData ? 'exportMeta' : null }
}

function readClassInfo(record: Record<string, unknown>): { class: string; classId: number | null; spec: string; specId: number | null } {
  const source = normalizeRecord(record)
  const classId = readNumber(source.ClassID, source.classID, source.ClassId, source.classId)
  const specId = readNumber(source.SpecID, source.specID, source.SpecId, source.specId)
  const specInfo = specId ? SPEC_BY_ID[specId] : null
  const resolvedClassId = classId || (specInfo ? specInfo.classId : null)
  return {
    class: (source.Class || source.class || CLASS_BY_ID[resolvedClassId!] || '') as string,
    classId: resolvedClassId || null,
    spec: (source.Spec || source.spec || (specInfo ? specInfo.name : '')) as string,
    specId: specId || null,
  }
}

function readDefaultVersion(sequence: Record<string, unknown>, versionCount: number): number {
  const record = normalizeRecord(sequence)
  const metaData = normalizeRecord((record.MetaData || record.metaData || {}) as Record<string, unknown>)
  const value = readNumber(record.DefaultVersion, record.defaultVersion, metaData.Default, metaData.default)
  if (!value || value < 1 || value > versionCount) return 1
  return value
}

function readNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (v === undefined || v === null || v === '') continue
    const parsed = Number(v)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function encodeGSEExport(payload: unknown): string {
  const encoded = Buffer.from(encodeCbor(payload))
  const compressed = inflateRawSync(encoded)
  return `!GSE3!${compressed.toString('base64')}`
}
