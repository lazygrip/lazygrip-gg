// Credit: Beard3d_Gamer — talentExtract.js converted to TypeScript

const TALENT_LABEL_PATTERN = /(?:^|[\r\n])\s*(?:talent|talents|loadout|build)\s*[-:]\s*([A-Za-z0-9+/=]+)/i
const INLINE_TALENT_PATTERN = /(?:talent|talents|loadout|build)\s*[-:]\s*([A-Za-z0-9+/=]{20,})/i
const TALENT_TOKEN_PATTERN = /^[A-Za-z0-9+/=]+$/
const MIN_TALENT_LENGTH = 40

const BASE64_TO_VALUE: Record<string, number> = Object.fromEntries(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    .split('')
    .map((char, index) => [char, index])
)

const BITS_PER_CHAR = 6
const HEADER_VERSION_BITS = 8
const SPEC_ID_BITS = 16

class ImportDataStream {
  private values: number[]
  private index: number
  private extractedBits: number
  private remainingValue: number

  constructor(exportString: string) {
    this.values = [...String(exportString || '').trim()].map(char => BASE64_TO_VALUE[char])
    if (!this.values.length || this.values.some(v => v === undefined)) {
      throw new Error('Invalid talent import string.')
    }
    this.index = 0
    this.extractedBits = 0
    this.remainingValue = this.values[0]
  }

  extractValue(bitWidth: number): number | null {
    let value = 0
    let bitsNeeded = bitWidth
    let extractedBits = 0

    while (bitsNeeded > 0) {
      if (this.index >= this.values.length) return null
      const remainingBits = BITS_PER_CHAR - this.extractedBits
      const bitsToExtract = Math.min(remainingBits, bitsNeeded)
      this.extractedBits += bitsToExtract
      const maxStorableValue = 1 << bitsToExtract
      const remainder = this.remainingValue % maxStorableValue
      this.remainingValue = Math.floor(this.remainingValue / maxStorableValue)
      value += remainder << extractedBits
      extractedBits += bitsToExtract
      bitsNeeded -= bitsToExtract
      if (bitsToExtract < remainingBits) break
      this.index += 1
      this.extractedBits = 0
      this.remainingValue = this.values[this.index]
    }

    return value
  }
}

export function parseTalentImportHeader(talentString: string | null | undefined): { serializationVersion: number; specId: number } | null {
  try {
    if (!talentString) return null
    const stream = new ImportDataStream(talentString)
    const headerBits = HEADER_VERSION_BITS + SPEC_ID_BITS + 128
    if (stream['values'].length * BITS_PER_CHAR < headerBits) return null
    const serializationVersion = stream.extractValue(HEADER_VERSION_BITS)
    const specId = stream.extractValue(SPEC_ID_BITS)
    for (let i = 0; i < 16; i++) stream.extractValue(8)
    if (!serializationVersion || !specId) return null
    return { serializationVersion, specId }
  } catch {
    return null
  }
}

export function extractTalentStringFromText(text: string | null | undefined): string | null {
  const cleaned = String(text || '').trim()
  if (!cleaned) return null
  const labeledMatch = cleaned.match(TALENT_LABEL_PATTERN) || cleaned.match(INLINE_TALENT_PATTERN)
  if (labeledMatch) return normalizeTalentToken(labeledMatch[1])
  for (const line of cleaned.split(/\r?\n/)) {
    const token = normalizeTalentToken(line)
    if (isLikelyTalentString(token)) return token
  }
  return null
}

export function findTalentStringInComments(
  exportMeta: Record<string, unknown> | null | undefined,
  sequences: Array<{ description?: string }>
): string | null {
  const sources = [
    exportMeta?.description as string | undefined,
    ...sequences.map(s => s.description),
  ]
  for (const source of sources) {
    const extracted = extractTalentStringFromText(source)
    if (extracted) return extracted
  }
  return null
}

function normalizeTalentToken(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[.,;)\]}>]+$/g, '')
}

export function isLikelyTalentString(value: string): boolean {
  if (!value || value.length < MIN_TALENT_LENGTH) return false
  if (!TALENT_TOKEN_PATTERN.test(value)) return false
  if (/^https?:\/\//i.test(value)) return false
  return /[+/=]/.test(value) || value.length >= 80
}

function escapeRegex(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stripTalentFromText(text: string, talentString: string): string {
  const cleaned = String(text || '')
  const token = normalizeTalentToken(talentString)
  if (!cleaned.trim() || !token) return cleaned
  const escaped = escapeRegex(token)
  let result = cleaned
  result = result.replace(new RegExp(`(?:^|[\\r\\n])\\s*(?:talent|talents|loadout|build)\\s*[-:]\\s*${escaped}\\s*`, 'gi'), '\n')
  result = result.replace(new RegExp(`(?:talent|talents|loadout|build)\\s*[-:]\\s*${escaped}`, 'gi'), '')
  result = result.replace(new RegExp(`^\\s*${escaped}\\s*$`, 'gm'), '')
  return result.replace(/\n{3,}/g, '\n\n').trim()
}
