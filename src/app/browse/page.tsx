'use client'
import { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import SequenceCard from '@/components/sequence/SequenceCard'
import { WOW_CLASSES, CONTENT_TYPES } from '@/lib/wow-data'
import { Sequence, SequenceFilters } from '@/types'
import { createClient } from '@/lib/supabase/client'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'top_rated', label: 'Top rated' },
  { value: 'most_viewed', label: 'Most viewed' },
  { value: 'most_saved', label: 'Most saved' },
]

export default function BrowsePage() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)
  const [filters, setFilters] = useState<SequenceFilters>({
    sort: 'recent', page: 1, limit: 20,
  })
  const [search, setSearch] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchSequences()
  }, [filters])

  async function fetchSequences() {
    setLoading(true)
    try {
      let query = supabase
        .from('sequences')
        .select('*, author:profiles(username, display_name, avatar_url)', { count: 'exact' })
        .eq('is_published', true)

      if (filters.class_id) query = query.eq('class_id', filters.class_id)
      if (filters.content_type) query = query.eq('content_type', filters.content_type)
      if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)

      switch (filters.sort) {
        case 'most_viewed': query = query.order('view_count', { ascending: false }); break
        case 'most_saved': query = query.order('save_count', { ascending: false }); break
        default: query = query.order('created_at', { ascending: false })
      }

      const from = ((filters.page || 1) - 1) * (filters.limit || 20)
      query = query.range(from, from + (filters.limit || 20) - 1)

      const { data, count: total } = await query
      setSequences(data || [])
      setCount(total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setFilters(f => ({ ...f, search, page: 1 }))
  }

  function setFilter(key: keyof SequenceFilters, value: any) {
    setFilters(f => ({ ...f, [key]: value, page: 1 }))
  }

  function clearFilters() {
    setFilters({ sort: 'recent', page: 1, limit: 20 })
    setSearch('')
  }

  const hasActiveFilters = filters.class_id || filters.content_type || filters.search

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px', display: 'flex', gap: 24 }}>

      {/* Sidebar filters */}
      <aside style={{
        width: 210,
        flexShrink: 0,
        position: 'sticky',
        top: 80,
        alignSelf: 'flex-start',
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Filters
            </span>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <X size={11} /> Clear
              </button>
            )}
          </div>

          {/* Content type */}
          <FilterSection title="Content">
            <FilterItem
              label="All"
              active={!filters.content_type}
              onClick={() => setFilter('content_type', undefined)}
            />
            {CONTENT_TYPES.map(ct => (
              <FilterItem
                key={ct.value}
                label={ct.label}
                active={filters.content_type === ct.value}
                onClick={() => setFilter('content_type', ct.value)}
              />
            ))}
          </FilterSection>

          {/* Class */}
          <FilterSection title="Class">
            <FilterItem
              label="All classes"
              active={!filters.class_id}
              onClick={() => setFilter('class_id', undefined)}
            />
            {WOW_CLASSES.map(cls => (
              <FilterItem
                key={cls.id}
                label={cls.name}
                active={filters.class_id === cls.id}
                onClick={() => setFilter('class_id', cls.id)}
                color={cls.color}
              />
            ))}
          </FilterSection>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Search bar */}
        <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)',
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sequences, authors, specs..."
              style={{
                width: '100%',
                height: 40,
                paddingLeft: 36,
                paddingRight: 16,
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </form>

        {/* Sort + count */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {loading ? '—' : `${count.toLocaleString()} sequences`}
          </span>
          <div style={{
            display: 'flex',
            gap: 2,
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            padding: 2,
          }}>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter('sort', opt.value)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: filters.sort === opt.value ? 'var(--bg-primary)' : 'transparent',
                  color: filters.sort === opt.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: filters.sort === opt.value ? 500 : 400,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sequence list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: 120,
                background: 'var(--bg-primary)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                opacity: 0.6,
              }} />
            ))}
          </div>
        ) : sequences.length === 0 ? (
          <div style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              No sequences found. Try adjusting your filters or be the first to post one!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sequences.map(seq => <SequenceCard key={seq.id} sequence={seq} />)}
          </div>
        )}

        {/* Pagination */}
        {count > (filters.limit || 20) && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginTop: 24,
          }}>
            <button
              onClick={() => setFilter('page', Math.max(1, (filters.page || 1) - 1))}
              disabled={(filters.page || 1) <= 1}
              style={{
                padding: '6px 14px',
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-primary)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              Page {filters.page || 1}
            </span>
            <button
              onClick={() => setFilter('page', (filters.page || 1) + 1)}
              disabled={((filters.page || 1) * (filters.limit || 20)) >= count}
              style={{
                padding: '6px 14px',
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-primary)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function FilterItem({ label, active, onClick, color }: {
  label: string; active: boolean; onClick: () => void; color?: string
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 7,
      width: '100%', textAlign: 'left',
      padding: '5px 8px',
      borderRadius: 'var(--radius-sm)',
      border: 'none',
      background: active ? 'var(--accent-subtle)' : 'transparent',
      color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: active ? 500 : 400,
      fontFamily: 'var(--font-sans)',
    }}>
      {color && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: color, flexShrink: 0,
          border: color === '#FFFFFF' ? '1px solid var(--border)' : 'none',
        }} />
      )}
      {label}
    </button>
  )
}
