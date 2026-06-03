import { inflateRawSync } from 'zlib'
import type { SequenceStep } from '@/types'

// Passthrough stub - spell token translation is not needed for LazyGrip display.
// Beard3d_Gamer's original decoder translates spell IDs to names via spellCatalog;
// we skip that and preserve the raw macro text as-is.
function translateSpellTokens(text: string): string {
  return text
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawStep {
  text: string
  charText?: string
  preMarkers: string[]
  postMarkers: string[]
  chars: number
  limit: number
  source: unknown
}

interface NormalizedVersion {
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
  steps: RawStep[]
  source: Record<string, unknown>
}

interface NormalizedSequence {
  name: string
  description: string
  class: string
  spec: string
  defaultVersion: number
  versions: NormalizedVersion[]
  steps: RawStep[]
}

interface DecodedExport {
  meta: {
    format: string
    version: unknown
    locale: unknown
    checksum: unknown
  }
  sequences: NormalizedSequence[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decodes a GRIP/EMS export string and returns the decoded export including
 * all sequences. Throws on malformed input.
 */
export function decodeEMSExport(input: string): DecodedExport {
  const cleaned = String(input || '').trim().replace(/\s+/g, '')

  if (!cleaned) {
    throw new Error('Paste a GRIP EMS export code first.')
  }

  const PREFIX = /^!(EMS1|GRIP1)!/i
  if (!PREFIX.test(cleaned)) {
    throw new Error('Expected an export code beginning with !EMS1! or !GRIP1!.')
  }

  const payload = cleaned.replace(PREFIX, '')
  const compressed = Buffer.from(payload, 'base64')

  if (!compressed.length) {
    throw new Error('The export payload is empty or not valid Base64.')
  }

  let inflated: Buffer
  try {
    inflated = inflateRawSync(compressed)
  } catch {
    throw new Error('The export payload could not be inflated as GRIP EMS data.')
  }

  const decoded = new CborReader(inflated).decode() as Record<string, unknown>
  const sequences = normalizeSequences(decoded)

  return {
    meta: {
      format: (decoded.format as string) || 'Unknown',
      version: decoded.version ?? null,
      locale: decoded.locale ?? null,
      checksum: decoded.checksum ?? null,
    },
    sequences,
  }
}

/**
 * Decodes a GRIP/EMS export string and returns LazyGrip SequenceStep arrays
 * for each sequence found. Markers are folded inline into step text.
 *
 * When one sequence is present, returns a single-element array.
 * When multiple sequences are present, returns one entry per sequence so the
 * caller can present a picker to the author.
 */
export function decodeGripString(input: string): {
  sequences: Array<{ name: string; steps: SequenceStep[] }>
} {
  const result = decodeEMSExport(input)

  const sequences = result.sequences.map((seq) => ({
    name: seq.name,
    steps: rawStepsToSequenceSteps(seq.steps),
  }))

  if (sequences.length === 0) {
    throw new Error('No sequences with steps were found in this export string.')
  }

  return { sequences }
}

// ---------------------------------------------------------------------------
// Step conversion: RawStep[] -> SequenceStep[]
// ---------------------------------------------------------------------------

function rawStepsToSequenceSteps(rawSteps: RawStep[]): SequenceStep[] {
  return rawSteps.map((raw, i) => {
    const parts: string[] = []

    if (raw.preMarkers && raw.preMarkers.length > 0) {
      parts.push(raw.preMarkers.join(' '))
    }

    if (raw.text) {
      parts.push(raw.text)
    }

    if (raw.postMarkers && raw.postMarkers.length > 0) {
      parts.push(raw.postMarkers.join(' '))
    }

    const text = parts.join(' ').trim()

    return {
      index: i,
      text,
      char_count: Buffer.byteLength(text, 'utf8'),
    }
  })
}

// ---------------------------------------------------------------------------
// Sequence normalization (ported from Beard3d_Gamer's emsDecoder.js)
// All credit for the decode logic to Beard3d_Gamer.
// ---------------------------------------------------------------------------

function normalizeSequences(decoded: Record<string, unknown>): NormalizedSequence[] {
  const entries = findSequenceEntries(decoded)

  return entries
    .map((entry, index) => {
      const sequence = normalizeRecord(entry.value)
      const versions = normalizeVersions(sequence)
      const defaultVersion = readDefaultVersion(sequence, versions.length)
      const fallbackSteps = extractSteps(sequence, versions.map((v) => v.source))
      const activeVersion =
        versions[defaultVersion - 1] || versions.find((v) => v.steps.length > 0)
      const steps = activeVersion ? activeVersion.steps : fallbackSteps

      return {
        name:
          entry.name ||
          (sequence.name as string) ||
          (sequence.Name as string) ||
          (sequence.title as string) ||
          (sequence.Title as string) ||
          `Sequence ${index + 1}`,
        description:
          (sequence.description as string) || (sequence.Description as string) || '',
        class: (sequence.class as string) || (sequence.Class as string) || '',
        spec: (sequence.spec as string) || (sequence.Spec as string) || '',
        defaultVersion,
        versions,
        steps,
      }
    })
    .filter((seq) => seq.steps.length > 0 || seq.versions.length > 0)
}

function findSequenceEntries(
  decoded: Record<string, unknown>
): Array<{ name: string; value: unknown }> {
  if (decoded.type === 'COLLECTION') {
    return entriesFromSequenceValue(
      (decoded.sequences || decoded.Sequences) as unknown
    )
  }

  if (decoded.sequence || decoded.Sequence) {
    return [
      {
        name: (decoded.name as string) || (decoded.Name as string) || '',
        value: decoded.sequence || decoded.Sequence,
      },
    ]
  }

  return entriesFromSequenceValue((decoded.sequences || decoded.Sequences) as unknown)
}

function entriesFromSequenceValue(
  value: unknown
): Array<{ name: string; value: unknown }> {
  if (Array.isArray(value)) {
    return value.map((seq, index) => {
      const record = normalizeRecord(seq)
      return {
        name:
          (record.name as string) ||
          (record.Name as string) ||
          (record.title as string) ||
          (record.Title as string) ||
          `Sequence ${index + 1}`,
        value: seq,
      }
    })
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([name, seq]) => ({
      name,
      value: seq,
    }))
  }

  return []
}

function normalizeVersions(sequence: Record<string, unknown>): NormalizedVersion[] {
  const entries = findVersionEntries(sequence)
  const versions = entries
    .map((entry, index) => {
      const version = normalizeRecord(entry.value)
      const steps = stepsFromActions(
        (version.actions || version.Actions) as unknown[]
      )
      const fallbackSteps = steps.length ? steps : stepsFromRecord(version)
      const keyName =
        entry.key && !/^\d+$/.test(String(entry.key)) ? entry.key : ''

      return {
        index: index + 1,
        name:
          (version.name as string) ||
          (version.Name as string) ||
          (version.label as string) ||
          (version.Label as string) ||
          keyName ||
          `Version ${index + 1}`,
        stepFunction:
          (version.stepFunction as string) ||
          (version.StepFunction as string) ||
          '',
        keyPress:
          (version.keyPress as string) || (version.KeyPress as string) || '',
        keyRelease:
          (version.keyRelease as string) || (version.KeyRelease as string) || '',
        resetOnCombat: Boolean(version.resetOnCombat || version.Combat),
        resetOnTarget: Boolean(version.resetOnTarget || version.Head),
        resetOnGear: Boolean(version.resetOnGear),
        resetOnSpec: Boolean(version.resetOnSpec),
        resetTimer: (version.resetTimer as number) || (version.Timer as number) || 0,
        steps: fallbackSteps,
        source: version,
      }
    })
    .filter((v) => v.steps.length > 0)

  if (versions.length) return versions

  const steps = stepsFromRecord(sequence)
  return steps.length
    ? [
        {
          index: 1,
          name: 'Version 1',
          stepFunction:
            (sequence.stepFunction as string) ||
            (sequence.StepFunction as string) ||
            '',
          keyPress:
            (sequence.keyPress as string) || (sequence.KeyPress as string) || '',
          keyRelease:
            (sequence.keyRelease as string) ||
            (sequence.KeyRelease as string) ||
            '',
          resetOnCombat: Boolean(sequence.resetOnCombat || sequence.Combat),
          resetOnTarget: Boolean(sequence.resetOnTarget || sequence.Head),
          resetOnGear: Boolean(sequence.resetOnGear),
          resetOnSpec: Boolean(sequence.resetOnSpec),
          resetTimer:
            (sequence.resetTimer as number) || (sequence.Timer as number) || 0,
          steps,
          source: sequence,
        },
      ]
    : []
}

function findVersionEntries(
  sequence: Record<string, unknown>
): Array<{ key: string; value: unknown }> {
  const candidates = [
    sequence.versions,
    sequence.Versions,
    sequence.versionData,
    sequence.VersionData,
    sequence.sequenceVersions,
    sequence.SequenceVersions,
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((v, i) => ({ key: String(i + 1), value: v }))
    }
    if (candidate && typeof candidate === 'object') {
      return Object.entries(candidate as Record<string, unknown>).map(
        ([key, v]) => ({ key, value: v })
      )
    }
  }

  return []
}

function readDefaultVersion(
  sequence: Record<string, unknown>,
  versionCount: number
): number {
  const raw = Number(
    sequence.defaultVersion ||
      sequence.DefaultVersion ||
      sequence.default ||
      sequence.Default ||
      1
  )
  if (!Number.isFinite(raw) || raw < 1) return 1
  if (versionCount > 0 && raw > versionCount) return 1
  return Math.floor(raw)
}

function extractSteps(
  sequence: Record<string, unknown>,
  versions: Record<string, unknown>[]
): RawStep[] {
  for (const version of versions) {
    const steps = stepsFromActions(
      (version.actions || version.Actions) as unknown[]
    )
    if (steps.length) return steps
  }
  return stepsFromRecord(sequence)
}

function stepsFromActions(actions: unknown[]): RawStep[] {
  if (!Array.isArray(actions) || actions.length === 0) return []
  const flattened: RawStep[] = []
  flattenActions(actions, flattened)
  return flattened.map((step, index) => ({
    number: index + 1,
    text: step.text,
    preMarkers: step.preMarkers || [],
    postMarkers: step.postMarkers || [],
    chars: stepCharCount(step),
    limit: 255,
    source: step.source || null,
  }))
}

function stepCharCount(step: RawStep): number {
  const markers = [...(step.preMarkers || []), ...(step.postMarkers || [])]
  const markerText = markers.join('')
  const markerSeparators = markers.length
  return (
    Buffer.byteLength(
      (step.charText || step.text || '') + markerText,
      'utf8'
    ) + markerSeparators
  )
}

interface RawStepInternal {
  text: string
  charText?: string
  preMarkers?: string[]
  postMarkers?: string[]
  source?: unknown
}

function flattenActions(actions: unknown[], output: RawStepInternal[]): void {
  for (const action of actions) {
    const node = normalizeRecord(action)
    const type = String(node.type || node.Type || '').toLowerCase()

    if (type === 'action') {
      appendMacroSteps(
        output,
        (node.macro || node.Macro || '') as string,
        node
      )
      continue
    }

    if (type === 'loop') {
      const stepFunction = node.stepFunction || node.StepFunction || 'Sequential'
      const label = `(/Loop-${stepFunction}-Start)`
      const endLabel = `(/Loop-${stepFunction}-End)`
      const before = output.length
      const children = Array.isArray(node.children) ? node.children : []
      let attachedStart = false

      if (output[output.length - 1]) {
        output[output.length - 1].postMarkers =
          output[output.length - 1].postMarkers || []
        output[output.length - 1].postMarkers!.push(label)
        attachedStart = true
      }

      flattenActions(children, output)

      if (output.length > before) {
        if (!attachedStart && output[before]) {
          output[before].preMarkers = output[before].preMarkers || []
          output[before].preMarkers!.push(label)
        }
        output[output.length - 1].postMarkers =
          output[output.length - 1].postMarkers || []
        output[output.length - 1].postMarkers!.push(endLabel)
      }
      continue
    }

    if (type === 'if') {
      const condition =
        (node.variable as string) ||
        (node.Variable as string) ||
        (node.condition as string) ||
        (node.Condition as string) ||
        ''
      appendMarker(output, `(/If ${condition})`)
      const children = Array.isArray(node.children) ? node.children : []
      for (const branch of children) {
        if (Array.isArray(branch)) flattenActions(branch, output)
      }
      appendMarker(output, '(/EndIf)')
      continue
    }

    if (type === 'pause') {
      const text = node.ms
        ? `/pause ${node.ms}ms`
        : node.gcd
        ? `/pause ${node.gcd} gcd`
        : `/pause ${node.clicks || 1} clicks`
      appendMacroSteps(output, text, node)
      continue
    }

    if (type === 'embed') {
      appendMacroSteps(
        output,
        `/embed ${(node.sequence as string) || (node.Sequence as string) || ''}`.trim(),
        node
      )
    }
  }
}

function appendMacroSteps(
  output: RawStepInternal[],
  macro: string,
  source: unknown
): void {
  const block = String(macro || '').replace(/\r\n/g, '\n').trimEnd()
  if (!block.trim()) return

  // Each action in GRIP is a multi-line macro block that constitutes a single
  // step. We preserve the full block as one entry rather than splitting on
  // newlines, because GRIP stores and executes each action as a unit and that
  // is what users expect to see when reading steps on LazyGrip.
  const translated = translateSpellTokens(block)
  output.push({
    text: translated,
    charText: translated,
    source,
  })
}

function appendMarker(output: RawStepInternal[], marker: string): void {
  if (output[output.length - 1]) {
    output[output.length - 1].postMarkers =
      output[output.length - 1].postMarkers || []
    output[output.length - 1].postMarkers!.push(marker)
  }
}

function stepsFromRecord(record: Record<string, unknown>): RawStep[] {
  const normalized = normalizeRecord(record)
  const candidates = [
    normalized.steps,
    normalized.Steps,
    normalized.actions,
    normalized.Actions,
    normalized.macroSteps,
    normalized.MacroSteps,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const steps = normalizeStepList(candidate)
    if (steps.length) return steps
  }
  return []
}

function normalizeStepList(value: unknown): RawStep[] {
  if (Array.isArray(value)) {
    return value
      .map((step, index) => normalizeStep(step, index))
      .filter((s) => s.text || (s.postMarkers && s.postMarkers.length > 0))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, step], index) => normalizeStep(step, index))
      .filter((s) => s.text || (s.postMarkers && s.postMarkers.length > 0))
  }
  return []
}

function normalizeStep(step: unknown, index: number): RawStep {
  if (typeof step === 'string') return buildStep(index, step, null, null)
  if (!step || typeof step !== 'object') return buildStep(index, '', null, null)

  const record = normalizeRecord(step)
  const text = firstString(record, [
    'macrotext',
    'macroText',
    'MacroText',
    'text',
    'Text',
    'body',
    'Body',
    'value',
    'Value',
    'line',
    'Line',
  ])
  const marker = firstString(record, [
    'marker',
    'Marker',
    'label',
    'Label',
    'comment',
    'Comment',
  ])
  return buildStep(index, text, marker, record)
}

function buildStep(
  index: number,
  text: string,
  marker: string | null,
  source: unknown
): RawStep {
  const macro = translateSpellTokens(text)
  const resolvedMarker =
    marker && /^\(\/.+\)$/.test(marker) ? marker : null

  return {
    text: macro,
    preMarkers: [],
    postMarkers: resolvedMarker ? [resolvedMarker] : [],
    chars: Buffer.byteLength(macro, 'utf8'),
    limit: 255,
    source,
  }
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (typeof record[key] === 'string') return record[key] as string
  }
  return ''
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return arrayToRecord(value)
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function arrayToRecord(value: unknown[]): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  for (const item of value) {
    if (
      Array.isArray(item) &&
      item.length >= 2 &&
      typeof item[0] === 'string'
    ) {
      record[item[0]] = item[1]
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.assign(record, item)
    }
  }
  return record
}

// ---------------------------------------------------------------------------
// CBOR reader (ported from Beard3d_Gamer's emsDecoder.js)
// All credit for the decode logic to Beard3d_Gamer.
// ---------------------------------------------------------------------------

class CborReader {
  private buffer: Buffer
  private offset: number

  constructor(buffer: Buffer) {
    this.buffer = buffer
    this.offset = 0
  }

  decode(): unknown {
    const value = decodeLuaStrings(this.readValue())
    if (this.offset !== this.buffer.length) {
      throw new Error('The decoded CBOR payload has trailing data.')
    }
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
    if (additional === 31) {
      const result: unknown[] = []
      while (!this.nextIsBreak()) result.push(this.readValue())
      this.offset += 1
      return result
    }
    const length = this.readLength(additional)
    const result: unknown[] = []
    for (let i = 0; i < length; i += 1) result.push(this.readValue())
    return result
  }

  private readMap(additional: number): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    if (additional === 31) {
      while (!this.nextIsBreak()) {
        result[String(this.readValue())] = this.readValue()
      }
      this.offset += 1
      return result
    }
    const length = this.readLength(additional)
    for (let i = 0; i < length; i += 1) {
      result[String(this.readValue())] = this.readValue()
    }
    return result
  }

  private readBytes(additional: number): Buffer {
    if (additional === 31) {
      const chunks: Buffer[] = []
      while (!this.nextIsBreak()) chunks.push(this.readValue() as Buffer)
      this.offset += 1
      return Buffer.concat(chunks)
    }
    const length = this.readLength(additional)
    this.require(length)
    const bytes = this.buffer.subarray(this.offset, this.offset + length)
    this.offset += length
    return bytes
  }

  private readString(additional: number): string {
    if (additional === 31) {
      let value = ''
      while (!this.nextIsBreak()) value += this.readValue()
      this.offset += 1
      return value
    }
    const length = this.readLength(additional)
    this.require(length)
    const value = this.buffer.toString('utf8', this.offset, this.offset + length)
    this.offset += length
    return value
  }

  private readSimple(additional: number): unknown {
    if (additional === 20) return false
    if (additional === 21) return true
    if (additional === 22) return null
    if (additional === 23) return undefined
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
    if (additional === 25) {
      this.require(2)
      const value = this.buffer.readUInt16BE(this.offset)
      this.offset += 2
      return value
    }
    if (additional === 26) {
      this.require(4)
      const value = this.buffer.readUInt32BE(this.offset)
      this.offset += 4
      return value
    }
    if (additional === 27) {
      this.require(8)
      const value = this.buffer.readBigUInt64BE(this.offset)
      this.offset += 8
      return value <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(value)
        : Number(value)
    }
    throw new Error(`Unsupported CBOR length marker ${additional}.`)
  }

  private readUInt8(): number {
    this.require(1)
    const value = this.buffer[this.offset]
    this.offset += 1
    return value
  }

  private readFloat16(): number {
    const half = this.readLength(25)
    const exponent = (half & 0x7c00) >> 10
    const fraction = half & 0x03ff
    const sign = half & 0x8000 ? -1 : 1
    if (exponent === 0) return sign * 2 ** -14 * (fraction / 2 ** 10)
    if (exponent === 31) return fraction ? NaN : sign * Infinity
    return sign * 2 ** (exponent - 15) * (1 + fraction / 2 ** 10)
  }

  private readFloat32(): number {
    this.require(4)
    const value = this.buffer.readFloatBE(this.offset)
    this.offset += 4
    return value
  }

  private readFloat64(): number {
    this.require(8)
    const value = this.buffer.readDoubleBE(this.offset)
    this.offset += 8
    return value
  }

  private nextIsBreak(): boolean {
    this.require(1)
    return this.buffer[this.offset] === 0xff
  }

  private require(length: number): void {
    if (this.offset + length > this.buffer.length) {
      throw new Error('The decoded CBOR payload ended unexpectedly.')
    }
  }
}

function decodeLuaStrings(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  if (Array.isArray(value)) return value.map(decodeLuaStrings)
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>
    )) {
      result[key] = decodeLuaStrings(child)
    }
    return result
  }
  return value
}
