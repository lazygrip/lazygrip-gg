// Credit: Beard3d_Gamer — spell token translation, wired to LazyGrip's CrossClassSpellCatalog.lua
// rather than a separate JSON build step.

import { readFileSync } from 'fs'
import { join } from 'path'

function buildCatalog(): Map<number, string> {
  const catalog = new Map<number, string>()
  try {
    const luaPath = join(process.cwd(), 'src', 'lib', 'data', 'CrossClassSpellCatalog.lua')
    const text = readFileSync(luaPath, 'utf8')
    const pattern = /id\s*=\s*(\d+),\s*\n?\s*n\s*=\s*"([^"]+)"/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      catalog.set(parseInt(match[1], 10), match[2])
    }
  } catch {
    // Non-fatal: spell IDs pass through as-is if catalog unavailable.
  }
  return catalog
}

const SPELL_CATALOG = buildCatalog()

export function translateSpellTokens(text: string): string {
  if (!text || SPELL_CATALOG.size === 0) return text

  // Pass 1: /castsequence -- resolve digit-only comma tokens
  text = text.replace(
    /(\/castsequence)(\s*(?:\[[^\]]*\]\s*)?)([^\n]+)/g,
    (_: string, keyword: string, cond: string, rest: string) => {
      const resolved = rest.split(',').map(t => {
        const trimmed = t.trim()
        if (/^\d+$/.test(trimmed)) return SPELL_CATALOG.get(parseInt(trimmed, 10)) ?? trimmed
        return trimmed
      }).join(', ')
      return keyword + cond + resolved
    }
  )

  // Pass 2: /cast with single ID after optional conditionals
  text = text.replace(
    /(\/cast\s*(?:\[[^\]]*\]\s*)?)(\d+)/g,
    (_: string, prefix: string, idStr: string) => {
      const name = SPELL_CATALOG.get(parseInt(idStr, 10))
      return name ? `${prefix}${name}` : `${prefix}${idStr}`
    }
  )

  // Pass 3: {spell:N} tokens (GRIP's internal format)
  text = text.replace(/\{spell:(\d+)\}/g, (_: string, idStr: string) => {
    return SPELL_CATALOG.get(parseInt(idStr, 10)) ?? `{spell:${idStr}}`
  })

  return text
}

export function formatMacroForGripExport(text: string): string {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}
