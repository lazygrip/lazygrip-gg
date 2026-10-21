'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check, AlertTriangle, ArrowRight } from 'lucide-react'

interface ConvertReport {
  export: string
  source: 'GSE3' | 'FRG1'
  author: string | null
  warnings: string[]
  sequences: Array<{ name: string; className: string; specName: string; versionCount: number; stepCount: number }>
}

const card = { background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 } as const
const chip = { fontSize: 'var(--text-xs)', padding: '3px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' } as const
const secondaryBtn = {
  padding: '8px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
  border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
} as const

// No account is needed on this page. The conversion runs the same decoder the builder uses,
// nothing is stored, and the author named in the pasted string stays attached to the result.
export default function WorkshopConvertPage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  // The outcome is keyed to the code that produced it, so a result for text that has since
  // been replaced simply stops matching instead of needing to be cleared by hand.
  const [outcome, setOutcome] = useState<{ code: string; report: ConvertReport | null; error: string | null } | null>(null)
  const [converting, setConverting] = useState(false)
  const [copied, setCopied] = useState(false)

  const code = input.trim()
  const current = outcome && outcome.code === code ? outcome : null
  const report = current?.report ?? null
  const error = current?.error ?? null

  useEffect(() => {
    if (!code) return
    const timer = setTimeout(() => convert(code), 400)
    return () => clearTimeout(timer)
  }, [code])

  async function convert(codeToConvert: string) {
    setConverting(true)
    try {
      const res = await fetch('/api/workshop/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: codeToConvert }) })
      const data = await res.json()
      if (!res.ok) setOutcome({ code: codeToConvert, report: null, error: data.error || 'Unable to convert this export.' })
      else setOutcome({ code: codeToConvert, report: data, error: null })
    } catch {
      setOutcome({ code: codeToConvert, report: null, error: 'Network error. Please try again.' })
    } finally {
      setConverting(false)
    }
  }

  async function copyExport() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report.export)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be refused; the string is still selectable in the box above.
    }
  }

  function openInBuilder() {
    if (!report) return
    try { sessionStorage.setItem('workshop_build_import', report.export) } catch { /* storage unavailable */ }
    router.push('/workshop/build')
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/workshop" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textDecoration: 'none' }}>← Workshop</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Convert GSE</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>Convert</p>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>Convert GSE to GRIP-EMS</h1>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Paste a GSE export and get a GRIP-EMS string back, ready for <code style={{ fontFamily: 'var(--font-mono)' }}>/gems import</code>. The original author stays attached to the sequence, no account is needed, and nothing you paste is saved.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="gse-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>GSE export</label>
            <textarea
              id="gse-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste a !GSE3! export..."
              rows={8}
              spellCheck={false}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)',
                border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => convert(code)}
              disabled={converting || !code}
              style={{
                padding: '8px 16px', background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
                fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', opacity: converting || !code ? 0.6 : 1,
              }}
            >
              {converting ? 'Converting...' : 'Convert'}
            </button>
            <button onClick={() => setInput('')} style={secondaryBtn}>Clear</button>
          </div>

          {error && <p role="alert" style={{ fontSize: 'var(--text-xs)', color: '#c0392b', lineHeight: 1.5 }}>{error}</p>}

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            GSE is a separate addon made by its own authors, and LazyGrip.net is not affiliated with it. Protected or encrypted GSE sequences can not be read and are not converted.
          </p>
        </div>

        <div style={{ minHeight: 320 }}>
          {!report && (
            <div style={{ ...card, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>Your converted sequence will appear here.</p>
            </div>
          )}

          {report && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={card}>
                <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                  Converted {report.sequences.length} {report.sequences.length === 1 ? 'sequence' : 'sequences'}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {report.sequences.map((seq, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{seq.name}</span>
                      {(seq.className || seq.specName) && <span style={chip}>{[seq.specName, seq.className].filter(Boolean).join(' ')}</span>}
                      <span style={chip}>{seq.versionCount} {seq.versionCount === 1 ? 'version' : 'versions'}</span>
                      <span style={chip}>{seq.stepCount} steps</span>
                    </div>
                  ))}
                </div>
                {report.author ? (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Original author: {report.author}.</strong> Their name is kept on the converted sequence and locked to it.
                  </p>
                ) : (
                  <p style={{ fontSize: 'var(--text-sm)', color: '#a06c00', lineHeight: 1.5, display: 'flex', gap: 6 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 3 }} />
                    <span>This export does not name an author. If you know who wrote it, credit them when you share it.</span>
                  </p>
                )}
              </div>

              {report.warnings.filter(w => !/does not name an author/i.test(w)).length > 0 && (
                <div style={card}>
                  <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Worth a look</h2>
                  <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {report.warnings.filter(w => !/does not name an author/i.test(w)).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div style={card}>
                <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>GRIP-EMS export</h2>
                <textarea
                  readOnly
                  aria-label="Converted GRIP-EMS export"
                  value={report.export}
                  rows={4}
                  onFocus={e => e.currentTarget.select()}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
                    background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)', resize: 'vertical', marginBottom: 10,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={copyExport}
                    style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy export'}
                  </button>
                  <button onClick={openInBuilder} style={secondaryBtn}>Edit in builder <ArrowRight size={14} /></button>
                  <Link href="/post" style={secondaryBtn}>Share it on LazyGrip <ArrowRight size={14} /></Link>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 10 }}>
                  In game, type <code style={{ fontFamily: 'var(--font-mono)' }}>/gems import</code> and paste the export. New to GRIP-EMS? <Link href="/guide/from-gse" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Coming from GSE</Link> covers what behaves differently.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
