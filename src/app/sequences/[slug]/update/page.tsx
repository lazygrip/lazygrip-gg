'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sequence, SequenceVersion, SequenceStep } from '@/types'
import { Wand2, X } from 'lucide-react'
import { sanitizeWarcraftLogsUrl } from '@/lib/url-safety'

interface SequenceOption {
  name: string
  index: number
}

export default function UpdateSequencePage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const supabase = useRef(createClient()).current

  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [currentVersion, setCurrentVersion] = useState<SequenceVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  const [versionLabel, setVersionLabel] = useState('')
  const [gripString, setGripString] = useState('')
  const [rawSteps, setRawSteps] = useState('')
  const [changelog, setChangelog] = useState('')
  const [heroTalent, setHeroTalent] = useState('')
  const [contentType, setContentType] = useState('')
  const [stepFunction, setStepFunction] = useState('')
  const [gripVersion, setGripVersion] = useState('')
  const [talentString, setTalentString] = useState('')
  const [warcraftlogsUrl, setWarcraftlogsUrl] = useState('')
  const [performanceNotes, setPerformanceNotes] = useState('')

  // Decode state
  const [decoding, setDecoding] = useState(false)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [stepsAutoPopulated, setStepsAutoPopulated] = useState(false)
  const [sequenceOptions, setSequenceOptions] = useState<SequenceOption[] | null>(null)
  const [pendingExportString, setPendingExportString] = useState<string | null>(null)
  // Stores the structured steps from the decoder so submit uses them directly
  // rather than re-parsing the textarea text, which would split multiline steps.
  const [decodedSteps, setDecodedSteps] = useState<SequenceStep[] | null>(null)
  const decodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchSequence()
  }, [slug])

  async function fetchSequence() {
    setLoading(true)

    const { data: seq } = await supabase
      .from('sequences')
      .select('*, author:profiles(*)')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (!seq) {
      setError('Sequence not found')
      setLoading(false)
      return
    }

    setSequence(seq)

    const { data: versionData } = await supabase
      .from('sequence_versions')
      .select('*')
      .eq('sequence_id', seq.id)
      .eq('id', seq.current_version_id)
      .single()

    if (versionData) {
      setCurrentVersion(versionData)
      const nextNumber = versionData.version_number + 1
      setVersionLabel(`v${nextNumber}.0`)
      setHeroTalent(versionData.hero_talent ?? '')
      setContentType(versionData.content_type ?? seq.content_type)
      setStepFunction(versionData.step_function ?? seq.step_function)
      setGripVersion(versionData.grip_version ?? seq.grip_version ?? '')
      setTalentString(versionData.talent_string ?? '')
      setWarcraftlogsUrl(versionData.warcraftlogs_url ?? '')
      setPerformanceNotes(versionData.performance_notes ?? '')
    }

    setLoading(false)
  }

  async function runDecode(exportString: string, sequenceIndex?: number) {
    setDecoding(true)
    setDecodeError(null)

    try {
      const res = await fetch('/api/decode-grip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: exportString, sequenceIndex }),
      })

      const data = await res.json()

      if (!res.ok) {
        setDecodeError(data.error || 'Decode failed.')
        return
      }

      if (data.sequences && data.sequences.length > 1) {
        setPendingExportString(exportString)
        setSequenceOptions(data.sequences.map((seq: { name: string }, i: number) => ({ name: seq.name, index: i })))
        return
      }

      const steps: SequenceStep[] = data.sequences?.[0]?.steps ?? data.steps ?? []
      // Store the structured steps for use at submit time.
      setDecodedSteps(steps)
      // Display in textarea with step separators so multiline steps are readable.
      const stepsText = steps.map(s => s.text).join('\n---\n')
      setRawSteps(stepsText)
      setStepsAutoPopulated(true)
      setSequenceOptions(null)
      setPendingExportString(null)
    } catch {
      setDecodeError('Could not reach the decode API. Check your connection.')
    } finally {
      setDecoding(false)
    }
  }

  function handleGripStringChange(value: string) {
    setGripString(value)
    setDecodeError(null)
    setStepsAutoPopulated(false)
    setDecodedSteps(null)

    if (decodeTimeoutRef.current) clearTimeout(decodeTimeoutRef.current)

    const trimmed = value.trim()
    if (!trimmed || (!trimmed.toUpperCase().startsWith('!GRIP1!') && !trimmed.toUpperCase().startsWith('!EMS1!'))) {
      return
    }

    decodeTimeoutRef.current = setTimeout(() => {
      runDecode(trimmed)
    }, 800)
  }

  function handleRawStepsChange(value: string) {
    setRawSteps(value)
    if (stepsAutoPopulated) {
      setStepsAutoPopulated(false)
      setDecodedSteps(null)
    }
  }

  function handleSequencePick(index: number) {
    if (!pendingExportString) return
    setSequenceOptions(null)
    setDecoding(true)
    fetch('/api/decode-grip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pendingExportString }),
    })
      .then(r => r.json())
      .then(data => {
        const seq = data.sequences?.[index]
        if (!seq) { setDecodeError('Could not load that sequence.'); return }
        const steps: SequenceStep[] = seq.steps ?? []
        // Preview steps from selected sequence but keep the full bundle string
        setDecodedSteps(steps)
        setRawSteps(steps.map((s: SequenceStep) => s.text).join('\n---\n'))
        setStepsAutoPopulated(true)
        // Keep the full export string so the complete bundle is stored
        setGripString(pendingExportString)
        setPendingExportString(null)
      })
      .catch(() => setDecodeError('Could not reach the decode API.'))
      .finally(() => setDecoding(false))
  }

  async function handlePublish() {
    if (!sequence || !currentVersion || !user) return
    if (!gripString.trim()) {
      setError('GRIP export string is required')
      return
    }
    if (!changelog.trim()) {
      setError('Changelog is required so users know what changed')
      return
    }
    if (!versionLabel.trim()) {
      setError('Version label is required')
      return
    }

    setSubmitting(true)
    setError(null)

    // Use the structured decoded steps if available, otherwise fall back to
    // parsing the textarea text line by line.
    const parsedSteps = decodedSteps ?? (
      rawSteps.trim()
        ? rawSteps.trim().split('\n').map((line, i) => ({
            index: i,
            text: line,
            char_count: line.length,
          }))
        : null
    )

    const { error: rpcError } = await supabase.rpc('publish_sequence_version', {
      p_sequence_id: sequence.id,
      p_version_number: currentVersion.version_number + 1,
      p_version_label: versionLabel.trim(),
      p_grip_string: gripString.trim(),
      p_raw_steps: parsedSteps,
      p_changelog: changelog.trim(),
      p_author_id: user.id,
      p_hero_talent: heroTalent || null,
      p_content_type: contentType,
      p_step_function: stepFunction,
      p_grip_version: gripVersion || null,
      p_talent_string: talentString || null,
      p_warcraftlogs_url: sanitizeWarcraftLogsUrl(warcraftlogsUrl),
      p_performance_notes: performanceNotes || null,
    })

    if (rpcError) {
      setError('Failed to publish version. Please try again.')
      console.error(rpcError)
      setSubmitting(false)
      return
    }

    router.push(`/sequences/${slug}`)
  }

  if (loading) return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 24px' }}>
      <div style={{ height: 200, background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)' }} />
    </div>
  )

  if (!sequence || !currentVersion) return (
    <div style={{ maxWidth: 720, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>{error ?? 'Sequence not found.'}</p>
    </div>
  )

  if (user && user.id !== sequence.author_id) {
    router.push(`/sequences/${slug}`)
    return null
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px' }}>

      {/* Sequence picker modal */}
      {sequenceOptions && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            maxWidth: 440,
            width: '100%',
            margin: '0 16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                Multiple sequences found
              </h3>
              <button
                onClick={() => { setSequenceOptions(null); setPendingExportString(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
              This export contains {sequenceOptions.length} sequences. The full bundle will be saved. Pick one to preview its steps below.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sequenceOptions.map(opt => (
                <button
                  key={opt.index}
                  onClick={() => handleSequencePick(opt.index)}
                  style={{
                    padding: '10px 14px',
                    background: 'var(--bg-secondary)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          marginBottom: 8,
        }}>
          Publish a new version
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
          You are publishing a new version of <strong style={{ color: 'var(--text-primary)' }}>{sequence.title}</strong>.
          The current version is <strong style={{ color: 'var(--accent)' }}>{currentVersion.version_label}</strong>.
          Your new version will become the default import string. The previous version stays in the history and remains importable.
        </p>
        <div style={{
          marginTop: 12,
          padding: '10px 14px',
          background: 'var(--bg-secondary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
        }}>
          To update the title or description, use the <strong style={{ color: 'var(--text-secondary)' }}>Edit</strong> button on the sequence page instead.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Version label */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
            Version
          </h2>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
              Version label
            </label>
            <input
              type="text"
              value={versionLabel}
              onChange={e => setVersionLabel(e.target.value)}
              placeholder="e.g. v2.0, v1.1, v3.5"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 6 }}>
              Defaults to the next whole number. Edit freely, v1.1 for a minor tweak, v2.0 for a significant rebuild.
            </p>
          </div>
        </div>

        {/* Changelog */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
            Changelog
          </h2>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
            What changed in this version
          </label>
          <textarea
            value={changelog}
            onChange={e => setChangelog(e.target.value)}
            placeholder="e.g. Replaced Moonfire castsequence with dedicated step to fix Barkskin timing. Increased Thrash repeat to 3 for better rage generation."
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              resize: 'vertical',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 6 }}>
            Required. Users will see this when viewing older versions or switching between them.
          </p>
        </div>

        {/* Sequence data */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
            Sequence data
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                GRIP export string <span style={{ color: '#c0392b' }}>*</span>
              </label>
              <textarea
                value={gripString}
                onChange={e => handleGripStringChange(e.target.value)}
                placeholder="Paste your GRIP export string here..."
                rows={5}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  fontFamily: 'var(--font-mono)',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', flex: 1 }}>
                  Export from GRIP-EMS using the Export button, then paste here. Steps will decode automatically.
                </p>
                <button
                  type="button"
                  onClick={() => gripString.trim() && runDecode(gripString.trim())}
                  disabled={decoding || !gripString.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    background: decoding ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    border: '0.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    color: decoding ? 'var(--text-muted)' : 'var(--text-secondary)',
                    cursor: decoding || !gripString.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Wand2 size={12} />
                  {decoding ? 'Decoding...' : 'Decode steps'}
                </button>
              </div>
              {decodeError && (
                <p style={{ fontSize: 12, color: '#c0392b', marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                  {decodeError}
                </p>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  Steps (plain text)
                </label>
                {stepsAutoPopulated && (
                  <span style={{
                    fontSize: 11,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-sans)',
                    padding: '2px 7px',
                    background: 'rgba(29,158,117,0.1)',
                    borderRadius: 'var(--radius-sm)',
                    border: '0.5px solid rgba(29,158,117,0.3)',
                  }}>
                    Auto-decoded
                  </span>
                )}
              </div>
              <textarea
                value={rawSteps}
                onChange={e => handleRawStepsChange(e.target.value)}
                placeholder={`/targetenemy [noharm][dead]\n/cast [noform:1] Bear Form\n/cast Mangle`}
                rows={6}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  fontFamily: 'var(--font-mono)',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 6 }}>
                Paste steps one per line, or decode from your export string above. Users can read these without importing.
              </p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
            Metadata
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                Content type
              </label>
              <select
                value={contentType}
                onChange={e => setContentType(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)', fontSize: 13,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <option value="mythic_plus">Mythic+</option>
                <option value="raid">Raid</option>
                <option value="pvp">PvP</option>
                <option value="solo">Solo / Leveling</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                Step function
              </label>
              <select
                value={stepFunction}
                onChange={e => setStepFunction(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)', fontSize: 13,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <option value="Sequential">Sequential</option>
                <option value="Priority">Priority</option>
                <option value="Rev. Priority">Rev. Priority</option>
                <option value="Random">Random</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                Hero talent
              </label>
              <input
                type="text"
                value={heroTalent}
                onChange={e => setHeroTalent(e.target.value)}
                placeholder="e.g. Elune's Chosen"
                style={{
                  width: '100%', padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)', fontSize: 13,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                GRIP version
              </label>
              <input
                type="text"
                value={gripVersion}
                onChange={e => setGripVersion(e.target.value)}
                placeholder="e.g. 2.1.6"
                style={{
                  width: '100%', padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)', fontSize: 13,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Version-specific extras */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
            Version extras
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
            These are specific to this version and will update when visitors switch between versions.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                Talent string
              </label>
              <input
                type="text"
                value={talentString}
                onChange={e => setTalentString(e.target.value)}
                placeholder="Paste talent import string..."
                style={{
                  width: '100%', padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)', fontSize: 12,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                Warcraft Logs URL
              </label>
              <input
                type="text"
                value={warcraftlogsUrl}
                onChange={e => setWarcraftlogsUrl(e.target.value)}
                placeholder="https://www.warcraftlogs.com/reports/..."
                style={{
                  width: '100%', padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)', fontSize: 13,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                Performance notes
              </label>
              <textarea
                value={performanceNotes}
                onChange={e => setPerformanceNotes(e.target.value)}
                placeholder="e.g. Ironfur 91% uptime across full +13 run. Thrash leading damage at 47%. Zero deaths."
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)', fontSize: 13,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  resize: 'vertical', fontFamily: 'var(--font-sans)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(192,57,43,0.08)',
            border: '0.5px solid rgba(192,57,43,0.4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: '#c0392b',
            fontFamily: 'var(--font-sans)',
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={handlePublish}
            disabled={submitting}
            style={{
              padding: '10px 24px',
              background: submitting ? 'var(--bg-tertiary)' : 'var(--accent)',
              color: submitting ? 'var(--text-muted)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 14, fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {submitting ? 'Publishing...' : 'Publish version'}
          </button>
          <button
            onClick={() => router.push(`/sequences/${slug}`)}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              fontSize: 14, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}
