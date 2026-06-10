'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'

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

interface BuilderModel {
  exportMeta: { collectionName: string; author: string; description: string }
  variables: Array<{ id: string; name: string; description: string; type: 'text' | 'function'; value: string; function: string }>
  standaloneMacros: Array<{ id: string; name: string; macro: string }>
  sequences: BuilderSequence[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_FUNCTIONS: StepFunction[] = ['Sequential', 'Priority', 'ReversePriority', 'Random']
const CLASS_OPTIONS = [
  [0, 'Any / unknown'], [1, 'Warrior'], [2, 'Paladin'], [3, 'Hunter'], [4, 'Rogue'],
  [5, 'Priest'], [6, 'Death Knight'], [7, 'Shaman'], [8, 'Mage'], [9, 'Warlock'],
  [10, 'Monk'], [11, 'Druid'], [12, 'Demon Hunter'], [13, 'Evoker'],
] as [number, string][]

const DEFAULT_VARIABLE_FUNCTION = `function()\n    return true\nend`

let _nodeId = 1
let _seqId = 1
let _verId = 1
let _varId = 1
let _macroId = 1

function nid() { return String(_nodeId++) }
function sid() { return String(_seqId++) }
function vid() { return String(_verId++) }
function varid() { return String(_varId++) }
function mid() { return String(_macroId++) }

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

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  badge: (color: string): React.CSSProperties => ({
    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
    background: color, color: 'white', letterSpacing: '0.04em', flexShrink: 0,
  }),
  blockContainer: (borderColor: string): React.CSSProperties => ({
    border: `0.5px solid ${borderColor}`, borderRadius: 'var(--radius-md)',
    overflow: 'hidden', marginBottom: 4,
  }),
  blockHeader: (bg: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
    background: bg, borderBottom: '0.5px solid var(--border)', flexWrap: 'wrap',
  }),
  iconBtn: (danger = false): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
    color: danger ? '#c0392b' : 'var(--text-muted)', display: 'flex', alignItems: 'center',
    borderRadius: 'var(--radius-sm)',
  }),
  textarea: (): React.CSSProperties => ({
    width: '100%', padding: '8px 10px', fontSize: 12,
    fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)',
    border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)', resize: 'vertical', minHeight: 72,
  }),
  input: (): React.CSSProperties => ({
    padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-sans)',
    background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  }),
  select: (): React.CSSProperties => ({
    padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-sans)',
    background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  }),
  btn: (primary = false): React.CSSProperties => ({
    padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)',
    border: primary ? 'none' : '0.5px solid var(--border)',
    background: primary ? 'var(--accent)' : 'var(--bg-tertiary)',
    color: primary ? 'white' : 'var(--text-secondary)',
  }),
}

// ─── Block Components ─────────────────────────────────────────────────────────

function ActionBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown, depth = 0 }: {
  action: BuilderAction
  onUpdate: (updated: BuilderAction) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  depth?: number
}) {
  const charCount = (action.macro || '').length
  const overLimit = charCount > 255
  const nearLimit = charCount > 200

  return (
    <div style={S.blockContainer('var(--border)')}>
      <div style={S.blockHeader('var(--bg-secondary)')}>
        <span style={S.badge('#2d7a4a')}>Step</span>
        <input
          placeholder="Name (optional)"
          value={action.name || ''}
          onChange={e => onUpdate({ ...action, name: e.target.value })}
          style={{ ...S.input(), width: 120, fontSize: 11 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={Boolean(action.interval)} onChange={e => onUpdate({ ...action, interval: e.target.checked ? 2 : undefined })} style={{ margin: 0 }} />
            Every
          </label>
          {action.interval !== undefined && (
            <input
              type="number" min={2} max={50} value={action.interval}
              onChange={e => onUpdate({ ...action, interval: Math.min(50, Math.max(2, Number(e.target.value))) })}
              style={{ ...S.input(), width: 48 }}
            />
          )}
          {action.interval !== undefined && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>steps</span>}
          <button onClick={onMoveUp} style={S.iconBtn()}><ChevronUp size={12} /></button>
          <button onClick={onMoveDown} style={S.iconBtn()}><ChevronDown size={12} /></button>
          <button onClick={onDelete} style={S.iconBtn(true)}><Trash2 size={12} /></button>
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <textarea
          value={action.macro || ''}
          onChange={e => onUpdate({ ...action, macro: e.target.value })}
          placeholder="/cast Spell Name"
          spellCheck={false}
          style={{ ...S.textarea(), minHeight: 56 }}
        />
        <div style={{ fontSize: 10, color: overLimit ? '#c0392b' : nearLimit ? '#c8960c' : 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
          {charCount} / 255 characters
        </div>
      </div>
    </div>
  )
}

function PauseBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown }: {
  action: BuilderAction; onUpdate: (u: BuilderAction) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  return (
    <div style={S.blockContainer('var(--border)')}>
      <div style={S.blockHeader('var(--bg-secondary)')}>
        <span style={S.badge('#7c5cbf')}>Pause</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          <input
            type="number" min={1} max={20} value={action.clicks ?? 1}
            onChange={e => onUpdate({ ...action, clicks: Math.max(1, Number(e.target.value)) })}
            style={{ ...S.input(), width: 48, marginRight: 4 }}
          />
          clicks
        </span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button onClick={onMoveUp} style={S.iconBtn()}><ChevronUp size={12} /></button>
          <button onClick={onMoveDown} style={S.iconBtn()}><ChevronDown size={12} /></button>
          <button onClick={onDelete} style={S.iconBtn(true)}><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  )
}

function EmbedBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown }: {
  action: BuilderAction; onUpdate: (u: BuilderAction) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  return (
    <div style={S.blockContainer('var(--border)')}>
      <div style={S.blockHeader('var(--bg-secondary)')}>
        <span style={S.badge('#2980b9')}>Embed</span>
        <input
          placeholder="Sequence name"
          value={action.sequence || ''}
          onChange={e => onUpdate({ ...action, sequence: e.target.value })}
          style={{ ...S.input(), flex: 1, minWidth: 120 }}
        />
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button onClick={onMoveUp} style={S.iconBtn()}><ChevronUp size={12} /></button>
          <button onClick={onMoveDown} style={S.iconBtn()}><ChevronDown size={12} /></button>
          <button onClick={onDelete} style={S.iconBtn(true)}><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  )
}

function LoopBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown, depth }: {
  action: BuilderAction; onUpdate: (u: BuilderAction) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; depth: number
}) {
  function updateChild(index: number, updated: BuilderAction) {
    const children = [...(action.children || [])]
    children[index] = updated
    onUpdate({ ...action, children })
  }
  function deleteChild(index: number) {
    const children = (action.children || []).filter((_, i) => i !== index)
    onUpdate({ ...action, children })
  }
  function moveChild(index: number, dir: -1 | 1) {
    const children = [...(action.children || [])]
    const target = index + dir
    if (target < 0 || target >= children.length) return
    ;[children[index], children[target]] = [children[target], children[index]]
    onUpdate({ ...action, children })
  }
  function addChild(type: BuilderAction['type']) {
    const child: BuilderAction = type === 'action' ? { id: nid(), type: 'action', macro: '' }
      : type === 'pause' ? { id: nid(), type: 'pause', clicks: 1 }
      : type === 'embed' ? { id: nid(), type: 'embed', sequence: '' }
      : type === 'loop' ? { id: nid(), type: 'loop', stepFunction: 'Sequential', repeat: 1, children: [] }
      : { id: nid(), type: 'if', variable: '= true', then: [], else: [] }
    onUpdate({ ...action, children: [...(action.children || []), child] })
  }

  return (
    <div style={S.blockContainer('var(--border-strong)')}>
      <div style={S.blockHeader('var(--bg-tertiary)')}>
        <span style={S.badge('var(--accent)')}>Loop</span>
        <select
          value={action.stepFunction || 'Sequential'}
          onChange={e => onUpdate({ ...action, stepFunction: e.target.value as StepFunction })}
          style={{ ...S.select(), fontSize: 11 }}
        >
          {STEP_FUNCTIONS.map(sf => <option key={sf} value={sf}>{sf}</option>)}
        </select>
        <input
          type="number" min={1} max={50} value={action.repeat ?? 1}
          onChange={e => onUpdate({ ...action, repeat: Math.min(50, Math.max(1, Number(e.target.value))) })}
          style={{ ...S.input(), width: 48 }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>times</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button onClick={onMoveUp} style={S.iconBtn()}><ChevronUp size={12} /></button>
          <button onClick={onMoveDown} style={S.iconBtn()}><ChevronDown size={12} /></button>
          <button onClick={onDelete} style={S.iconBtn(true)}><Trash2 size={12} /></button>
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <BlockList actions={action.children || []} onUpdate={updateChild} onDelete={deleteChild} onMove={moveChild} depth={depth + 1} />
        <AddBlockBar onAdd={addChild} depth={depth + 1} />
      </div>
    </div>
  )
}

function IfBlock({ action, onUpdate, onDelete, onMoveUp, onMoveDown, depth }: {
  action: BuilderAction; onUpdate: (u: BuilderAction) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; depth: number
}) {
  function updateBranch(branch: 'then' | 'else', index: number, updated: BuilderAction) {
    const arr = [...(action[branch] || [])]
    arr[index] = updated
    onUpdate({ ...action, [branch]: arr })
  }
  function deleteBranch(branch: 'then' | 'else', index: number) {
    onUpdate({ ...action, [branch]: (action[branch] || []).filter((_, i) => i !== index) })
  }
  function moveBranch(branch: 'then' | 'else', index: number, dir: -1 | 1) {
    const arr = [...(action[branch] || [])]
    const target = index + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[index], arr[target]] = [arr[target], arr[index]]
    onUpdate({ ...action, [branch]: arr })
  }
  function addToBranch(branch: 'then' | 'else') {
    const child: BuilderAction = { id: nid(), type: 'action', macro: '' }
    onUpdate({ ...action, [branch]: [...(action[branch] || []), child] })
  }

  return (
    <div style={S.blockContainer('var(--border)')}>
      <div style={S.blockHeader('var(--bg-tertiary)')}>
        <span style={S.badge('#e67e22')}>If</span>
        <input
          placeholder="= true"
          value={action.variable || ''}
          onChange={e => onUpdate({ ...action, variable: e.target.value })}
          style={{ ...S.input(), flex: 1, minWidth: 100, fontSize: 11 }}
        />
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button onClick={onMoveUp} style={S.iconBtn()}><ChevronUp size={12} /></button>
          <button onClick={onMoveDown} style={S.iconBtn()}><ChevronDown size={12} /></button>
          <button onClick={onDelete} style={S.iconBtn(true)}><Trash2 size={12} /></button>
        </div>
      </div>
      <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {(['then', 'else'] as const).map(branch => (
          <div key={branch}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{branch}</div>
            <BlockList
              actions={action[branch] || []}
              onUpdate={(i, u) => updateBranch(branch, i, u)}
              onDelete={i => deleteBranch(branch, i)}
              onMove={(i, d) => moveBranch(branch, i, d)}
              depth={depth + 1}
            />
            <button onClick={() => addToBranch(branch)} style={{ ...S.btn(), fontSize: 11, marginTop: 4 }}>
              <Plus size={10} style={{ marginRight: 3 }} /> Step
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function BlockList({ actions, onUpdate, onDelete, onMove, depth = 0 }: {
  actions: BuilderAction[]
  onUpdate: (index: number, updated: BuilderAction) => void
  onDelete: (index: number) => void
  onMove: (index: number, dir: -1 | 1) => void
  depth?: number
}) {
  if (!actions.length) return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0', fontStyle: 'italic' }}>
      No blocks yet. Add blocks above or drop here.
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {actions.map((action, i) => {
        const props = {
          key: action.id, action,
          onUpdate: (u: BuilderAction) => onUpdate(i, u),
          onDelete: () => onDelete(i),
          onMoveUp: () => onMove(i, -1),
          onMoveDown: () => onMove(i, 1),
          depth,
        }
        if (action.type === 'action') return <ActionBlock {...props} />
        if (action.type === 'loop') return <LoopBlock {...props} />
        if (action.type === 'pause') return <PauseBlock {...props} />
        if (action.type === 'if') return <IfBlock {...props} />
        if (action.type === 'embed') return <EmbedBlock {...props} />
        return null
      })}
    </div>
  )
}

function AddBlockBar({ onAdd, depth = 0 }: { onAdd: (type: BuilderAction['type']) => void; depth?: number }) {
  const blocks: Array<{ type: BuilderAction['type']; label: string; color: string }> = [
    { type: 'action', label: '+ Step', color: '#2d7a4a' },
    { type: 'loop', label: '+ Loop', color: 'var(--accent)' },
    { type: 'pause', label: '+ Pause', color: '#7c5cbf' },
    { type: 'if', label: '+ If', color: '#e67e22' },
    { type: 'embed', label: '+ Embed', color: '#2980b9' },
  ]
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {blocks.map(({ type, label, color }) => (
        <button key={type} onClick={() => onAdd(type)} style={{
          padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)',
          border: 'none', background: color, color: 'white',
        }}>{label}</button>
      ))}
    </div>
  )
}

// ─── Version Panel ────────────────────────────────────────────────────────────

function VersionPanel({ version, onUpdate }: { version: BuilderVersion; onUpdate: (v: BuilderVersion) => void }) {
  function updateActions(actions: BuilderAction[]) { onUpdate({ ...version, actions }) }
  function updateAction(index: number, updated: BuilderAction) {
    const actions = [...version.actions]; actions[index] = updated; updateActions(actions)
  }
  function deleteAction(index: number) { updateActions(version.actions.filter((_, i) => i !== index)) }
  function moveAction(index: number, dir: -1 | 1) {
    const actions = [...version.actions]; const target = index + dir
    if (target < 0 || target >= actions.length) return
    ;[actions[index], actions[target]] = [actions[target], actions[index]]
    updateActions(actions)
  }
  function addAction(type: BuilderAction['type']) {
    const node: BuilderAction = type === 'action' ? { id: nid(), type: 'action', macro: '' }
      : type === 'pause' ? { id: nid(), type: 'pause', clicks: 1 }
      : type === 'embed' ? { id: nid(), type: 'embed', sequence: '' }
      : type === 'loop' ? { id: nid(), type: 'loop', stepFunction: 'Sequential', repeat: 1, children: [] }
      : { id: nid(), type: 'if', variable: '= true', then: [], else: [] }
    updateActions([...version.actions, node])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Step Function
          <select value={version.stepFunction} onChange={e => onUpdate({ ...version, stepFunction: e.target.value as StepFunction })} style={S.select()}>
            {STEP_FUNCTIONS.map(sf => <option key={sf} value={sf}>{sf}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {([['resetOnCombat', 'Combat'], ['resetOnTarget', 'Target'], ['resetOnGear', 'Gear'], ['resetOnSpec', 'Spec']] as const).map(([field, label]) => (
            <label key={field} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(version[field])} onChange={e => onUpdate({ ...version, [field]: e.target.checked })} />
              {label}
            </label>
          ))}
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            Idle
            <input type="number" min={0} value={version.resetTimer} onChange={e => onUpdate({ ...version, resetTimer: Math.max(0, Number(e.target.value)) })} style={{ ...S.input(), width: 56 }} />
            sec
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Key Press</label>
          <textarea
            value={version.keyPress}
            onChange={e => onUpdate({ ...version, keyPress: e.target.value })}
            rows={3} spellCheck={false}
            style={S.textarea()}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Key Release</label>
          <textarea
            value={version.keyRelease}
            onChange={e => onUpdate({ ...version, keyRelease: e.target.value })}
            placeholder="Optional"
            rows={3} spellCheck={false}
            style={S.textarea()}
          />
        </div>
      </div>

      <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
        <AddBlockBar onAdd={addAction} />
        <div style={{ marginTop: 8 }}>
          <BlockList actions={version.actions} onUpdate={updateAction} onDelete={deleteAction} onMove={moveAction} />
        </div>
      </div>
    </div>
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
  const [building, setBuilding] = useState(false)
  const [copied, setCopied] = useState(false)
  const [importInput, setImportInput] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importError, setImportError] = useState('')
  const [configOpen, setConfigOpen] = useState(false)
  const router = useRouter()
  const buildTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPayload = useRef('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/auth/login?next=/workshop/build')
      else {
        setLoading(false)
        const m = defaultModel()
        setModel(m)
        setActiveSeqId(m.sequences[0].id)
        setActiveVerId(m.sequences[0].versions[0].id)
      }
    })
  }, [router])

  const scheduleBuild = useCallback((delay = 450) => {
    if (buildTimer.current) clearTimeout(buildTimer.current)
    buildTimer.current = setTimeout(() => buildExport(), delay)
  }, [])

  const buildExport = useCallback(async () => {
    setBuilding(true)
    try {
      const serialized = JSON.stringify(model)
      if (serialized === lastPayload.current) { setBuilding(false); return }
      const hasContent = model.sequences.some(s => s.versions.some(v => v.actions.some(a => a.type === 'action' && (a.macro || '').trim())))
      if (!hasContent) { setExportCode(''); setWarnings([]); setBuilding(false); return }
      const res = await fetch('/api/workshop/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized })
      const data = await res.json()
      if (!res.ok) { setWarnings([data.error || 'Unable to build export.']); setBuilding(false); return }
      lastPayload.current = serialized
      setExportCode(data.export || '')
      setWarnings((data.warnings || []).filter(Boolean))
    } catch (e) { setWarnings(['Network error. Please try again.']) }
    finally { setBuilding(false) }
  }, [model])

  useEffect(() => { scheduleBuild() }, [model, scheduleBuild])

  const activeSeq = model.sequences.find(s => s.id === activeSeqId) || model.sequences[0]
  const activeVer = activeSeq?.versions.find(v => v.id === activeVerId) || activeSeq?.versions[0]

  function updateSeq(updated: BuilderSequence) {
    setModel(m => ({ ...m, sequences: m.sequences.map(s => s.id === updated.id ? updated : s) }))
  }

  function updateVer(updated: BuilderVersion) {
    updateSeq({ ...activeSeq, versions: activeSeq.versions.map(v => v.id === updated.id ? updated : v) })
  }

  function addSequence() {
    const seq = defaultSequence()
    setModel(m => ({ ...m, sequences: [...m.sequences, seq] }))
    setActiveSeqId(seq.id)
    setActiveVerId(seq.versions[0].id)
  }

  function deleteSequence(id: string) {
    const remaining = model.sequences.filter(s => s.id !== id)
    if (!remaining.length) return
    setModel(m => ({ ...m, sequences: remaining }))
    if (activeSeqId === id) { setActiveSeqId(remaining[0].id); setActiveVerId(remaining[0].versions[0].id) }
  }

  function addVersion() {
    const ver = defaultVersion()
    updateSeq({ ...activeSeq, versions: [...activeSeq.versions, ver] })
    setActiveVerId(ver.id)
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
      setImportInput('')
      setImportOpen(false)
      setImportError('')
      setWarnings(data.warnings || [])
      lastPayload.current = ''
    } catch { setImportError('Network error. Please try again.') }
  }

  async function copyExport() {
    if (!exportCode) return
    await navigator.clipboard.writeText(exportCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/workshop" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Workshop</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Build Sequence</span>
      </div>

      {/* Export bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 12,
        background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, letterSpacing: '0.04em' }}>!GRIP1!</span>
        <input
          readOnly value={exportCode}
          placeholder="Export updates automatically as you edit..."
          style={{ flex: 1, padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
        />
        <button onClick={copyExport} disabled={!exportCode} style={{ ...S.btn(true), display: 'flex', alignItems: 'center', gap: 5, opacity: exportCode ? 1 : 0.4 }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Import bar */}
      <div style={{ marginBottom: 12, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <button
          onClick={() => setImportOpen(o => !o)}
          style={{ width: '100%', padding: '8px 14px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}
        >
          {importOpen ? '▼' : '▶'} Import macro or export
        </button>
        {importOpen && (
          <div style={{ padding: '12px 14px', background: 'var(--bg-primary)', borderTop: '0.5px solid var(--border)' }}>
            <textarea
              value={importInput} onChange={e => setImportInput(e.target.value)}
              placeholder="Paste !GRIP1! or !EMS1! export, !GSE3! macro, or raw /cast lines..."
              rows={4} spellCheck={false} style={{ ...S.textarea(), marginBottom: 8 }}
            />
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
          <div key={seq.id} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
            background: seq.id === activeSeqId ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            border: `0.5px solid ${seq.id === activeSeqId ? 'var(--border-strong)' : 'var(--border)'}`,
            borderBottom: seq.id === activeSeqId ? '0.5px solid var(--bg-secondary)' : '0.5px solid var(--border)',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0', cursor: 'pointer',
          }} onClick={() => { setActiveSeqId(seq.id); setActiveVerId(seq.versions[0].id) }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: seq.id === activeSeqId ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{seq.name || 'Untitled'}</span>
            {model.sequences.length > 1 && (
              <button onClick={e => { e.stopPropagation(); deleteSequence(seq.id) }} style={S.iconBtn(true)}><Trash2 size={10} /></button>
            )}
          </div>
        ))}
        <button onClick={addSequence} style={{ ...S.btn(), fontSize: 12, borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
          <Plus size={11} style={{ marginRight: 3 }} /> New Sequence
        </button>
      </div>

      {/* Sequence workspace */}
      <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '0 var(--radius-lg) var(--radius-lg) var(--radius-lg)', padding: '16px' }}>

        {/* Config panel */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setConfigOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            {configOpen ? '▼' : '▶'} Configuration
          </button>
          {configOpen && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Author</label>
                  <input
                    value={activeSeq.versions[0]?.name === 'Default' ? (model.exportMeta.author || '') : ''}
                    onChange={e => setModel(m => ({ ...m, exportMeta: { ...m.exportMeta, author: e.target.value } }))}
                    placeholder="Your name"
                    style={{ ...S.input(), width: '100%' }}
                  />
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
                <input
                  value={activeSeq.name}
                  onChange={e => updateSeq({ ...activeSeq, name: e.target.value })}
                  style={{ ...S.input(), width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
                <input value={activeSeq.description} onChange={e => updateSeq({ ...activeSeq, description: e.target.value })} placeholder="Optional" style={{ ...S.input(), width: '100%' }} />
              </div>
            </div>
          )}
        </div>

        {/* Version selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Default version</label>
          <select
            value={activeSeq.defaultVersion}
            onChange={e => updateSeq({ ...activeSeq, defaultVersion: Number(e.target.value) })}
            style={S.select()}
          >
            {activeSeq.versions.map((v, i) => <option key={v.id} value={i + 1}>{v.name || `Version ${i + 1}`}</option>)}
          </select>
          <button onClick={addVersion} style={{ ...S.btn(true), fontSize: 12 }}><Plus size={11} style={{ marginRight: 3 }} /> Add Version</button>
        </div>

        {/* Version tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 0, flexWrap: 'wrap' }}>
          {activeSeq.versions.map((ver, i) => (
            <div key={ver.id} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              background: ver.id === activeVerId ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
              border: `0.5px solid ${ver.id === activeVerId ? 'var(--accent)' : 'var(--border)'}`,
              borderBottom: ver.id === activeVerId ? '0.5px solid var(--bg-primary)' : undefined,
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', cursor: 'pointer',
            }} onClick={() => setActiveVerId(ver.id)}>
              {ver.id === activeVerId && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', background: 'var(--accent)', color: 'white', borderRadius: 'var(--radius-sm)' }}>DEFAULT</span>}
              <input
                value={ver.name}
                onChange={e => { e.stopPropagation(); updateVer({ ...ver, name: e.target.value }) }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'none', border: 'none', fontSize: 12, color: ver.id === activeVerId ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-sans)', cursor: 'pointer', width: Math.max(60, ver.name.length * 8) }}
              />
              {activeSeq.versions.length > 1 && (
                <button onClick={e => { e.stopPropagation(); deleteVersion(ver.id) }} style={S.iconBtn(true)}><Trash2 size={10} /></button>
              )}
            </div>
          ))}
        </div>

        {/* Version content */}
        {activeVer && (
          <div style={{ border: '0.5px solid var(--accent)', borderRadius: '0 var(--radius-md) var(--radius-md) var(--radius-md)', padding: '14px' }}>
            <VersionPanel version={activeVer} onUpdate={updateVer} />
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(255,180,0,0.07)', border: '0.5px solid rgba(255,180,0,0.25)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#c8960c', marginBottom: 6 }}>Build notes</p>
          {warnings.map((w, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {w}</p>)}
        </div>
      )}
    </div>
  )
}
