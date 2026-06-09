'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check } from 'lucide-react'

interface ActionNode {
  index: number
  kind: 'Loop' | 'Action' | 'Repeat' | 'If' | 'Pause' | 'Embed'
  depth: number
  label: string
  text?: string
  stepFunction?: string
  repeat?: number
  interval?: number
  variable?: string
  children?: ActionNode[]
}

interface ConvertResult {
  export: string
  format: string
  version: number
  type: string
  sequenceCount: number
  sequenceNames: string[]
  warnings: string[]
}

interface DecodeResult {
  meta: Record<string, unknown>
  sequences: Array<{
    name: string
    class: string
    spec: string
    defaultVersion: number
    versions: Array<{
      index: number
      name: string
      stepFunction: string
      keyPress: string
      keyRelease: string
      actions: ActionNode[]
      steps: Array<{ text: string; preMarkers?: string[]; postMarkers?: string[] }>
    }>
  }>
}

function ActionTree({ nodes, counter }: { nodes: ActionNode[]; counter: { n: number } }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {nodes.map((node, i) => {
        if (node.kind === 'Loop') {
          return (
            <div key={i} style={{
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                borderBottom: '0.5px solid var(--border)',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 7px',
                  background: 'var(--accent)', color: 'white',
                  borderRadius: 'var(--radius-sm)', letterSpacing: '0.03em',
                }}>
                  Loop
                </span>
                {node.stepFunction && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {node.stepFunction}
                  </span>
                )}
                {node.repeat && node.repeat > 1 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>×{node.repeat}</span>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                {node.children && node.children.length > 0
                  ? <ActionTree nodes={node.children} counter={counter} />
                  : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Empty loop</span>
                }
              </div>
            </div>
          )
        }

        if (node.kind === 'If') {
          return (
            <div key={i} style={{
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', background: 'var(--bg-tertiary)',
                borderBottom: '0.5px solid var(--border)',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 7px',
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                }}>If</span>
                {node.variable && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{node.variable}</span>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                {node.children && node.children.length > 0
                  ? <ActionTree nodes={node.children} counter={counter} />
                  : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Empty branch</span>
                }
              </div>
            </div>
          )
        }

        if (node.kind === 'Action' || node.kind === 'Repeat') {
          const n = ++counter.n
          const lines = (node.text || '').split('\n').filter(Boolean)
          return (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '5px 4px',
              borderBottom: '0.5px solid var(--border)', fontSize: 12,
            }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 20, textAlign: 'right' }}>{n}</span>
              <div style={{ flex: 1 }}>
                {node.kind === 'Repeat' && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '1px 5px', marginBottom: 3, display: 'inline-block',
                    background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                    border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  }}>Repeat · every {node.interval}</span>
                )}
                <pre style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {lines.join('\n')}
                </pre>
              </div>
            </div>
          )
        }

        return (
          <div key={i} style={{
            display: 'flex', gap: 10, padding: '5px 4px',
            borderBottom: '0.5px solid var(--border)', fontSize: 12,
          }}>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 20, textAlign: 'right' }}>–</span>
            <pre style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-wrap', flex: 1 }}>
              {node.label}
            </pre>
          </div>
        )
      })}
    </div>
  )
}

function VersionStepView({ version }: { version: DecodeResult['sequences'][0]['versions'][0] }) {
  const hasActions = Array.isArray(version.actions) && version.actions.length > 0
  const counter = { n: 0 }

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{version.name}</span>
        {version.stepFunction && (
          <span style={{ fontSize: 11, padding: '2px 7px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}>
            {version.stepFunction}
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {hasActions ? version.actions.length : version.steps.length} steps
        </span>
      </div>

      {version.keyPress && (
        <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>KeyPress</span>
          <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', margin: 0, whiteSpace: 'pre-wrap' }}>{version.keyPress}</pre>
        </div>
      )}

      {hasActions
        ? <ActionTree nodes={version.actions} counter={counter} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {version.steps.map((step: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 20, textAlign: 'right' }}>{i + 1}</span>
                <pre style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap', flex: 1 }}>
                  {[...(step.preMarkers || []), step.text, ...(step.postMarkers || [])].filter(Boolean).join(' ')}
                </pre>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

export default function WorkshopConvertPage() {
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ConvertResult | null>(null)
  const [decoded, setDecoded] = useState<DecodeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/auth/login?next=/workshop/convert')
      } else {
        setLoading(false)
        const prefill = sessionStorage.getItem('workshop_convert_input')
        if (prefill) {
          sessionStorage.removeItem('workshop_convert_input')
          setInput(prefill)
        }
      }
    })
  }, [router])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const code = input.trim()
    if (!code) { setResult(null); setDecoded(null); setError(null); return }
    if (!/^!GSE3!/i.test(code)) { setError('Paste a !GSE3! export code.'); setResult(null); setDecoded(null); return }
    setError(null)
    timerRef.current = setTimeout(() => convert(code), 350)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [input])

  async function convert(code: string) {
    setConverting(true)
    try {
      const res = await fetch('/api/workshop/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to convert.'); setResult(null); setDecoded(null) }
      else {
        setResult(data)
        setError(null)
        if (data.export) {
          try {
            const decRes = await fetch('/api/workshop/decode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: data.export }) })
            const decData = await decRes.json()
            if (decRes.ok) setDecoded(decData)
          } catch { /* non-fatal */ }
        }
      }
    } catch { setError('Network error. Please try again.') }
    finally { setConverting(false) }
  }

  async function copyExport() {
    if (!result?.export) return
    await navigator.clipboard.writeText(result.export)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</span></div>

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/workshop" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Workshop</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Convert to GRIP</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>Transform</p>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>Convert to GRIP</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Paste a GSE3 export and get a native !GRIP1! string with proper loop architecture and keypress handling.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>GSE3 export</label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste !GSE3!..."
              rows={8}
              spellCheck={false}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 12,
                fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)',
                border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => convert(input.trim())}
              disabled={converting || !input.trim()}
              style={{
                padding: '8px 16px', background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13,
                fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {converting ? 'Converting...' : 'Convert to GRIP'}
            </button>
            <button
              onClick={() => { setInput(''); setResult(null); setDecoded(null); setError(null) }}
              style={{
                padding: '8px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Clear
            </button>
          </div>

          {error && <p style={{ fontSize: 12, color: '#c0392b' }}>{error}</p>}
        </div>

        <div style={{ minHeight: 400 }}>
          {!result && !error && (
            <div style={{
              minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>!GRIP1! export and preview will appear here.</p>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Converted to GRIP: <strong style={{ color: 'var(--text-primary)' }}>{result.sequenceCount}</strong> sequence{result.sequenceCount !== 1 ? 's' : ''} — ready to import into GRIP.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {result.sequenceNames.map(name => (
                    <span key={name} style={{ fontSize: 12, padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>{name}</span>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>GRIP export string</span>
                  <button
                    onClick={copyExport}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', background: copied ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: copied ? 'white' : 'var(--text-secondary)',
                      border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <code style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                    wordBreak: 'break-all', display: 'block', lineHeight: 1.6,
                  }}>
                    {result.export}
                  </code>
                </div>
              </div>

              {result.warnings.length > 0 && (
                <div style={{ padding: '14px 16px', background: 'rgba(255,180,0,0.07)', border: '0.5px solid rgba(255,180,0,0.25)', borderRadius: 'var(--radius-lg)' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#c8960c', marginBottom: 8 }}>Conversion notes</p>
                  {result.warnings.map((w, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {w}</p>
                  ))}
                </div>
              )}

              {decoded && decoded.sequences.map((seq, si) => (
                <div key={si} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{seq.name}</h2>
                  </div>
                  {seq.versions.map((version, vi) => (
                    <div key={vi} style={{ borderBottom: vi < seq.versions.length - 1 ? '0.5px solid var(--border)' : undefined }}>
                      <VersionStepView version={version} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
