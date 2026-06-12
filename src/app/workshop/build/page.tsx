'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, Plus, Trash2, ChevronUp, ChevronDown, Copy as CopyIcon, RotateCcw, GripVertical } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

// ─── Types ───────────────────────────────────────────────────────────────────

type StepFunction = 'Sequential' | 'Priority' | 'ReversePriority' | 'Random'

interface BuilderAction {
  id: string
  type: 'action' | 'loop' | 'pause' | 'if' | 'embed'
  macro?: string
  disabled?: boolean
  interval?: number
  name?: string
  label?: string
  children?: BuilderAction[]
  repeat?: number
  stepFunction?: StepFunction
  clicks?: number
  sequence?: string
  variable?: string
  then?: BuilderAction[]
  else?: BuilderAction[]
  useSpellIds?: boolean
}

interface BuilderVersion {
  id: string
  name: string
  stepFunction: StepFunction
  keyPress: string
  keyRelease: string
  resetOnCombat: boolean
  resetOnTarget: boolean
  resetOnGear: boolean
  resetOnSpec: boolean
  resetTimer: number
  actions: BuilderAction[]
}

interface BuilderSequence {
  id: string
  name: string
  description: string
  help: string
  classId: number
  specId: number | null
  defaultVersion: number
  versions: BuilderVersion[]
}

interface GripVariable {
  id: string
  name: string
  description: string
  type: 'text' | 'function'
  value: string
  function: string
}

interface StandaloneMacro {
  id: string
  name: string
  macro: string
}

interface BuilderModel {
  exportMeta: { collectionName: string; author: string; description: string }
  variables: GripVariable[]
  standaloneMacros: StandaloneMacro[]
  sequences: BuilderSequence[]
}

interface Suggestion {
  kind: 'command' | 'spell' | 'conditional' | 'hint'
  label: string
  detail?: string
  insert: string
  replaceStart?: number
  replaceEnd?: number
  keepOpen?: boolean
}

interface DebugWarning {
  path: string
  message: string
  type: 'error' | 'warn'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_FUNCTIONS: StepFunction[] = ['Sequential', 'Priority', 'ReversePriority', 'Random']
const CLASS_OPTIONS = [
  [0, 'Any / unknown'], [1, 'Warrior'], [2, 'Paladin'], [3, 'Hunter'], [4, 'Rogue'],
  [5, 'Priest'], [6, 'Death Knight'], [7, 'Shaman'], [8, 'Mage'], [9, 'Warlock'],
  [10, 'Monk'], [11, 'Druid'], [12, 'Demon Hunter'], [13, 'Evoker'],
] as [number, string][]

const MACRO_COMMANDS = [
  { key: '/cast', label: 'Cast spell or ability', detail: 'Most common macro command' },
  { key: '/castsequence', label: 'Cast sequence', detail: 'Rotate through listed spells' },
  { key: '/use', label: 'Use item or slot', detail: 'Items, trinkets, or slots 0-19' },
  { key: '/targetenemy', label: 'Target nearest enemy', detail: 'Use with [noharm][dead]' },
  { key: '/petattack', label: 'Send pet to attack', detail: 'Pet command' },
  { key: '/stopcasting', label: 'Stop current cast', detail: 'Interrupt self' },
  { key: '/cancelaura', label: 'Cancel aura/buff', detail: '/cancelaura BuffName' },
  { key: '/startattack', label: 'Start auto attack', detail: 'Begins auto-attack' },
]

const CONDITIONALS = [
  { key: 'mod:shift', label: 'Shift held' }, { key: 'mod:alt', label: 'Alt held' },
  { key: 'mod:ctrl', label: 'Ctrl held' }, { key: 'nomod', label: 'No modifier' },
  { key: 'combat', label: 'In combat' }, { key: 'nocombat', label: 'Out of combat' },
  { key: 'exists', label: 'Target exists' }, { key: 'harm', label: 'Hostile target' },
  { key: 'noharm', label: 'Not hostile' }, { key: 'help', label: 'Friendly target' },
  { key: 'dead', label: 'Target dead' }, { key: 'nodead', label: 'Target alive' },
  { key: '@mouseover', label: 'Mouseover unit' }, { key: '@focus', label: 'Focus target' },
  { key: '@player', label: 'Yourself' }, { key: '@pet', label: 'Your pet' },
  { key: 'nopet', label: 'No pet active' }, { key: 'mounted', label: 'Mounted' },
  { key: 'flying', label: 'Flying' }, { key: 'channeling', label: 'Channeling' },
  { key: 'spec:1', label: 'Primary spec' }, { key: 'spec:2', label: 'Secondary spec' },
  { key: 'stealth', label: 'In stealth' }, { key: 'form:1', label: 'Shapeshift form 1' },
  { key: 'group', label: 'In group' },
]

const BLOCK_COLORS = {
  action: { border: '#2d7a4a', header: 'rgba(45,122,74,0.12)', badge: '#2d7a4a' },
  loop: { border: '#0891b2', header: 'rgba(8,145,178,0.12)', badge: '#0891b2' },
  pause: { border: '#7c5cbf', header: 'rgba(124,92,191,0.12)', badge: '#7c5cbf' },
  if: { border: '#e67e22', header: 'rgba(230,126,34,0.12)', badge: '#e67e22' },
  embed: { border: '#2980b9', header: 'rgba(41,128,185,0.12)', badge: '#2980b9' },
}

let _nodeId = 1
let _seqId = 1
let _verId = 1
let _varId = 1
let _macroId = 1

function nid() { return String(_nodeId++) }
function sid() { return String(_seqId++) }
function vid() { return String(_verId++) }
function varid() { return String(_varId++) }
function macroid() { return String(_macroId++) }

function deepCloneAction(action: BuilderAction): BuilderAction {
  const cloned = { ...action, id: nid() }
  if (cloned.children) cloned.children = cloned.children.map(deepCloneAction)
  if (cloned.then) cloned.then = cloned.then.map(deepCloneAction)
  if (cloned.else) cloned.else = cloned.else.map(deepCloneAction)
  return cloned
}

function defaultVersion(): BuilderVersion {
  return {
    id: vid(), name: 'Default', stepFunction: 'Sequential',
    keyPress: '/targetenemy [noharm][dead]', keyRelease: '',
    resetOnCombat: false, resetOnTarget: false, resetOnGear: false, resetOnSpec: false,
    resetTimer: 0, actions: [],
  }
}

function defaultSequence(): BuilderSequence {
  return { id: sid(), name: 'NEW_SEQUENCE', description: '', help: '', classId: 0, specId: null, defaultVersion: 1, versions: [defaultVersion()] }
}

function defaultModel(): BuilderModel {
  return { exportMeta: { collectionName: '', author: '', description: '' }, variables: [], standaloneMacros: [], sequences: [defaultSequence()] }
}

// ─── Character count helpers ──────────────────────────────────────────────────

function countCharsInAction(action: BuilderAction): number {
  if (action.type === 'action') return (action.macro || '').length
  if (action.type === 'loop') return (action.children || []).reduce((sum, c) => sum + countCharsInAction(c), 0)
  if (action.type === 'if') return [...(action.then || []), ...(action.else || [])].reduce((sum, c) => sum + countCharsInAction(c), 0)
  return 0
}

function getDebugWarnings(model: BuilderModel): DebugWarning[] {
  const warnings: DebugWarning[] = []
  for (const seq of model.sequences) {
    for (let vi = 0; vi < seq.versions.length; vi++) {
      const ver = seq.versions[vi]
      const keyPressLen = (ver.keyPress || '').length
      const keyReleaseLen = (ver.keyRelease || '').length
      const keyTotal = keyPressLen + keyReleaseLen
      const vLabel = seq.versions.length > 1 ? `${seq.name} · ${ver.name || `Version ${vi + 1}`}` : seq.name
      for (let ai = 0; ai < ver.actions.length; ai++) {
        const action = ver.actions[ai]
        if (action.type === 'action') {
          const stepLen = (action.macro || '').length
          const total = stepLen + keyTotal
          if (total > 255) {
            warnings.push({ path: `${vLabel} · Step #${ai + 1}`, message: `Over the limit (${total} / 255 characters, including ${keyTotal} from key press/release)`, type: 'error' })
          }
        }
        if (action.type === 'loop') {
          for (let ci = 0; ci < (action.children || []).length; ci++) {
            const child = action.children![ci]
            if (child.type === 'action') {
              const stepLen = (child.macro || '').length
              const total = stepLen + keyTotal
              if (total > 255) {
                warnings.push({ path: `${vLabel} · Loop #${ai + 1} · Step #${ci + 1}`, message: `Over the limit (${total} / 255 characters, including ${keyTotal} from key press/release)`, type: 'error' })
              }
            }
          }
        }
      }
    }
  }
  return warnings
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

function getLineStart(text: string, cursorPos: number): number {
  return text.slice(0, cursorPos).lastIndexOf('\n') + 1
}

function stripConditionals(text: string): string {
  return text.replace(/^(\s*\[[^\]]*\]\s*)+/, '').trim()
}

function getContext(text: string, cursorPos: number) {
  const before = text.slice(0, cursorPos)
  const lineStart = getLineStart(text, cursorPos)
  const line = before.slice(lineStart)
  const semiIdx = line.lastIndexOf(';')
  const segmentLocalStart = semiIdx >= 0 ? semiIdx + 1 : 0
  const segmentStart = lineStart + segmentLocalStart
  const segment = before.slice(segmentStart)
  const leading = segment.match(/^\s*/)?.[0] || ''
  const trimmed = segment.slice(leading.length)
  const cmdMatch = trimmed.match(/^(\/(?:castsequence|cast|use))\b/i)
  const lineCmd = line.split(';')[0]?.trim().match(/^(\/(?:castsequence|cast|use))\b/i)?.[1]?.toLowerCase() || null
  const command = cmdMatch ? cmdMatch[1].toLowerCase() : (segmentLocalStart > 0 ? lineCmd : null)
  const afterCommand = cmdMatch ? trimmed.slice(cmdMatch[0].length) : trimmed
  return { lineStart, segmentStart, segment, trimmed, command, afterCommand, cursorPos, continued: segmentLocalStart > 0 }
}

function isCastCommand(cmd: string | null): boolean {
  return ['/cast', '/castsequence', '/use'].includes(String(cmd || '').toLowerCase())
}

interface AutocompleteQuery {
  mode: 'command' | 'spell' | 'conditional' | 'conditional-inner'
  query: string
  replaceStart: number
  replaceEnd: number
}

function getAutocompleteQuery(text: string, cursorPos: number): AutocompleteQuery | null {
  const before = text.slice(0, cursorPos)
  const lineStart = getLineStart(text, cursorPos)
  const line = before.slice(lineStart)
  const segmentLocalStart = Math.max(0, line.lastIndexOf(';') + 1)
  const segment = line.slice(segmentLocalStart)
  const leading = segment.match(/^\s*/)?.[0] || ''
  const cmdPart = segment.slice(leading.length)
  const replaceBase = lineStart + segmentLocalStart + leading.length

  // Command suggestion: starts with / and no spaces yet
  if (cmdPart.startsWith('/') && !/[\s[\];]/.test(cmdPart.slice(1))) {
    return { mode: 'command', query: cmdPart, replaceStart: replaceBase, replaceEnd: cursorPos }
  }

  // Inside an open bracket — conditional inner suggestion
  const bracketMatch = before.match(/\[([^\]]*)$/)
  if (bracketMatch) {
    const inner = bracketMatch[1]
    const bracketStart = before.lastIndexOf('[')
    const lastComma = inner.lastIndexOf(',')
    const tokenStart = bracketStart + 1 + (lastComma >= 0 ? lastComma + 1 : 0)
    const token = before.slice(tokenStart).trimStart()
    return { mode: 'conditional-inner', query: token, replaceStart: tokenStart, replaceEnd: cursorPos }
  }

  const ctx = getContext(text, cursorPos)
  if (!ctx.command || !isCastCommand(ctx.command)) return null

  const afterCmd = ctx.afterCommand

  // After command with only whitespace — offer conditional or spell
  if (/^\s*$/.test(afterCmd)) {
    return { mode: 'conditional', query: '', replaceStart: cursorPos, replaceEnd: cursorPos }
  }

  // After conditionals only (e.g. "[mod:shift] ") — offer spell name
  const conditionalsOnly = /^(\s*\[[^\]]*\]\s*)+$/.test(afterCmd)
  if (conditionalsOnly) {
    return { mode: 'conditional', query: '', replaceStart: cursorPos, replaceEnd: cursorPos }
  }

  // Spell name being typed after conditionals
  const spellPart = stripConditionals(afterCmd)
  if (spellPart.length >= 2) {
    const spellStart = cursorPos - spellPart.length
    return { mode: 'spell', query: spellPart, replaceStart: spellStart, replaceEnd: cursorPos }
  }

  // Single char of spell started — still offer spell suggestions
  if (spellPart.length === 1) {
    const spellStart = cursorPos - spellPart.length
    return { mode: 'spell', query: spellPart, replaceStart: spellStart, replaceEnd: cursorPos }
  }

  return null
}

function useMacroAutocomplete(classId: number) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [query, setQuery] = useState<AutocompleteQuery | null>(null)
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const classIdRef = useRef(classId)
  useEffect(() => { classIdRef.current = classId }, [classId])

  const close = useCallback(() => { setSuggestions([]); setActiveIndex(0); setQuery(null) }, [])

  const fetchSuggestions = useCallback(async (q: AutocompleteQuery) => {
    if (q.mode === 'command') {
      const lower = q.query.toLowerCase()
      setSuggestions(MACRO_COMMANDS.filter(c => c.key.startsWith(lower)).map(c => ({ kind: 'command' as const, label: c.key, detail: c.label, insert: c.key + ' ', replaceStart: q.replaceStart, replaceEnd: q.replaceEnd })))
      setActiveIndex(0); return
    }
    if (q.mode === 'conditional' || q.mode === 'conditional-inner') {
      const lower = q.query.toLowerCase()
      setSuggestions(CONDITIONALS.filter(c => !lower || c.key.toLowerCase().startsWith(lower) || c.label.toLowerCase().includes(lower)).slice(0, 12).map(c => ({ kind: 'conditional' as const, label: q.mode === 'conditional-inner' ? c.key : `[${c.key}]`, detail: c.label, insert: q.mode === 'conditional-inner' ? c.key : `[${c.key}] `, replaceStart: q.replaceStart, replaceEnd: q.replaceEnd })))
      setActiveIndex(0); return
    }
    if (q.mode === 'spell' && q.query.length >= 2) {
      try {
        const params = new URLSearchParams({ q: q.query, classId: String(classIdRef.current), limit: '12' })
        const res = await fetch(`/api/workshop/spells?${params}`)
        const data = await res.json()
        setSuggestions((data.results || []).map((spell: { id: number; name: string }) => ({ kind: 'spell' as const, label: spell.name, detail: `ID: ${spell.id}`, insert: spell.name, replaceStart: q.replaceStart, replaceEnd: q.replaceEnd })))
        setActiveIndex(0)
      } catch { setSuggestions([]) }
      return
    }
    setSuggestions([])
  }, [])

  const onTextareaChange = useCallback((text: string, cursorPos: number) => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current)
    const q = getAutocompleteQuery(text, cursorPos)
    if (!q) { close(); return }
    setQuery(q)
    fetchTimer.current = setTimeout(() => fetchSuggestions(q), q.mode === 'spell' ? 200 : 0)
  }, [close, fetchSuggestions])

  const applySuggestion = useCallback((suggestion: Suggestion, textarea: HTMLTextAreaElement, onChange: (v: string) => void) => {
    const q = query
    if (!q) return
    const start = suggestion.replaceStart ?? q.replaceStart
    const end = suggestion.replaceEnd ?? q.replaceEnd
    const value = textarea.value
    const newValue = value.slice(0, start) + suggestion.insert + value.slice(end)
    const newCursor = start + suggestion.insert.length
    textarea.value = newValue
    textarea.setSelectionRange(newCursor, newCursor)
    onChange(newValue)
    if (!suggestion.keepOpen) close()
    else {
      const updatedQ = getAutocompleteQuery(newValue, newCursor)
      if (updatedQ) { setQuery(updatedQ); fetchSuggestions(updatedQ) } else close()
    }
  }, [query, close, fetchSuggestions])

  return { suggestions, activeIndex, setActiveIndex, close, onTextareaChange, applySuggestion }
}

function AutocompleteDropdown({ suggestions, activeIndex, onSelect, onSetActive }: {
  suggestions: Suggestion[]; activeIndex: number; onSelect: (s: Suggestion) => void; onSetActive: (i: number) => void
}) {
  if (!suggestions.length) return null
  const colors: Record<string, string> = { command: '#2980b9', spell: 'var(--accent)', conditional: '#7c5cbf' }
  return (
    <div style={{ position: 'absolute', zIndex: 1000, minWidth: 280, maxWidth: 380, background: 'var(--bg-secondary)', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', overflow: 'hidden', top: '100%', left: 0, marginTop: 2 }}>
      {suggestions.map((s, i) => (
        <div key={i} onMouseDown={e => { e.preventDefault(); onSelect(s) }} onMouseEnter={() => onSetActive(i)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: i === activeIndex ? 'var(--bg-tertiary)' : 'transparent', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '0.5px solid var(--border)' : undefined }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--radius-sm)', background: colors[s.kind] || 'var(--text-muted)', color: 'white', flexShrink: 0, textTransform: 'uppercase' }}>{s.kind}</span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flex: 1 }}>{s.label}</span>
          {s.detail && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{s.detail}</span>}
        </div>
      ))}
    </div>
  )
}

function MacroTextarea({ value, onChange, placeholder, rows, classId, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; classId: number; style?: React.CSSProperties
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { suggestions, activeIndex, setActiveIndex, close, onTextareaChange, applySuggestion } = useMacroAutocomplete(classId)

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
    onTextareaChange(e.target.value, e.target.selectionStart)
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (textareaRef.current) applySuggestion(suggestions[activeIndex], textareaRef.current, onChange) }
    else if (e.key === 'Escape') close()
  }

  return (
    <div style={{ position: 'relative' }}>
      <textarea ref={textareaRef} value={value} onChange={handleInput} onKeyDown={handleKeyDown} onClick={e => onTextareaChange((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)} onBlur={() => setTimeout(close, 150)} placeholder={placeholder} rows={rows || 3} spellCheck={false} style={style} />
      <AutocompleteDropdown suggestions={suggestions} activeIndex={activeIndex} onSelect={s => { if (textareaRef.current) applySuggestion(s, textareaRef.current, onChange) }} onSetActive={setActiveIndex} />
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  badge: (color: string): React.CSSProperties => ({ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: color, color: 'white', letterSpacing: '0.04em', flexShrink: 0 }),
  blockContainer: (type: keyof typeof BLOCK_COLORS): React.CSSProperties => ({ border: `0.5px solid ${BLOCK_COLORS[type].border}`, borderRadius: 'var(--radius-md)', overflow: 'visible', marginBottom: 4 }),
  blockHeader: (type: keyof typeof BLOCK_COLORS): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: BLOCK_COLORS[type].header, borderBottom: `0.5px solid ${BLOCK_COLORS[type].border}`, flexWrap: 'wrap' as const, borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }),
  iconBtn: (danger = false): React.CSSProperties => ({ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: danger ? '#c0392b' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)' }),
  textarea: (): React.CSSProperties => ({ width: '100%', padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', resize: 'vertical' as const, minHeight: 72 }),
  input: (): React.CSSProperties => ({ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-sans)', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }),
  select: (): React.CSSProperties => ({ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-sans)', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }),
  btn: (primary = false): React.CSSProperties => ({ padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)', border: primary ? 'none' : '0.5px solid var(--border)', background: primary ? 'var(--accent)' : 'var(--bg-tertiary)', color: primary ? 'white' : 'var(--text-secondary)' }),
}

// ─── Block action buttons ─────────────────────────────────────────────────────

function BlockControls({ onMoveUp, onMoveDown, onClone, onDelete, dragHandleProps }: {
  onMoveUp: () => void; onMoveDown: () => void; onClone: () => void; onDelete: () => void
  dragHandleProps?: Record<string, unknown>
}) {
  return (
    <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', alignItems: 'center' }}>
      {dragHandleProps && (
        <div {...dragHandleProps} style={{ cursor: 'grab', padding: '2px 4px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }} title="Drag to reorder">
          <GripVertical size={13} />
        </div>
      )}
      <button onClick={onMoveUp} style={S.iconBtn()} title="Move up"><ChevronUp size={12} /></button>
      <button onClick={onMoveDown} style={S.iconBtn()} title="Move down"><ChevronDown size={12} /></button>
      <button onClick={onClone} style={S.iconBtn()} title="Clone"><CopyIcon size={11} /></button>
      <button onClick={onDelete} style={S.iconBtn(true)} title="Delete"><Trash2 size={12} /></button>
    </div>
  )
}

// ─── Block Components ─────────────────────────────────────────────────────────

function ActionBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown, onClone, classId, keyPressLen, dragHandleProps, blockIndex }: {
  action: BuilderAction; onUpdate: (u: BuilderAction) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; onClone: () => void
  classId: number; keyPressLen: number; dragHandleProps?: Record<string, unknown>; blockIndex?: number
}) {
  const stepLen = (action.macro || '').length
  const total = stepLen + keyPressLen
  const overLimit = total > 255
  const nearLimit = total > 200
  const [converting, setConverting] = useState(false)

  async function toggleSpellIds(toIds: boolean) {
    if (!action.macro?.trim()) { onUpdate({ ...action, useSpellIds: toIds }); return }
    setConverting(true)
    try {
      const res = await fetch('/api/workshop/convert-spell-texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: toIds ? 'toids' : 'tonames', texts: [action.macro] }),
      })
      const data = await res.json()
      if (res.ok && data.texts?.[0] !== undefined) {
        onUpdate({ ...action, macro: data.texts[0], useSpellIds: toIds })
      } else {
        onUpdate({ ...action, useSpellIds: toIds })
      }
    } catch {
      onUpdate({ ...action, useSpellIds: toIds })
    } finally {
      setConverting(false)
    }
  }

  return (
    <div style={S.blockContainer('action')}>
      <div style={S.blockHeader('action')}>
        <span style={S.badge(BLOCK_COLORS.action.badge)}>{blockIndex !== undefined ? `Step ${blockIndex + 1}` : 'Step'}</span>
        <input placeholder="Name (optional)" value={action.name || ''} onChange={e => onUpdate({ ...action, name: e.target.value })} style={{ ...S.input(), width: 110, fontSize: 11 }} />
        <input placeholder="Label" value={action.label || ''} onChange={e => onUpdate({ ...action, label: e.target.value })} style={{ ...S.input(), width: 80, fontSize: 11 }} />
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={Boolean(action.interval)} onChange={e => onUpdate({ ...action, interval: e.target.checked ? 2 : undefined })} style={{ margin: 0 }} />
          Every
        </label>
        {action.interval !== undefined && <>
          <input type="number" min={2} max={50} value={action.interval} onChange={e => onUpdate({ ...action, interval: Math.min(50, Math.max(2, Number(e.target.value))) })} style={{ ...S.input(), width: 42 }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>steps</span>
        </>}
        <BlockControls onMoveUp={onMoveUp} onMoveDown={onMoveDown} onClone={onClone} onDelete={onDelete} dragHandleProps={dragHandleProps} />
      </div>
      <div style={{ padding: '8px 10px' }}>
        <MacroTextarea value={action.macro || ''} onChange={v => onUpdate({ ...action, macro: v })} placeholder="/cast Spell Name" rows={3} classId={classId} style={{ ...S.textarea(), minHeight: 56, borderColor: overLimit ? '#c0392b' : undefined }} />
        <div style={{ fontSize: 10, color: overLimit ? '#c0392b' : nearLimit ? '#c8960c' : 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
          {total} / 255 characters {keyPressLen > 0 ? `(incl. key bind)` : ''} · {stepLen} from step{keyPressLen > 0 ? ` · ${keyPressLen} from key bind` : ''}
        </div>
      </div>
    </div>
  )
}

function PauseBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown, onClone, dragHandleProps, blockIndex }: {
  action: BuilderAction; onUpdate: (u: BuilderAction) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; onClone: () => void
  dragHandleProps?: Record<string, unknown>; blockIndex?: number
}) {
  return (
    <div style={S.blockContainer('pause')}>
      <div style={S.blockHeader('pause')}>
        <span style={S.badge(BLOCK_COLORS.pause.badge)}>{blockIndex !== undefined ? `Pause ${blockIndex + 1}` : 'Pause'}</span>
        <input type="number" min={1} max={20} value={action.clicks ?? 1} onChange={e => onUpdate({ ...action, clicks: Math.max(1, Number(e.target.value)) })} style={{ ...S.input(), width: 48 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>clicks</span>
        <BlockControls onMoveUp={onMoveUp} onMoveDown={onMoveDown} onClone={onClone} onDelete={onDelete} dragHandleProps={dragHandleProps} />
      </div>
    </div>
  )
}

function EmbedBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown, onClone, dragHandleProps, blockIndex }: {
  action: BuilderAction; onUpdate: (u: BuilderAction) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; onClone: () => void
  dragHandleProps?: Record<string, unknown>; blockIndex?: number
}) {
  return (
    <div style={S.blockContainer('embed')}>
      <div style={S.blockHeader('embed')}>
        <span style={S.badge(BLOCK_COLORS.embed.badge)}>{blockIndex !== undefined ? `Embed ${blockIndex + 1}` : 'Embed'}</span>
        <input placeholder="Sequence name" value={action.sequence || ''} onChange={e => onUpdate({ ...action, sequence: e.target.value })} style={{ ...S.input(), flex: 1, minWidth: 120 }} />
        <BlockControls onMoveUp={onMoveUp} onMoveDown={onMoveDown} onClone={onClone} onDelete={onDelete} dragHandleProps={dragHandleProps} />
      </div>
    </div>
  )
}

function LoopBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown, onClone, depth, classId, keyPressLen, droppableId = 'root', dragHandleProps, blockIndex }: {
  action: BuilderAction; onUpdate: (u: BuilderAction) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; onClone: () => void
  depth: number; classId: number; keyPressLen: number; droppableId?: string; dragHandleProps?: Record<string, unknown>; blockIndex?: number
}) {
  function updateChild(i: number, u: BuilderAction) { const c = [...(action.children || [])]; c[i] = u; onUpdate({ ...action, children: c }) }
  function deleteChild(i: number) { onUpdate({ ...action, children: (action.children || []).filter((_, j) => j !== i) }) }
  function moveChild(i: number, dir: -1 | 1) { const c = [...(action.children || [])]; const t = i + dir; if (t < 0 || t >= c.length) return; [c[i], c[t]] = [c[t], c[i]]; onUpdate({ ...action, children: c }) }
  function cloneChild(i: number) { const c = [...(action.children || [])]; c.splice(i + 1, 0, deepCloneAction(c[i])); onUpdate({ ...action, children: c }) }
  function addChild(type: BuilderAction['type']) {
    const child: BuilderAction = type === 'action' ? { id: nid(), type: 'action', macro: '' } : type === 'pause' ? { id: nid(), type: 'pause', clicks: 1 } : type === 'embed' ? { id: nid(), type: 'embed', sequence: '' } : type === 'loop' ? { id: nid(), type: 'loop', stepFunction: 'Sequential', repeat: 1, children: [] } : { id: nid(), type: 'if', variable: '= true', then: [], else: [] }
    onUpdate({ ...action, children: [...(action.children || []), child] })
  }
  return (
    <div style={S.blockContainer('loop')}>
      <div style={S.blockHeader('loop')}>
        <span style={S.badge(BLOCK_COLORS.loop.badge)}>{blockIndex !== undefined ? `Loop ${blockIndex + 1}` : 'Loop'}</span>
        <input placeholder="Name" value={action.name || ''} onChange={e => onUpdate({ ...action, name: e.target.value })} style={{ ...S.input(), width: 100, fontSize: 11 }} />
        <input placeholder="Label" value={action.label || ''} onChange={e => onUpdate({ ...action, label: e.target.value })} style={{ ...S.input(), width: 80, fontSize: 11 }} />
        <select value={action.stepFunction || 'Sequential'} onChange={e => onUpdate({ ...action, stepFunction: e.target.value as StepFunction })} style={{ ...S.select(), fontSize: 11 }}>
          {STEP_FUNCTIONS.map(sf => <option key={sf} value={sf}>{sf}</option>)}
        </select>
        <input type="number" min={1} max={50} value={action.repeat ?? 1} onChange={e => onUpdate({ ...action, repeat: Math.min(50, Math.max(1, Number(e.target.value))) })} style={{ ...S.input(), width: 42 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>times</span>
        <BlockControls onMoveUp={onMoveUp} onMoveDown={onMoveDown} onClone={onClone} onDelete={onDelete} dragHandleProps={dragHandleProps} />
      </div>
      <div style={{ padding: '8px 10px' }}>
        <BlockList actions={action.children || []} onUpdate={updateChild} onDelete={deleteChild} onMove={moveChild} onClone={cloneChild} depth={depth + 1} classId={classId} keyPressLen={keyPressLen} droppableId={droppableId} />
        <AddBlockBar onAdd={addChild} />
      </div>
    </div>
  )
}

function IfBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown, onClone, depth, classId, keyPressLen, droppableThenId, droppableElseId, dragHandleProps, blockIndex }: {
  action: BuilderAction; onUpdate: (u: BuilderAction) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; onClone: () => void
  depth: number; classId: number; keyPressLen: number; droppableThenId?: string; droppableElseId?: string; dragHandleProps?: Record<string, unknown>; blockIndex?: number
}) {
  function updateBranch(branch: 'then' | 'else', i: number, u: BuilderAction) { const a = [...(action[branch] || [])]; a[i] = u; onUpdate({ ...action, [branch]: a }) }
  function deleteBranch(branch: 'then' | 'else', i: number) { onUpdate({ ...action, [branch]: (action[branch] || []).filter((_, j) => j !== i) }) }
  function moveBranch(branch: 'then' | 'else', i: number, dir: -1 | 1) { const a = [...(action[branch] || [])]; const t = i + dir; if (t < 0 || t >= a.length) return; [a[i], a[t]] = [a[t], a[i]]; onUpdate({ ...action, [branch]: a }) }
  function cloneBranch(branch: 'then' | 'else', i: number) { const a = [...(action[branch] || [])]; a.splice(i + 1, 0, deepCloneAction(a[i])); onUpdate({ ...action, [branch]: a }) }
  return (
    <div style={S.blockContainer('if')}>
      <div style={S.blockHeader('if')}>
        <span style={S.badge(BLOCK_COLORS.if.badge)}>{blockIndex !== undefined ? `If ${blockIndex + 1}` : 'If'}</span>
        <input placeholder="= true" value={action.variable || ''} onChange={e => onUpdate({ ...action, variable: e.target.value })} style={{ ...S.input(), flex: 1, minWidth: 100, fontSize: 11 }} />
        <BlockControls onMoveUp={onMoveUp} onMoveDown={onMoveDown} onClone={onClone} onDelete={onDelete} dragHandleProps={dragHandleProps} />
      </div>
      <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {(['then', 'else'] as const).map(branch => (
          <div key={branch}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{branch}</div>
            <BlockList actions={action[branch] || []} onUpdate={(i, u) => updateBranch(branch, i, u)} onDelete={i => deleteBranch(branch, i)} onMove={(i, d) => moveBranch(branch, i, d)} onClone={i => cloneBranch(branch, i)} depth={depth + 1} classId={classId} keyPressLen={keyPressLen} droppableId={branch === 'then' ? (droppableThenId || `if-then:${action.id}`) : (droppableElseId || `if-else:${action.id}`)} />
            <button onClick={() => onUpdate({ ...action, [branch]: [...(action[branch] || []), { id: nid(), type: 'action' as const, macro: '' }] })} style={{ ...S.btn(), fontSize: 11, marginTop: 4 }}><Plus size={10} style={{ marginRight: 3 }} /> Step</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function BlockList({ actions, onUpdate, onDelete, onMove, onClone, depth = 0, classId, keyPressLen, droppableId = 'root' }: {
  actions: BuilderAction[]; onUpdate: (i: number, u: BuilderAction) => void
  onDelete: (i: number) => void; onMove: (i: number, dir: -1 | 1) => void; onClone: (i: number) => void
  depth?: number; classId: number; keyPressLen: number; droppableId?: string
}) {
  return (
    <Droppable droppableId={droppableId} type={`BLOCK_${droppableId}`}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 32, background: snapshot.isDraggingOver ? 'rgba(29,158,117,0.05)' : 'transparent', borderRadius: 'var(--radius-sm)', transition: 'background 0.15s' }}
        >
          {actions.length === 0 && !snapshot.isDraggingOver && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0', fontStyle: 'italic' }}>No blocks yet. Add blocks above or drop here.</div>
          )}
          {actions.map((action, i) => {
            const typeIndex = actions.slice(0, i).filter(a => a.type === action.type).length
            const props = { action, onUpdate: (u: BuilderAction) => onUpdate(i, u), onDelete: () => onDelete(i), onMoveUp: () => onMove(i, -1), onMoveDown: () => onMove(i, 1), onClone: () => onClone(i), depth, classId, keyPressLen, blockIndex: typeIndex }
            return (
              <Draggable key={action.id} draggableId={action.id} index={i}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    style={{ ...dragProvided.draggableProps.style, opacity: dragSnapshot.isDragging ? 0.85 : 1 }}
                  >
                    {action.type === 'action' && <ActionBlock {...props} dragHandleProps={dragProvided.dragHandleProps as unknown as Record<string, unknown>} />}
                    {action.type === 'loop' && <LoopBlock {...props} droppableId={`loop:${action.id}`} dragHandleProps={dragProvided.dragHandleProps as unknown as Record<string, unknown>} />}
                    {action.type === 'pause' && <PauseBlock {...props} dragHandleProps={dragProvided.dragHandleProps as unknown as Record<string, unknown>} />}
                    {action.type === 'if' && <IfBlock {...props} droppableThenId={`if-then:${action.id}`} droppableElseId={`if-else:${action.id}`} dragHandleProps={dragProvided.dragHandleProps as unknown as Record<string, unknown>} />}
                    {action.type === 'embed' && <EmbedBlock {...props} dragHandleProps={dragProvided.dragHandleProps as unknown as Record<string, unknown>} />}
                  </div>
                )}
              </Draggable>
            )
          })}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}

function collectActionMacros(actions: BuilderAction[]): string[] {
  const macros: string[] = []
  for (const a of actions) {
    if (a.type === 'action' && (a.macro || '').trim()) macros.push(a.macro!)
    if (a.type === 'loop' && a.children) macros.push(...collectActionMacros(a.children))
    if (a.type === 'if') {
      if (a.then) macros.push(...collectActionMacros(a.then))
      if (a.else) macros.push(...collectActionMacros(a.else))
    }
  }
  return macros
}

function applyConvertedMacros(actions: BuilderAction[], texts: string[], idx: { v: number }): BuilderAction[] {
  return actions.map(a => {
    if (a.type === 'action' && (a.macro || '').trim()) return { ...a, macro: texts[idx.v++] }
    if (a.type === 'loop' && a.children) return { ...a, children: applyConvertedMacros(a.children, texts, idx) }
    if (a.type === 'if') {
      const updated = { ...a }
      if (a.then) updated.then = applyConvertedMacros(a.then, texts, idx)
      if (a.else) updated.else = applyConvertedMacros(a.else, texts, idx)
      return updated
    }
    return a
  })
}

function AddBlockBar({ onAdd, useSpellIds, onToggleSpellIds }: {
  onAdd: (type: BuilderAction['type']) => void
  useSpellIds?: boolean
  onToggleSpellIds?: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
      {([['action', '+ Step', BLOCK_COLORS.action.badge], ['loop', '+ Loop', BLOCK_COLORS.loop.badge], ['pause', '+ Pause', BLOCK_COLORS.pause.badge], ['if', '+ If', BLOCK_COLORS.if.badge], ['embed', '+ Embed', BLOCK_COLORS.embed.badge]] as const).map(([type, label, color]) => (
        <button key={type} onClick={() => onAdd(type)} style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)', border: 'none', background: color, color: 'white' }}>{label}</button>
      ))}
      {onToggleSpellIds !== undefined && (
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={Boolean(useSpellIds)} onChange={e => onToggleSpellIds(e.target.checked)} style={{ margin: 0 }} />
          Use Spell IDs
        </label>
      )}
    </div>
  )
}

// ─── Variables Panel ──────────────────────────────────────────────────────────

function VariablesPanel({ variables, onChange }: { variables: GripVariable[]; onChange: (v: GripVariable[]) => void }) {
  function addVariable() { onChange([...variables, { id: varid(), name: 'varname', description: '', type: 'function', value: '', function: 'function()\n    return true\nend' }]) }
  function updateVariable(id: string, updated: GripVariable) { onChange(variables.map(v => v.id === id ? updated : v)) }
  function deleteVariable(id: string) { onChange(variables.filter(v => v.id !== id)) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Variables</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manage variables used in this sequence. Variables use <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 'var(--radius-sm)' }}>~varname~</code> syntax and get substituted at runtime.</div>
        </div>
        <button onClick={addVariable} style={{ ...S.btn(true), fontSize: 11, flexShrink: 0 }}><Plus size={10} style={{ marginRight: 3 }} /> Variable</button>
      </div>
      {variables.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>
          No variables yet. Reference them in macro text as <code style={{ fontFamily: 'var(--font-mono)' }}>~varname~</code>.
        </div>
      ) : variables.map(v => (
        <div key={v.id} style={{ border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</label>
              <input value={v.name} onChange={e => updateVariable(v.id, { ...v, name: e.target.value })} style={{ ...S.input(), width: '100%', fontFamily: 'var(--font-mono)' }} />
            </div>
            <button onClick={() => deleteVariable(v.id)} style={S.iconBtn(true)}><Trash2 size={13} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</label>
              <select value={v.type} onChange={e => updateVariable(v.id, { ...v, type: e.target.value as 'text' | 'function' })} style={{ ...S.select(), width: '100%' }}>
                <option value="text">Plain text</option>
                <option value="function">Lua function</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
              <input value={v.description} onChange={e => updateVariable(v.id, { ...v, description: e.target.value })} placeholder="Optional" style={{ ...S.input(), width: '100%' }} />
            </div>
          </div>
          {v.type === 'text' ? (
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Value</label>
              <textarea value={v.value} onChange={e => updateVariable(v.id, { ...v, value: e.target.value })} rows={2} spellCheck={false} style={S.textarea()} />
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Function</label>
              <textarea value={v.function} onChange={e => updateVariable(v.id, { ...v, function: e.target.value })} rows={4} spellCheck={false} style={{ ...S.textarea(), fontFamily: 'var(--font-mono)' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Standalone Macros Panel ──────────────────────────────────────────────────

function StandaloneMacrosPanel({ macros, onChange, classId }: { macros: StandaloneMacro[]; onChange: (m: StandaloneMacro[]) => void; classId: number }) {
  function addMacro() { onChange([...macros, { id: macroid(), name: 'MACRO_NAME', macro: '' }]) }
  function updateMacro(id: string, updated: StandaloneMacro) { onChange(macros.map(m => m.id === id ? updated : m)) }
  function deleteMacro(id: string) { onChange(macros.filter(m => m.id !== id)) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Standalone Macros</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Named macro bodies bundled with the export.</div>
        </div>
        <button onClick={addMacro} style={{ ...S.btn(true), fontSize: 11, flexShrink: 0 }}><Plus size={10} style={{ marginRight: 3 }} /> Macro</button>
      </div>
      {macros.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>No standalone macros yet.</div>
      ) : macros.map(m => (
        <div key={m.id} style={{ border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</label>
              <input value={m.name} onChange={e => updateMacro(m.id, { ...m, name: e.target.value })} style={{ ...S.input(), width: '100%', fontFamily: 'var(--font-mono)' }} />
            </div>
            <button onClick={() => deleteMacro(m.id)} style={S.iconBtn(true)}><Trash2 size={13} /></button>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Macro Text</label>
            <MacroTextarea value={m.macro} onChange={v => updateMacro(m.id, { ...m, macro: v })} rows={3} classId={classId} style={S.textarea()} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Version Panel ────────────────────────────────────────────────────────────

function reorderInList<T>(list: T[], from: number, to: number): T[] {
  const result = [...list]
  const [removed] = result.splice(from, 1)
  result.splice(to, 0, removed)
  return result
}

function applyReorderToActions(actions: BuilderAction[], sourceId: string, sourceIndex: number, destId: string, destIndex: number): BuilderAction[] {
  if (sourceId === destId) {
    if (sourceId === 'root') return reorderInList(actions, sourceIndex, destIndex)
    return actions.map(a => {
      if (sourceId === `loop:${a.id}` && a.children) return { ...a, children: reorderInList(a.children, sourceIndex, destIndex) }
      if (sourceId === `if-then:${a.id}` && a.then) return { ...a, then: reorderInList(a.then, sourceIndex, destIndex) }
      if (sourceId === `if-else:${a.id}` && a.else) return { ...a, else: reorderInList(a.else, sourceIndex, destIndex) }
      return a
    })
  }
  return actions
}

function VersionPanel({ version, onUpdate, classId }: { version: BuilderVersion; onUpdate: (v: BuilderVersion) => void; classId: number }) {
  const keyPressLen = (version.keyPress || '').length + (version.keyRelease || '').length

  function updateActions(actions: BuilderAction[]) { onUpdate({ ...version, actions }) }
  function updateAction(i: number, u: BuilderAction) { const a = [...version.actions]; a[i] = u; updateActions(a) }
  function deleteAction(i: number) { updateActions(version.actions.filter((_, j) => j !== i)) }
  function moveAction(i: number, dir: -1 | 1) { const a = [...version.actions]; const t = i + dir; if (t < 0 || t >= a.length) return; [a[i], a[t]] = [a[t], a[i]]; updateActions(a) }
  function cloneAction(i: number) { const a = [...version.actions]; a.splice(i + 1, 0, deepCloneAction(a[i])); updateActions(a) }
  function addAction(type: BuilderAction['type']) {
    const node: BuilderAction = type === 'action' ? { id: nid(), type: 'action', macro: '' } : type === 'pause' ? { id: nid(), type: 'pause', clicks: 1 } : type === 'embed' ? { id: nid(), type: 'embed', sequence: '' } : type === 'loop' ? { id: nid(), type: 'loop', stepFunction: 'Sequential', repeat: 1, children: [] } : { id: nid(), type: 'if', variable: '= true', then: [], else: [] }
    updateActions([...version.actions, node])
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const sourceId = result.source.droppableId
    const destId = result.destination.droppableId
    const sourceIndex = result.source.index
    const destIndex = result.destination.index
    if (sourceId === destId && sourceIndex === destIndex) return
    updateActions(applyReorderToActions(version.actions, sourceId, sourceIndex, destId, destIndex))
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            Step Function
            <select value={version.stepFunction} onChange={e => onUpdate({ ...version, stepFunction: e.target.value as StepFunction })} style={S.select()}>
              {STEP_FUNCTIONS.map(sf => <option key={sf} value={sf}>{sf}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>RESET ON:</span>
            {([['resetOnCombat', 'Combat'], ['resetOnTarget', 'Target'], ['resetOnGear', 'Gear'], ['resetOnSpec', 'Spec']] as const).map(([field, label]) => (
              <label key={field} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginRight: 8 }}>
                <input type="checkbox" checked={Boolean(version[field])} onChange={e => onUpdate({ ...version, [field]: e.target.checked })} />{label}
              </label>
            ))}
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              Idle <input type="number" min={0} value={version.resetTimer} onChange={e => onUpdate({ ...version, resetTimer: Math.max(0, Number(e.target.value)) })} style={{ ...S.input(), width: 52 }} /> sec
            </label>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Key Press</label>
            <MacroTextarea value={version.keyPress} onChange={v => onUpdate({ ...version, keyPress: v })} rows={3} classId={classId} style={S.textarea()} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Key Release</label>
            <MacroTextarea value={version.keyRelease} onChange={v => onUpdate({ ...version, keyRelease: v })} placeholder="Optional" rows={3} classId={classId} style={S.textarea()} />
          </div>
        </div>
        <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <AddBlockBar onAdd={addAction} useSpellIds={Boolean((version as any).useSpellIds)} onToggleSpellIds={async (toIds) => {
              const texts = collectActionMacros(version.actions)
              if (!texts.length) { onUpdate({ ...version, useSpellIds: toIds } as any); return }
              try {
                const res = await fetch('/api/workshop/convert-spell-texts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direction: toIds ? 'toids' : 'tonames', texts }) })
                const data = await res.json()
                if (res.ok && data.texts) {
                  const updatedActions = applyConvertedMacros(version.actions, data.texts, { v: 0 })
                  onUpdate({ ...version, actions: updatedActions, useSpellIds: toIds } as any)
                } else {
                  onUpdate({ ...version, useSpellIds: toIds } as any)
                }
              } catch { onUpdate({ ...version, useSpellIds: toIds } as any) }
            }} />
            <button onClick={() => onUpdate({ ...version, actions: [] })} style={{ ...S.btn(), fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} title="Reset all blocks">
              <RotateCcw size={11} /> Reset all
            </button>
          </div>
          <BlockList actions={version.actions} onUpdate={updateAction} onDelete={deleteAction} onMove={moveAction} onClone={cloneAction} classId={classId} keyPressLen={keyPressLen} droppableId="root" />
        </div>
      </div>
    </DragDropContext>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkshopBuildPage() {
  const [loading, setLoading] = useState(true)
  const [model, setModel] = useState<BuilderModel>(defaultModel)
  const [activeSeqId, setActiveSeqId] = useState<string>('')
  const [activeVerId, setActiveVerId] = useState<string>('')
  const [exportCode, setExportCode] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [importInput, setImportInput] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importError, setImportError] = useState('')
  const [configOpen, setConfigOpen] = useState(false)
  const router = useRouter()
  const buildTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPayload = useRef('')
  const modelRef = useRef<BuilderModel>(model)

  useEffect(() => { modelRef.current = model }, [model])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/auth/login?next=/workshop/build')
      else {
        setLoading(false)
        const pending = sessionStorage.getItem('workshop_build_import')
        if (pending) {
          sessionStorage.removeItem('workshop_build_import')
          setTimeout(async () => {
            try {
              const res = await fetch('/api/workshop/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: pending }) })
              const data = await res.json()
              if (res.ok && data.model) {
                _nodeId = 1; _seqId = 1; _verId = 1; _varId = 1; _macroId = 1
                setModel(data.model)
                setActiveSeqId(data.model.sequences[0].id)
                setActiveVerId(data.model.sequences[0].versions[0].id)
                setWarnings(data.warnings || [])
                return
              }
            } catch { /* fall through to default */ }
            const m = defaultModel()
            setModel(m)
            setActiveSeqId(m.sequences[0].id)
            setActiveVerId(m.sequences[0].versions[0].id)
          }, 0)
        } else {
          const m = defaultModel()
          setModel(m)
          setActiveSeqId(m.sequences[0].id)
          setActiveVerId(m.sequences[0].versions[0].id)
        }
      }
    })
  }, [router])

  async function buildExport() {
    const currentModel = modelRef.current
    const serialized = JSON.stringify(currentModel)
    if (serialized === lastPayload.current) return
    const hasContent = currentModel.sequences.some(s => s.versions.some(v => v.actions.some(a => a.type === 'action' && (a.macro || '').trim())))
    if (!hasContent) { setExportCode(''); setWarnings([]); return }
    try {
      const res = await fetch('/api/workshop/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized })
      const data = await res.json()
      if (!res.ok) { setWarnings([data.error || 'Unable to build export.']); return }
      lastPayload.current = serialized
      setExportCode(data.export || '')
      setWarnings((data.warnings || []).filter(Boolean))
    } catch { setWarnings(['Network error. Please try again.']) }
  }

  function scheduleBuild(delay = 450) { if (buildTimer.current) clearTimeout(buildTimer.current); buildTimer.current = setTimeout(buildExport, delay) }
  useEffect(() => { scheduleBuild() }, [model])

  const activeSeq = model.sequences.find(s => s.id === activeSeqId) || model.sequences[0]
  const activeVer = activeSeq?.versions.find(v => v.id === activeVerId) || activeSeq?.versions[0]

  function updateSeq(updated: BuilderSequence) { setModel(m => ({ ...m, sequences: m.sequences.map(s => s.id === updated.id ? updated : s) })) }
  function updateVer(updated: BuilderVersion) { updateSeq({ ...activeSeq, versions: activeSeq.versions.map(v => v.id === updated.id ? updated : v) }) }

  function addSequence() { const seq = defaultSequence(); setModel(m => ({ ...m, sequences: [...m.sequences, seq] })); setActiveSeqId(seq.id); setActiveVerId(seq.versions[0].id) }
  function cloneSequence(id: string) {
    const src = model.sequences.find(s => s.id === id)
    if (!src) return
    const cloned: BuilderSequence = { ...src, id: sid(), name: src.name + '_COPY', versions: src.versions.map(v => ({ ...v, id: vid(), actions: v.actions.map(deepCloneAction) })) }
    setModel(m => ({ ...m, sequences: [...m.sequences, cloned] }))
    setActiveSeqId(cloned.id); setActiveVerId(cloned.versions[0].id)
  }
  function deleteSequence(id: string) {
    const remaining = model.sequences.filter(s => s.id !== id)
    if (!remaining.length) return
    setModel(m => ({ ...m, sequences: remaining }))
    if (activeSeqId === id) { setActiveSeqId(remaining[0].id); setActiveVerId(remaining[0].versions[0].id) }
  }

  function addVersion() { const ver = defaultVersion(); updateSeq({ ...activeSeq, versions: [...activeSeq.versions, ver] }); setActiveVerId(ver.id) }
  function cloneVersion(id: string) {
    const src = activeSeq.versions.find(v => v.id === id)
    if (!src) return
    const cloned: BuilderVersion = { ...src, id: vid(), name: src.name + ' Copy', actions: src.actions.map(deepCloneAction) }
    updateSeq({ ...activeSeq, versions: [...activeSeq.versions, cloned] })
    setActiveVerId(cloned.id)
  }
  function deleteVersion(id: string) {
    if (activeSeq.versions.length <= 1) return
    const remaining = activeSeq.versions.filter(v => v.id !== id)
    updateSeq({ ...activeSeq, versions: remaining })
    if (activeVerId === id) setActiveVerId(remaining[0].id)
  }

  async function importIntoBuilder() {
    if (!importInput.trim()) { setImportError('Paste a GRIP export or macro text to import.'); return }
    try {
      const res = await fetch('/api/workshop/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: importInput.trim() }) })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error || 'Unable to import.'); return }
      const imported = data.model as BuilderModel
      _nodeId = 1; _seqId = 1; _verId = 1; _varId = 1; _macroId = 1
      setModel(imported)
      setActiveSeqId(imported.sequences[0].id)
      setActiveVerId(imported.sequences[0].versions[0].id)
      setImportInput(''); setImportOpen(false); setImportError('')
      setWarnings(data.warnings || [])
      lastPayload.current = ''
    } catch { setImportError('Network error. Please try again.') }
  }

  async function copyExport() {
    if (!exportCode) return
    await navigator.clipboard.writeText(exportCode)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const debugWarnings = getDebugWarnings(model)

  if (loading) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</span></div>

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/workshop" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Workshop</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Build Sequence</span>
      </div>

      {/* Export bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 12, background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, letterSpacing: '0.04em' }}>!GRIP1!</span>
        <input readOnly value={exportCode} placeholder="Export updates automatically as you edit..." style={{ flex: 1, padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }} />
        <button onClick={copyExport} disabled={!exportCode} style={{ ...S.btn(true), display: 'flex', alignItems: 'center', gap: 5, opacity: exportCode ? 1 : 0.4 }}>
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={() => {
          if (!window.confirm('Reset everything and start from scratch?')) return
          _nodeId = 1; _seqId = 1; _verId = 1; _varId = 1; _macroId = 1
          const m = defaultModel()
          setModel(m)
          setActiveSeqId(m.sequences[0].id)
          setActiveVerId(m.sequences[0].versions[0].id)
          setExportCode('')
          setWarnings([])
          lastPayload.current = ''
        }} style={{ ...S.btn(), display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }} title="Reset builder to blank state">
          <RotateCcw size={12} /> Reset Builder
        </button>
      </div>

      {/* Import bar */}
      <div style={{ marginBottom: 12, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <button onClick={() => setImportOpen(o => !o)} style={{ width: '100%', padding: '8px 14px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
          {importOpen ? '▼' : '▶'} Import macro or export
        </button>
        {importOpen && (
          <div style={{ padding: '12px 14px', background: 'var(--bg-primary)', borderTop: '0.5px solid var(--border)' }}>
            <textarea value={importInput} onChange={e => setImportInput(e.target.value)} placeholder="Paste !GRIP1! or !EMS1! export, !GSE3! macro, or raw /cast lines..." rows={4} spellCheck={false} style={{ ...S.textarea(), marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={importIntoBuilder} style={S.btn(true)}>Import into builder</button>
              <button onClick={() => { setImportInput(''); setImportError('') }} style={S.btn()}>Clear</button>
              {importError && <span style={{ fontSize: 12, color: '#c0392b' }}>{importError}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Sequence tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 0, flexWrap: 'wrap' }}>
        {model.sequences.map(seq => (
          <div key={seq.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: seq.id === activeSeqId ? 'var(--bg-secondary)' : 'var(--bg-primary)', border: `0.5px solid ${seq.id === activeSeqId ? 'var(--border-strong)' : 'var(--border)'}`, borderBottom: seq.id === activeSeqId ? '0.5px solid var(--bg-secondary)' : '0.5px solid var(--border)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0', cursor: 'pointer' }} onClick={() => { setActiveSeqId(seq.id); setActiveVerId(seq.versions[0].id) }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: seq.id === activeSeqId ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{seq.name || 'Untitled'}</span>
            <button onClick={e => { e.stopPropagation(); cloneSequence(seq.id) }} style={S.iconBtn()} title="Clone sequence"><CopyIcon size={10} /></button>
            {model.sequences.length > 1 && <button onClick={e => { e.stopPropagation(); deleteSequence(seq.id) }} style={S.iconBtn(true)} title="Delete sequence"><Trash2 size={10} /></button>}
          </div>
        ))}
        <button onClick={addSequence} style={{ ...S.btn(), fontSize: 12, borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}><Plus size={11} style={{ marginRight: 3 }} /> New Sequence</button>
      </div>

      {/* Sequence workspace */}
      <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '0 var(--radius-lg) var(--radius-lg) var(--radius-lg)', padding: '16px' }}>

        {/* Config panel */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setConfigOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
            {configOpen ? '▼' : '▶'} Configuration
          </button>
          {configOpen && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Author</label>
                  <input value={model.exportMeta.author || ''} onChange={e => setModel(m => ({ ...m, exportMeta: { ...m.exportMeta, author: e.target.value } }))} placeholder="Your name" style={{ ...S.input(), width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Class</label>
                  <select value={activeSeq.classId} onChange={e => updateSeq({ ...activeSeq, classId: Number(e.target.value) })} style={S.select()}>
                    {CLASS_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Sequence name</label>
                <input value={activeSeq.name} onChange={e => updateSeq({ ...activeSeq, name: e.target.value })} style={{ ...S.input(), width: '100%', fontFamily: 'var(--font-mono)' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
                <input value={activeSeq.description} onChange={e => updateSeq({ ...activeSeq, description: e.target.value })} placeholder="Optional" style={{ ...S.input(), width: '100%' }} />
              </div>
              <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
                <VariablesPanel variables={model.variables} onChange={vars => setModel(m => ({ ...m, variables: vars }))} />
              </div>
              <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
                <StandaloneMacrosPanel macros={model.standaloneMacros} onChange={macros => setModel(m => ({ ...m, standaloneMacros: macros }))} classId={activeSeq.classId} />
              </div>
            </div>
          )}
        </div>

        {/* Version selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Default version</label>
          <select value={activeSeq.defaultVersion} onChange={e => updateSeq({ ...activeSeq, defaultVersion: Number(e.target.value) })} style={S.select()}>
            {activeSeq.versions.map((v, i) => <option key={v.id} value={i + 1}>{v.name || `Version ${i + 1}`}</option>)}
          </select>
          <button onClick={addVersion} style={{ ...S.btn(true), fontSize: 12 }}><Plus size={11} style={{ marginRight: 3 }} /> Add Version</button>
        </div>

        {/* Version tabs — click to switch, separate name field */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 0, flexWrap: 'wrap' }}>
          {activeSeq.versions.map((ver) => (
            <div key={ver.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: ver.id === activeVerId ? 'var(--bg-primary)' : 'var(--bg-tertiary)', border: `0.5px solid ${ver.id === activeVerId ? 'var(--accent)' : 'var(--border)'}`, borderBottom: ver.id === activeVerId ? '0.5px solid var(--bg-primary)' : undefined, borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', cursor: 'pointer' }} onClick={() => setActiveVerId(ver.id)}>
              {ver.id === activeVerId
                ? <input value={ver.name} onChange={e => { updateVer({ ...ver, name: e.target.value }) }} onClick={e => e.stopPropagation()} title="Rename" style={{ ...S.input(), fontSize: 11, padding: '2px 6px', width: Math.max(60, ver.name.length * 7 + 16), background: 'transparent' }} />
                : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{ver.name || 'Version'}</span>
              }
              <button onClick={e => { e.stopPropagation(); cloneVersion(ver.id) }} style={S.iconBtn()} title="Clone version"><CopyIcon size={10} /></button>
              {activeSeq.versions.length > 1 && <button onClick={e => { e.stopPropagation(); deleteVersion(ver.id) }} style={S.iconBtn(true)} title="Delete version"><Trash2 size={10} /></button>}
            </div>
          ))}
        </div>

        {activeVer && (
          <div style={{ border: '0.5px solid var(--accent)', borderRadius: '0 var(--radius-md) var(--radius-md) var(--radius-md)', padding: '14px' }}>
            <VersionPanel version={activeVer} onUpdate={updateVer} classId={activeSeq.classId} />
          </div>
        )}
      </div>

      {/* Build warnings */}
      {warnings.length > 0 && (
        <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(255,180,0,0.07)', border: '0.5px solid rgba(255,180,0,0.25)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#c8960c', marginBottom: 6 }}>Build notes</p>
          {warnings.map((w, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {typeof w === 'string' ? w : (w as any).message || JSON.stringify(w)}</p>)}
        </div>
      )}

      {/* Debug warnings */}
      {debugWarnings.length > 0 && (
        <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(192,57,43,0.07)', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#c0392b', marginBottom: 6 }}>Character limit issues</p>
          {debugWarnings.map((w, i) => (
            <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', fontWeight: 500 }}>• {w.path}</span> is {w.message}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
