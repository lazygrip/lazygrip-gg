// Credit: Beard3d_Gamer — spell catalog, token translation, spell ID formatting

import { readFileSync } from 'fs'
import { join } from 'path'

interface CatalogEntry { id: number; name: string }

let cachedCatalog: Map<number, string> | null = null
let cachedNameIndex: Map<string, number> | null = null
let cachedAllSpells: CatalogEntry[] | null = null
let cachedByClass: Map<string, CatalogEntry[]> | null = null
let cachedSpellCount = 0

function buildCatalog(): { catalog: Map<number, string>; byClass: Record<string, Record<string, string>> } {
  const catalog = new Map<number, string>()
  let byClass: Record<string, Record<string, string>> = {}
  try {
    const jsonPath = join(process.cwd(), 'src', 'lib', 'data', 'spell-catalog.json')
    try {
      const raw = JSON.parse(readFileSync(jsonPath, 'utf8'))
      for (const [id, name] of Object.entries(raw.spells || {})) {
        catalog.set(Number(id), String(name))
      }
      if (raw.byClass) byClass = raw.byClass
      return { catalog, byClass }
    } catch { /* fall through to Lua */ }

    const luaPath = join(process.cwd(), 'src', 'lib', 'data', 'CrossClassSpellCatalog.lua')
    const text = readFileSync(luaPath, 'utf8')
    const blocks = text.match(/\{\s*id\s*=\s*\d+[\s\S]*?\}/g) || []
    for (const block of blocks) {
      const idMatch = block.match(/id\s*=\s*(\d+)/)
      const nameMatch = block.match(/n\s*=\s*"((?:\\"|[^"])*)"/)
      if (!idMatch || !nameMatch) continue
      const id = Number(idMatch[1])
      const name = nameMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      catalog.set(id, name)
      const primaryClass = block.match(/c\s*=\s*"([^"]+)"/)
      const classes = new Set<string>()
      if (primaryClass) classes.add(primaryClass[1].toLowerCase())
      const extraClasses = block.match(/cs\s*=\s*\{([\s\S]*?)\}/)
      if (extraClasses) {
        for (const m of extraClasses[1].matchAll(/"([^"]+)"/g)) classes.add(m[1].toLowerCase())
      }
      for (const cls of classes) {
        if (!byClass[cls]) byClass[cls] = {}
        byClass[cls][String(id)] = name
      }
    }
  } catch { /* non-fatal */ }
  return { catalog, byClass }
}

function ensureCatalog(): Map<number, string> {
  if (cachedCatalog) return cachedCatalog
  const { catalog, byClass } = buildCatalog()
  cachedCatalog = catalog
  cachedSpellCount = catalog.size
  cachedAllSpells = [...catalog.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  cachedByClass = new Map()
  for (const [cls, spells] of Object.entries(byClass)) {
    const entries = Object.entries(spells)
      .map(([id, name]) => ({ id: Number(id), name: String(name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    cachedByClass.set(cls, entries)
  }
  return cachedCatalog
}

function ensureNameIndex(): Map<string, number> {
  if (cachedNameIndex) return cachedNameIndex
  cachedNameIndex = new Map()
  for (const [id, name] of ensureCatalog()) {
    cachedNameIndex.set(name.toLowerCase(), id)
  }
  return cachedNameIndex
}

export function getSpellName(spellId: number): string | null {
  return ensureCatalog().get(Number(spellId)) || null
}

export function getSpellIdByName(spellName: string): number | null {
  const name = String(spellName || '').trim()
  if (!name) return null
  return ensureNameIndex().get(name.toLowerCase()) || null
}

export function getCatalogInfo(): { version: null; source: string; spellCount: number; byClass: null } {
  ensureCatalog()
  return { version: null, source: 'spell-catalog', spellCount: cachedSpellCount, byClass: null }
}

const CLASS_ID_TO_KEY: Record<number, string> = {
  1: 'warrior', 2: 'paladin', 3: 'hunter', 4: 'rogue', 5: 'priest',
  6: 'deathknight', 7: 'shaman', 8: 'mage', 9: 'warlock', 10: 'monk',
  11: 'druid', 12: 'demonhunter', 13: 'evoker',
}

export function searchSpells({ query, classId = 0, limit = 12 }: { query: string; classId?: number; limit?: number }): CatalogEntry[] {
  ensureCatalog()
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (normalizedQuery.length < 2) return []
  const maxResults = Math.min(Math.max(Number(limit) || 12, 1), 30)
  const classKey = CLASS_ID_TO_KEY[Number(classId)]
  const pool = classKey && cachedByClass?.has(classKey)
    ? cachedByClass.get(classKey)!
    : cachedAllSpells || []
  const results: CatalogEntry[] = []
  for (const spell of pool) {
    if (!spell.name.toLowerCase().includes(normalizedQuery)) continue
    results.push(spell)
    if (results.length >= maxResults) break
  }
  return results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(normalizedQuery)
    const bStarts = b.name.toLowerCase().startsWith(normalizedQuery)
    if (aStarts !== bStarts) return aStarts ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function isInventorySlotNumber(value: string | number): boolean {
  if (!/^\d+$/.test(String(value ?? '').trim())) return false
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 19
}

function consumeConditions(value: string): { conditions: string; spellPart: string } {
  let remainder = String(value || '').trimStart()
  const conditions: string[] = []
  while (remainder.startsWith('[')) {
    let depth = 0
    let closingIndex = -1
    for (let i = 0; i < remainder.length; i++) {
      if (remainder[i] === '[') depth++
      else if (remainder[i] === ']') { depth--; if (depth === 0) { closingIndex = i; break } }
    }
    if (closingIndex === -1) break
    conditions.push(remainder.slice(0, closingIndex + 1))
    remainder = remainder.slice(closingIndex + 1).trimStart()
  }
  return { conditions: conditions.join(''), spellPart: remainder.trim() }
}

function formatSpellReference(spellRef: string, options: {
  tagForExport?: boolean; allowNumericResolution?: boolean; bareIds?: boolean; isUseCommand?: boolean
}): string {
  const value = String(spellRef || '').trim()
  if (!value) return value
  const { tagForExport = false, allowNumericResolution = false, bareIds = false, isUseCommand = false } = options

  if (isUseCommand && isInventorySlotNumber(value)) return value

  const tokenMatch = value.match(/^\{spell:(\d+)\}$/i)
  if (tokenMatch) {
    const numericId = Number(tokenMatch[1])
    if (isUseCommand && isInventorySlotNumber(numericId)) return String(numericId)
    if (tagForExport) return bareIds ? String(numericId) : `{spell:${numericId}}`
    return getSpellName(numericId) || value
  }

  if (/^\d+$/.test(value)) {
    const numericId = Number(value)
    if (isUseCommand && isInventorySlotNumber(numericId)) return String(numericId)
    if (tagForExport) return bareIds ? String(numericId) : `{spell:${numericId}}`
    if (allowNumericResolution) return getSpellName(numericId) || value
    return value
  }

  if (tagForExport) {
    const spellId = getSpellIdByName(value)
    if (spellId) return bareIds ? String(spellId) : `{spell:${spellId}}`
  }

  return value
}

function resolveCastLine(line: string, options: { tagForExport?: boolean; bareIds?: boolean }): string {
  const match = line.match(/^(\/\S+\s+)([\s\S]*)$/)
  if (!match) return line
  const [, command, rest] = match
  const isUseCommand = command.trim().toLowerCase() === '/use'
  const { conditions, spellPart } = consumeConditions(rest)
  if (!spellPart) return line
  const resolvedSegments = spellPart.split(';').map(segment => {
    const trimmed = segment.trim()
    if (!trimmed) return trimmed
    const { conditions: segCond, spellPart: segSpell } = consumeConditions(trimmed)
    const formatted = formatSpellReference(segSpell, {
      tagForExport: options.tagForExport, allowNumericResolution: !isUseCommand,
      bareIds: options.bareIds, isUseCommand,
    })
    return segCond ? `${segCond} ${formatted}`.trim() : formatted
  })
  const joined = resolvedSegments.join('; ')
  return conditions ? `${command}${conditions} ${joined}` : `${command}${joined}`
}

function resolveCastSequenceLine(line: string, options: { tagForExport?: boolean; bareIds?: boolean }): string {
  const match = line.match(/^(\/castsequence\s*)([\s\S]*)$/i)
  if (!match) return line
  const [, command, rest] = match
  const trimmedRest = String(rest || '').trimStart()
  if (!trimmedRest) return line
  const { conditions, spellPart: spellList } = consumeConditions(trimmedRest)
  let prefix = command
  if (conditions) prefix += `${conditions} `
  if (!spellList) return line
  let workingSpellList = spellList
  const resetMatch = workingSpellList.match(/^(reset=\S+\s+)([\s\S]*)$/i)
  if (resetMatch) { prefix += resetMatch[1]; workingSpellList = resetMatch[2] }
  const resolvedEntries = workingSpellList.split(',').map(entry => {
    const trimmed = entry.trim()
    if (!trimmed || trimmed.toLowerCase() === 'null') return trimmed
    return formatSpellReference(trimmed, { tagForExport: options.tagForExport, allowNumericResolution: true, bareIds: options.bareIds })
  })
  return `${prefix}${resolvedEntries.join(', ')}`
}

function processLine(line: string, options: { tagForExport?: boolean; bareIds?: boolean }): string {
  const lower = line.toLowerCase()
  if ((lower.startsWith('/cast ') || lower.startsWith('/use ')) && !lower.startsWith('/castsequence')) {
    return resolveCastLine(line, options)
  }
  if (lower.startsWith('/castsequence')) return resolveCastSequenceLine(line, options)
  if (options.tagForExport) return line
  return line.replace(/\{spell:(\d+)\}/gi, (token, idStr) => getSpellName(Number(idStr)) || token)
}

export function translateSpellTokens(text: string): string {
  if (!text || !ensureCatalog().size) return text
  return text.split(/\r?\n/).map(line => processLine(line, { tagForExport: false })).join('\n')
}

export function formatMacroForGripExport(text: string): string {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => processLine(line.trim(), { tagForExport: true }))
    .filter(Boolean)
    .join('\n')
}

export function formatMacroToBareSpellIds(text: string): string {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => processLine(line.trim(), { tagForExport: true, bareIds: true }))
    .filter(Boolean)
    .join('\n')
}
