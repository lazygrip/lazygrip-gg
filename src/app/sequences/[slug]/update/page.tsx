'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sequence, SequenceVersion } from '@/types'
import { WOW_CLASSES, CONTENT_TYPES, STEP_FUNCTIONS, GRIP_VERSIONS, HERO_TALENTS } from '@/lib/wow-data'

const supabaseRef = { current: null as any }

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
    fetchSequence()
  }, [slug])

  async function fetchSequence() {
    setLoading(true)

    const { data: seq } = await supabase
      .from('sequences')
      .select('*, author:profiles(*)')
      .eq('slug', slug)
      .eq('is_published', true)
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
    }

    setLoading(false)
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

    const parsedSteps = rawSteps.trim()
      ? rawSteps.trim().split('\n').map((line, i) => ({
          index: i,
          text: line,
          char_count: line.length,
        }))
      : null

    const { data, error: rpcError } = await supabase.rpc('publish_sequence_version', {
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

  if (error && !sequence) return (
    <div style={{ maxWidth: 720, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
    </div>
  )

  if (!sequence || !currentVersion) return null

  if (user?.id !== sequence.author_id) {
    router.push(`/sequences/${slug}`)
    return null
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px' }}>

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
                onChange={e => setGripString(e.target.value)}
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
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 6 }}>
                Export from GRIP-EMS using the Export button, then paste here.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                Steps (plain text)
              </label>
              <textarea
                value={rawSteps}
                onChange={e => setRawSteps(e.target.value)}
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
                Paste your steps one per line. Users can read these without importing.
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
                  width: '100%',
                  padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
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
                  width: '100%',
                  padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
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
                  width: '100%',
                  padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  boxSizing: 'border-box',
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
                  width: '100%',
                  padding: '8px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

          </div>
        </div>

        {/* Optional extras */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
            Optional extras
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
            Talent string, Warcraft Logs URL, and performance notes are shared across all versions and can be updated via Edit.
          </p>
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
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {submitting ? 'Publishing…' : 'Publish version'}
          </button>
          <button
            onClick={() => router.push(`/sequences/${slug}`)}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              cursor: 'pointer',
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