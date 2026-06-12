'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WOW_CLASSES, CONTENT_TYPES, STEP_FUNCTIONS, slugify } from '@/lib/wow-data'
import { AlertCircle, ChevronUp, ChevronDown, Wand2 } from 'lucide-react'
import TiptapEditor from '@/components/editor/TiptapEditor'
import type { SequenceStep } from '@/types'

const PATCH_VERSIONS = ['12.0', '12.0.5', '12.0.7']
const DEFAULT_GRIP_VERSION = '2.1.7'

const EMPTY_FORM = {
  title: '',
  description: '',
  class_id: '',
  spec_name: '',
  content_type: 'mythic_plus',
  hero_talent: '',
  patch_version: '12.0.5',
  grip_version: DEFAULT_GRIP_VERSION,
  step_function: 'Sequential',
  grip_string: '',
  raw_steps_text: '',
  talent_string: '',
  warcraftlogs_url: '',
  performance_notes: '',
}

// Per-sequence data for collection imports
interface CollectionSequence {
  index: number
  name: string
  title: string           // editable label stored inside collection_sequences
  talent_string: string   // per-sequence, may differ between ST/MT
  steps: SequenceStep[]
  stepFunction: string
  classID: number | null
  specID: number | null
  checked: boolean
}

function stepGripVersion(version: string, direction: 'up' | 'down'): string {
  const parts = version.split('.')
  if (parts.length !== 3) return version
  let patch = parseInt(parts[2], 10)
  if (isNaN(patch)) return version
  patch = direction === 'up' ? patch + 1 : Math.max(0, patch - 1)
  return `${parts[0]}.${parts[1]}.${patch}`
}

function PostForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const isEditMode = !!editId

  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loadingEdit, setLoadingEdit] = useState(isEditMode)
  const [editSlug, setEditSlug] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  // Decode state
  const [decoding, setDecoding] = useState(false)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [stepsAutoPopulated, setStepsAutoPopulated] = useState(false)
  const [decodedSteps, setDecodedSteps] = useState<SequenceStep[] | null>(null)
  const decodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Collection state -- non-null when a collection export is detected
  const [collectionSequences, setCollectionSequences] = useState<CollectionSequence[] | null>(null)
  // Shared title for the collection page
  const [collectionTitle, setCollectionTitle] = useState('')

  const selectedClass = WOW_CLASSES.find(c => c.id === Number(form.class_id))
  const selectedSpec = selectedClass?.specs.find(s => s.name === form.spec_name)
  const heroTalentOptions = selectedSpec?.heroTalents ?? []

  useEffect(() => {
    if (!editId) return

    async function loadSequence() {
      setLoadingEdit(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data, error } = await supabase
        .from('sequences')
        .select('*')
        .eq('id', editId)
        .eq('author_id', user.id)
        .single()

      if (error || !data) {
        router.push('/browse')
        return
      }

      setEditSlug(data.slug)

      let raw_steps_text = ''
      if (Array.isArray(data.raw_steps)) {
        raw_steps_text = data.raw_steps.map((s: SequenceStep) =>
          typeof s === 'string' ? s : s.text || ''
        ).join('\n')
      }

      setForm({
        title: data.title ?? '',
        description: data.description ?? '',
        class_id: String(data.class_id ?? ''),
        spec_name: data.spec_name ?? '',
        content_type: data.content_type ?? 'mythic_plus',
        hero_talent: data.hero_talent ?? '',
        patch_version: data.patch_version ?? '12.0.5',
        grip_version: data.grip_version ?? DEFAULT_GRIP_VERSION,
        step_function: data.step_function ?? 'Sequential',
        grip_string: data.grip_string ?? '',
        raw_steps_text,
        talent_string: data.talent_string ?? '',
        warcraftlogs_url: data.warcraftlogs_url ?? '',
        performance_notes: data.performance_notes ?? '',
      })

      setLoadingEdit(false)
    }

    loadSequence()
  }, [editId])

  function handleStepsChange(value: string) {
    setField('raw_steps_text', value)
    if (stepsAutoPopulated) {
      setStepsAutoPopulated(false)
      setDecodedSteps(null)
    }
  }

  async function runDecode(exportString: string) {
    setDecoding(true)
    setDecodeError(null)
    setCollectionSequences(null)
    setCollectionTitle('')

    try {
      const res = await fetch('/api/decode-grip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportString }),
      })

      const data = await res.json()

      if (!res.ok) {
        setDecodeError(data.error || 'Decode failed.')
        return
      }

      if (data.multipleSequences) {
        const anchor = data.sequences.find((s: CollectionSequence) => s.classID) ?? data.sequences[0]

        if (anchor.classID) {
          const cls = WOW_CLASSES.find(c => c.id === anchor.classID)
          if (cls) {
            const updates: Partial<typeof EMPTY_FORM> = {
              class_id: String(cls.id),
            }
            if (anchor.specID) {
              const spec = cls.specs.find(s => s.id === anchor.specID)
              if (spec) updates.spec_name = spec.name
            }
            if (anchor.stepFunction) {
              const map: Record<string, string> = {
                'Sequential': 'Sequential',
                'Priority': 'Priority',
                'ReversePriority': 'Rev. Priority',
                'Reverse Priority': 'Rev. Priority',
                'Rev. Priority': 'Rev. Priority',
                'Random': 'Random',
              }
              const mapped = map[anchor.stepFunction]
              if (mapped) updates.step_function = mapped
            }
            setForm(f => ({ ...f, ...updates }))
          }
        }

        setCollectionSequences(
          data.sequences.map((s: {
            index: number
            name: string
            steps: SequenceStep[]
            stepFunction: string
            classID: number | null
            specID: number | null
          }) => ({
            index: s.index,
            name: s.name,
            title: s.name,
            talent_string: '',
            steps: s.steps,
            stepFunction: s.stepFunction,
            classID: s.classID,
            specID: s.specID,
            checked: true,
          }))
        )
        return
      }

      // Single sequence -- existing behaviour.
      const steps: SequenceStep[] = data.steps
      setDecodedSteps(steps)
      const stepsText = steps.map(s => s.text).join('\n---\n')
      setField('raw_steps_text', stepsText)
      setStepsAutoPopulated(true)

      if (data.meta) {
        setForm(current => {
          const updates: Partial<typeof EMPTY_FORM> = {}

          if (!current.title.trim() && data.meta.name && !data.meta.name.startsWith('Sequence ')) {
            updates.title = data.meta.name
          }

          if (data.meta.classID) {
            const cls = WOW_CLASSES.find(c => c.id === data.meta.classID)
            if (cls) {
              updates.class_id = String(cls.id)
              if (data.meta.specID) {
                const spec = cls.specs.find(s => s.id === data.meta.specID)
                if (spec) updates.spec_name = spec.name
              }
            }
          }

          if (data.meta.stepFunction) {
            const map: Record<string, string> = {
              'Sequential': 'Sequential',
              'Priority': 'Priority',
              'ReversePriority': 'Rev. Priority',
              'Reverse Priority': 'Rev. Priority',
              'Rev. Priority': 'Rev. Priority',
              'Random': 'Random',
            }
            const mapped = map[data.meta.stepFunction]
            if (mapped) updates.step_function = mapped
          }

          return { ...current, ...updates }
        })
      }
    } catch {
      setDecodeError('Could not reach the decode API. Check your connection.')
    } finally {
      setDecoding(false)
    }
  }

  function handleGripStringChange(value: string) {
    setField('grip_string', value)
    setDecodeError(null)
    setStepsAutoPopulated(false)
    setDecodedSteps(null)
    setCollectionSequences(null)
    setCollectionTitle('')

    if (decodeTimeoutRef.current) clearTimeout(decodeTimeoutRef.current)

    const trimmed = value.trim()
    if (!trimmed || (!trimmed.toUpperCase().startsWith('!GRIP1!') && !trimmed.toUpperCase().startsWith('!EMS1!'))) {
      return
    }

    decodeTimeoutRef.current = setTimeout(() => {
      runDecode(trimmed)
    }, 800)
  }

  function updateCollectionSequence(index: number, updates: Partial<CollectionSequence>) {
    setCollectionSequences(prev =>
      prev ? prev.map(s => s.index === index ? { ...s, ...updates } : s) : prev
    )
  }

  function setField(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function parseSteps(text: string) {
    if (!text.trim()) return null
    return text.split(/\n(?=\/|\d+\.)/).map((block, i) => ({
      index: i + 1,
      text: block.replace(/^\d+\.\s*/, '').trim(),
      char_count: block.trim().length,
    }))
  }

  function descriptionIsEmpty(html: string) {
    if (!html) return true
    const stripped = html.replace(/<p><\/p>/g, '').replace(/<p>\s*<\/p>/g, '').trim()
    return stripped === ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.class_id || !form.content_type) {
      setError('Class and content type are required.')
      return
    }

    // Collection submit path -- one record, collection_sequences jsonb
    if (collectionSequences) {
      const checked = collectionSequences.filter(s => s.checked)
      if (checked.length === 0) {
        setError('Select at least one sequence to post.')
        return
      }
      if (!collectionTitle.trim()) {
        setError('A title is required for the collection page.')
        return
      }

      setSubmitting(true)

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }

        const cls = WOW_CLASSES.find(c => c.id === Number(form.class_id))
        const spec = cls?.specs.find(s => s.name === form.spec_name)
        const slug = slugify(collectionTitle) + '-' + Date.now().toString(36)

        // Build the collection_sequences array from checked sequences only
        const collectionData = checked.map(seq => ({
          name: seq.title.trim() || seq.name,
          steps: seq.steps,
          stepFunction: seq.stepFunction || form.step_function,
          talent_string: seq.talent_string.trim() || null,
        }))

        // Use the first checked sequence's step count as the representative value
        const totalSteps = checked.reduce((sum, s) => sum + s.steps.length, 0)

        const { data: inserted, error: insertError } = await supabase
          .from('sequences')
          .insert({
            author_id: user.id,
            title: collectionTitle.trim(),
            slug,
            description: descriptionIsEmpty(form.description) ? null : form.description,
            class_id: Number(form.class_id),
            class_name: cls?.name ?? '',
            spec_id: spec?.id ?? null,
            spec_name: form.spec_name || null,
            content_type: form.content_type,
            hero_talent: form.hero_talent || null,
            patch_version: form.patch_version || null,
            grip_version: form.grip_version || null,
            step_function: form.step_function,
            step_count: totalSteps,
            grip_string: form.grip_string.trim() || null,
            raw_steps: null,
            talent_string: null,
            warcraftlogs_url: form.warcraftlogs_url.trim() || null,
            performance_notes: form.performance_notes.trim() || null,
            collection_sequences: collectionData,
            is_published: true,
          })
          .select('slug')
          .single()

        if (insertError) throw insertError
        if (inserted) router.push(`/sequences/${inserted.slug}`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
        setError(message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Single sequence submit path
    if (!form.title) {
      setError('Title, class, and content type are required.')
      return
    }

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const raw_steps = decodedSteps ?? parseSteps(form.raw_steps_text)

      const payload = {
        title: form.title.trim(),
        description: descriptionIsEmpty(form.description) ? null : form.description,
        class_id: Number(form.class_id),
        class_name: selectedClass?.name ?? '',
        spec_name: form.spec_name || null,
        content_type: form.content_type,
        hero_talent: form.hero_talent || null,
        patch_version: form.patch_version || null,
        grip_version: form.grip_version || null,
        step_function: form.step_function,
        step_count: raw_steps?.length ?? null,
        grip_string: form.grip_string.trim() || null,
        raw_steps,
        talent_string: form.talent_string.trim() || null,
        warcraftlogs_url: form.warcraftlogs_url.trim() || null,
        performance_notes: form.performance_notes.trim() || null,
      }

if (isEditMode) {
  const { error: rpcError } = await supabase.rpc('update_sequence_with_version', {
    p_sequence_id: editId,
    p_author_id: user.id,
    p_title: payload.title,
    p_description: payload.description,
    p_class_id: payload.class_id,
    p_class_name: payload.class_name,
    p_spec_id: selectedSpec?.id ?? null,
    p_spec_name: payload.spec_name,
    p_content_type: payload.content_type,
    p_hero_talent: payload.hero_talent,
    p_patch_version: payload.patch_version,
    p_grip_version: payload.grip_version,
    p_step_function: payload.step_function,
    p_step_count: payload.step_count,
    p_grip_string: payload.grip_string,
    p_raw_steps: raw_steps ? JSON.stringify(raw_steps) : null,
    p_talent_string: payload.talent_string,
    p_warcraftlogs_url: payload.warcraftlogs_url,
    p_performance_notes: payload.performance_notes,
    p_changelog: null,
    p_version_label: '1.0',
  })

if (rpcError) throw rpcError
  router.push(`/sequences/${editSlug}`)
} else {
        const slug = slugify(form.title) + '-' + Date.now().toString(36)
        const { data, error: rpcError } = await supabase.rpc('create_sequence_with_version', {
          p_author_id: user.id,
          p_title: payload.title,
          p_slug: slug,
          p_description: payload.description,
          p_class_id: payload.class_id,
          p_class_name: payload.class_name,
          p_spec_id: selectedSpec?.id ?? null,
          p_spec_name: payload.spec_name,
          p_content_type: payload.content_type,
          p_hero_talent: payload.hero_talent,
          p_patch_version: payload.patch_version,
          p_grip_version: payload.grip_version,
          p_step_function: payload.step_function,
          p_step_count: payload.step_count,
          p_grip_string: payload.grip_string,
          p_raw_steps: raw_steps ? JSON.stringify(raw_steps) : null,
          p_talent_string: payload.talent_string,
          p_warcraftlogs_url: payload.warcraftlogs_url,
          p_performance_notes: payload.performance_notes,
          p_changelog: null,
        })

        if (rpcError) throw rpcError
        if (data) router.push(`/sequences/${data.slug}`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingEdit) return (
    <div style={{ maxWidth: 760, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading sequence...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>

      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 6 }}>
        {isEditMode ? 'Edit sequence' : 'Post a sequence'}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 28 }}>
        {isEditMode
          ? 'Update your sequence details below. Changes will be live immediately.'
          : 'Share your GRIP-EMS sequence with the community. Include your GRIP export string so others can import it directly.'}
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <Section title="Sequence data">
            {!isEditMode && (
              <div style={{
                display: 'flex', gap: 10, padding: '12px 14px',
                background: 'rgba(29,158,117,0.07)',
                border: '0.5px solid rgba(29,158,117,0.3)',
                borderRadius: 'var(--radius-md)',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>👆</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-sans)', marginBottom: 3 }}>
                    Start here: paste your GRIP export string
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                    In GRIP-EMS, open your sequence and click Export. Paste the string below and LazyGrip will automatically fill in your class, spec, step function, and steps. Collection exports with multiple sequences are supported.
                  </p>
                </div>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
                GRIP export string
              </label>
              <style>{`
                input, select, textarea {
                  width: 100%; padding: 8px 12px;
                  border: 0.5px solid var(--border-strong);
                  border-radius: var(--radius-md);
                  font-size: 13px; background: var(--bg-secondary);
                  color: var(--text-primary); font-family: var(--font-sans);
                }
                input:focus, select:focus, textarea:focus {
                  outline: none; border-color: var(--accent);
                }
                select { appearance: auto; }
              `}</style>
              <textarea
                value={form.grip_string}
                onChange={e => handleGripStringChange(e.target.value)}
                placeholder="Paste your GRIP1 export string here. Class, spec, and step function will fill automatically. Collection exports with multiple sequences are supported."
                rows={4}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                  Paste your export string and class, spec, step function, and steps will decode automatically.
                </p>
                <button
                  type="button"
                  onClick={() => form.grip_string.trim() && runDecode(form.grip_string.trim())}
                  disabled={decoding || !form.grip_string.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', background: decoding ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                    fontSize: 12, color: decoding ? 'var(--text-muted)' : 'var(--text-secondary)',
                    cursor: decoding || !form.grip_string.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                  }}
                >
                  <Wand2 size={12} />
                  {decoding ? 'Decoding...' : 'Decode'}
                </button>
              </div>
              {decodeError && (
                <p style={{ fontSize: 12, color: '#c41e3a', marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                  {decodeError}
                </p>
              )}
            </div>

            {/* Single sequence steps textarea -- hidden when collection detected */}
            {!collectionSequences && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Steps (plain text)
                  </label>
                  {stepsAutoPopulated && (
                    <span style={{
                      fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-sans)',
                      padding: '2px 7px', background: 'rgba(29,158,117,0.1)',
                      borderRadius: 'var(--radius-sm)', border: '0.5px solid rgba(29,158,117,0.3)',
                    }}>
                      Auto-decoded
                    </span>
                  )}
                </div>
                <textarea
                  value={form.raw_steps_text}
                  onChange={e => handleStepsChange(e.target.value)}
                  placeholder={`/targetenemy [noharm][dead]\n/cast [noform:1] Bear Form\n/cast Mangle`}
                  rows={8}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Paste steps one per line, or decode from your export string above. Users can read these without importing.
                </p>
              </div>
            )}
          </Section>

          {/* Collection sequences UI */}
          {collectionSequences && (
            <Section title="Collection sequences">
              <div style={{
                padding: '10px 14px',
                background: 'rgba(29,158,117,0.07)',
                border: '0.5px solid rgba(29,158,117,0.3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}>
                Collection export detected with {collectionSequences.length} sequences. These will be posted as a single page with tabs — one tab per sequence. Give the page a title below, then label each sequence.
              </div>

              {/* Collection page title */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
                  Page title *
                </label>
                <input
                  type="text"
                  value={collectionTitle}
                  onChange={e => setCollectionTitle(e.target.value)}
                  placeholder="e.g. Slowdog's Ret Paladin M+ — Templar ST & MT V1.0"
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  This is the title of the sequence page. Each tab inside will use the label you give it below.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {collectionSequences.map(seq => (
                  <div
                    key={seq.index}
                    style={{
                      border: `0.5px solid ${seq.checked ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      background: seq.checked ? 'rgba(29,158,117,0.04)' : 'var(--bg-secondary)',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={seq.checked}
                        onChange={e => updateCollectionSequence(seq.index, { checked: e.target.checked })}
                        style={{
                          width: 16, height: 16, marginTop: 2,
                          accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 11, color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                            padding: '2px 6px',
                            background: 'var(--bg-primary)',
                            border: '0.5px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                          }}>
                            {seq.name}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                            {seq.steps.length} steps
                          </span>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            Tab label
                          </label>
                          <input
                            type="text"
                            value={seq.title}
                            onChange={e => updateCollectionSequence(seq.index, { title: e.target.value })}
                            placeholder="e.g. Single Target"
                            disabled={!seq.checked}
                            style={{ opacity: seq.checked ? 1 : 0.5 }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            Talent string <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional, per-sequence)</span>
                          </label>
                          <input
                            type="text"
                            value={seq.talent_string}
                            onChange={e => updateCollectionSequence(seq.index, { talent_string: e.target.value })}
                            placeholder="Paste talent import string if different from the other sequence..."
                            disabled={!seq.checked}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 12, opacity: seq.checked ? 1 : 0.5 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setCollectionSequences(prev => prev ? prev.map(s => ({ ...s, checked: true })) : prev)}
                  style={{
                    fontSize: 12, color: 'var(--text-secondary)', background: 'transparent',
                    border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                    padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionSequences(prev => prev ? prev.map(s => ({ ...s, checked: false })) : prev)}
                  style={{
                    fontSize: 12, color: 'var(--text-secondary)', background: 'transparent',
                    border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                    padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  Deselect all
                </button>
              </div>
            </Section>
          )}

          {/* Single sequence title -- hidden for collections */}
          {!collectionSequences && (
            <Section title="Basic info">
              <Field label="Sequence title *">
                <input
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  placeholder="e.g. Slowdog's Guardian Druid DotC M+ V14"
                  required={!collectionSequences}
                />
              </Field>

              <Field
                label="Description"
                hint="Use the toolbar for headings, lists, code blocks, and links. Keyboard shortcuts work too (Ctrl+B, Ctrl+I)."
              >
                <TiptapEditor
                  content={form.description}
                  onChange={(html) => setField('description', html)}
                  placeholder="Describe your sequence -- build, talents, key modifiers, what it's optimised for..."
                />
              </Field>
            </Section>
          )}

          {/* Description for collections lives here separately */}
          {collectionSequences && (
            <Section title="Description">
              <Field
                label="Description"
                hint="Applies to all sequences in this collection. Use the toolbar for headings, lists, code blocks, and links."
              >
                <TiptapEditor
                  content={form.description}
                  onChange={(html) => setField('description', html)}
                  placeholder="Describe your sequences -- build, talents, key modifiers, what they're optimised for..."
                />
              </Field>
            </Section>
          )}

          <Section title="WoW metadata">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Class *">
                <select
                  value={form.class_id}
                  onChange={e => {
                    setField('class_id', e.target.value)
                    setField('spec_name', '')
                    setField('hero_talent', '')
                  }}
                  required
                >
                  <option value="">Select class...</option>
                  {WOW_CLASSES.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Spec">
                <select
                  value={form.spec_name}
                  onChange={e => {
                    setField('spec_name', e.target.value)
                    setField('hero_talent', '')
                  }}
                  disabled={!selectedClass}
                >
                  <option value="">Select spec...</option>
                  {selectedClass?.specs.map(spec => (
                    <option key={spec.id} value={spec.name}>{spec.name} ({spec.role})</option>
                  ))}
                </select>
              </Field>

              <Field label="Content type *">
                <select value={form.content_type} onChange={e => setField('content_type', e.target.value)} required>
                  {CONTENT_TYPES.map(ct => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Hero talent">
                <select
                  value={form.hero_talent}
                  onChange={e => setField('hero_talent', e.target.value)}
                  disabled={heroTalentOptions.length === 0}
                >
                  <option value="">
                    {heroTalentOptions.length === 0 ? 'Select a spec first...' : 'Select hero talent...'}
                  </option>
                  {heroTalentOptions.map(ht => (
                    <option key={ht} value={ht}>{ht}</option>
                  ))}
                </select>
              </Field>

              <Field label="Patch version">
                <select value={form.patch_version} onChange={e => setField('patch_version', e.target.value)}>
                  {PATCH_VERSIONS.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </Field>

              <Field label="Step function">
                <select value={form.step_function} onChange={e => setField('step_function', e.target.value)}>
                  {STEP_FUNCTIONS.map(sf => <option key={sf} value={sf}>{sf}</option>)}
                </select>
              </Field>
            </div>
            {collectionSequences && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 4 }}>
                These fields apply to the collection page. Step function per sequence is read from the export string automatically.
              </p>
            )}
          </Section>

          <Section title="Optional extras">
            <Field label="GRIP version" hint="Which version of GRIP-EMS was this sequence built with?">
              <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
                <input
                  value={form.grip_version}
                  onChange={e => setField('grip_version', e.target.value)}
                  style={{ flex: 1, borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                />
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  border: '0.5px solid var(--border-strong)', borderLeft: 'none',
                  borderTopRightRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)',
                  overflow: 'hidden', background: 'var(--bg-secondary)',
                }}>
                  <button type="button" onClick={() => setField('grip_version', stepGripVersion(form.grip_version, 'up'))}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--border-strong)', cursor: 'pointer', color: 'var(--text-secondary)', width: 28 }}>
                    <ChevronUp size={12} />
                  </button>
                  <button type="button" onClick={() => setField('grip_version', stepGripVersion(form.grip_version, 'down'))}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', width: 28 }}>
                    <ChevronDown size={12} />
                  </button>
                </div>
              </div>
            </Field>

            {/* Single sequence talent string -- collection sequences have per-sequence talent fields above */}
            {!collectionSequences && (
              <Field label="Talent string" hint="Paste your WoW talent import string so others can match your build.">
                <input
                  value={form.talent_string}
                  onChange={e => setField('talent_string', e.target.value)}
                  placeholder="Paste talent string..."
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />
              </Field>
            )}

            <Field label="Warcraft Logs URL">
              <input
                value={form.warcraftlogs_url}
                onChange={e => setField('warcraftlogs_url', e.target.value)}
                placeholder="https://www.warcraftlogs.com/reports/..."
                type="url"
              />
            </Field>

            <Field label="Performance notes" hint="Log data, uptime stats, DPS numbers, what was tested.">
              <textarea
                value={form.performance_notes}
                onChange={e => setField('performance_notes', e.target.value)}
                placeholder="e.g. Ironfur 86-95% uptime, 14-17 Mangle CPM, 13-16k sustained DPS. Tested on training dummy and LFR..."
                rows={4}
                style={{ resize: 'vertical' }}
              />
            </Field>
          </Section>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(196,30,58,0.08)', border: '0.5px solid rgba(196,30,58,0.2)',
              borderRadius: 'var(--radius-md)', padding: '10px 14px',
              color: '#c41e3a', fontSize: 13,
            }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: 'var(--accent)', color: 'white', border: 'none',
                borderRadius: 'var(--radius-md)', padding: '12px 24px',
                fontSize: 14, fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1, fontFamily: 'var(--font-sans)',
              }}
            >
              {submitting
                ? 'Publishing...'
                : isEditMode
                  ? 'Save changes'
                  : collectionSequences
                    ? 'Publish collection'
                    : 'Publish sequence'}
            </button>

            {isEditMode && (
              <button
                type="button"
                onClick={() => router.push(`/sequences/${editSlug}`)}
                disabled={submitting}
                style={{
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                  padding: '12px 20px', fontSize: 14, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Cancel
              </button>
            )}
          </div>

        </div>
      </form>
    </div>
  )
}

export default function PostPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 760, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading...</p>
      </div>
    }>
      <PostForm />
    </Suspense>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '20px',
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>
      )}
    </div>
  )
}
