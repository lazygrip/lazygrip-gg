'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WOW_CLASSES, CONTENT_TYPES, STEP_FUNCTIONS, slugify } from '@/lib/wow-data'
import { AlertCircle } from 'lucide-react'
import TiptapEditor from '@/components/editor/TiptapEditor'

const GRIP_VERSIONS = ['1.9.10', '2.0', '2.0.1']
const PATCH_VERSIONS = ['12.0', '12.0.5', '12.0.7']

const EMPTY_FORM = {
  title: '',
  description: '',
  class_id: '',
  spec_name: '',
  content_type: 'mythic_plus',
  hero_talent: '',
  patch_version: '12.0.5',
  grip_version: '2.0.1',
  step_function: 'Sequential',
  grip_string: '',
  raw_steps_text: '',
  talent_string: '',
  warcraftlogs_url: '',
  performance_notes: '',
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
        raw_steps_text = data.raw_steps.map((s: any) =>
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
        grip_version: data.grip_version ?? '2.0.1',
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

    if (!form.title || !form.class_id || !form.content_type) {
      setError('Title, class, and content type are required.')
      return
    }

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const raw_steps = parseSteps(form.raw_steps_text)
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
        const { error: updateError } = await supabase
          .from('sequences')
          .update(payload)
          .eq('id', editId)
          .eq('author_id', user.id)

        if (updateError) throw updateError
        router.push(`/sequence/${editSlug}`)
      } else {
        const slug = slugify(form.title) + '-' + Date.now().toString(36)
        const { data, error: insertError } = await supabase
          .from('sequences')
          .insert({ ...payload, author_id: user.id, slug, is_published: true })
          .select('slug')
          .single()

        if (insertError) throw insertError
        if (data) router.push(`/sequence/${data.slug}`)
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
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

          <Section title="Basic info">
            <Field label="Sequence title *">
              <input
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder="e.g. Slowdog's Guardian Druid DotC M+ V14"
                required
              />
            </Field>

            <Field
              label="Description"
              hint="Use the toolbar for headings, lists, code blocks, and links. Keyboard shortcuts work too (Ctrl+B, Ctrl+I)."
            >
              <TiptapEditor
                content={form.description}
                onChange={(html) => setField('description', html)}
                placeholder="Describe your sequence — build, talents, key modifiers, what it's optimised for..."
              />
            </Field>
          </Section>

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
          </Section>

          <Section title="Sequence data">
            <Field label="GRIP export string" hint="Export from GRIP-EMS using the Export button, then paste here. Users will copy this to import directly.">
              <textarea
                value={form.grip_string}
                onChange={e => setField('grip_string', e.target.value)}
                placeholder="Paste your GRIP1 export string here..."
                rows={4}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
              />
            </Field>

            <Field
              label="Steps (plain text)"
              hint="Paste your steps one per line for display on the site. Users can read these without importing."
            >
              <textarea
                value={form.raw_steps_text}
                onChange={e => setField('raw_steps_text', e.target.value)}
                placeholder={`/targetenemy [noharm][dead]\n/cast [noform:1] Bear Form\n/cast Mangle`}
                rows={8}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
              />
            </Field>

            <Field label="GRIP version" hint="Which version of GRIP-EMS was this sequence built with?">
              <select value={form.grip_version} onChange={e => setField('grip_version', e.target.value)}>
                {GRIP_VERSIONS.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Optional extras">
            <Field label="Talent string" hint="Paste your WoW talent import string so others can match your build.">
              <input
                value={form.talent_string}
                onChange={e => setField('talent_string', e.target.value)}
                placeholder="Paste talent string..."
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
              />
            </Field>

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
                background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 'var(--radius-md)',
                padding: '12px 24px', fontSize: 14, fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {submitting
                ? (isEditMode ? 'Saving...' : 'Publishing...')
                : (isEditMode ? 'Save changes' : 'Publish sequence')}
            </button>

            {isEditMode && (
              <button
                type="button"
                onClick={() => router.push(`/sequence/${editSlug}`)}
                disabled={submitting}
                style={{
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 20px', fontSize: 14,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
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
      background: 'var(--bg-primary)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
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

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
        marginBottom: 5,
      }}>
        {label}
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
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>
      )}
    </div>
  )
}
