'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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

interface Props {
  initialFilters?: Partial<SequenceFilters>
}

export default function BrowseContent({ initialFilters = {} }: Props) {
  const searchParams = useSearchParams()

  const sortFromUrl = (searchParams.get('sort') || 'recent') as SequenceFilters['sort']
  const contentTypeFromUrl = (searchParams.get('content_type') || undefined) as SequenceFilters['content_type']
  const classIdFromUrl = searchParams.get('class_id') ? Number(searchParams.get('class_id')) : undefined

  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)
  const [filters, setFilters] = useState<SequenceFilters>({
    sort: sortFromUrl,
    page: 1,
    limit: 20,
    content_type: contentTypeFromUrl,
    class_id: classIdFromUrl,
    spec_id: undefined,
  })
  const [search, setSearch] = useState('')
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const supabase = createClient()

  // Sync filters when URL params change (e.g. nav between Browse and Top Rated)
  useEffect(() => {
    setFilters(f => ({
      ...f,
      sort: sortFromUrl,
      content_type: contentTypeFromUrl,
      class_id: classIdFromUrl,
      spec_id: undefined,
      page: 1,
    }))
    setSearch('')
  }, [sortFromUrl, contentTypeFromUrl, classIdFromUrl])

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
      if (filters.spec_id) query = query.eq('spec_id', filters.spec_id)
      if (filters.content_type) query = query.eq('content_type', filters.content_type)
      if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)

      switch (filters.sort) {
        case 'top_rated':
          query = query.gt('rating_count', 0).order('avg_score', { ascending: false }).order('rating_count', { ascending: false })
          break
        case 'most_viewed':
          query = query.order('view_count', { ascending: false })
          break
        case 'most_saved':
          query = query.order('save_count', { ascending: false })
          break
        default:
          query = query.order('created_at', { ascending: false })
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

  function selectClass(classId: number | undefined) {
  const newId = filters.class_id === classId ? undefined : classId
  setFilters(f => ({ ...f, class_id: newId, spec_id: undefined, page: 1 }))
  setShowMobileFilters(false)
}

  function selectSpec(specId: number) {
    setFilters(f => ({ ...f, spec_id: f.spec_id === specId ? undefined : specId, page: 1 }))
    setShowMobileFilters(false)
  }

  function clearFilters() {
    setFilters({
      sort: sortFromUrl,
      page: 1,
      limit: 20,
      content_type: contentTypeFromUrl,
      class_id: classIdFromUrl,
      spec_id: undefined,
    })
    setSearch('')
  }

  const hasActiveFilters = filters.class_id || filters.content_type || filters.search || filters.spec_id

  const filterPanel = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Filters
        </span>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <X size={11} /> Clear
          </button>
        )}
      </div>
      <FilterSection title="Content">
        <FilterItem label="All" active={!filters.content_type} onClick={() => { setFilter('content_type', undefined); setShowMobileFilters(false) }} />
        {CONTENT_TYPES.map(ct => (
          <FilterItem key={ct.value} label={ct.label} active={filters.content_type === ct.value} onClick={() => { setFilter('content_type', ct.value); setShowMobileFilters(false) }} />
        ))}
      </FilterSection>
      <FilterSection title="Class">
        <FilterItem label="All classes" active={!filters.class_id} onClick={() => selectClass(undefined)} />
        {WOW_CLASSES.map(cls => (
          <div key={cls.id}>
            <FilterItem
              label={cls.name}
              active={filters.class_id === cls.id && !filters.spec_id}
              onClick={() => selectClass(cls.id)}
              color={cls.color}
            />
            {filters.class_id === cls.id && cls.specs.length > 0 && (
              <div style={{ marginLeft: 14, marginTop: 1, marginBottom: 2, borderLeft: `1.5px solid ${cls.color}30`, paddingLeft: 8 }}>
                {cls.specs.map(spec => (
                  <FilterItem
                    key={spec.id}
                    label={spec.name}
                    active={filters.spec_id === spec.id}
                    onClick={() => selectSpec(spec.id)}
                    indent
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </FilterSection>
    </div>
  )

  return (
    <>
      <style>{`
        .browse-layout { max-width: 1200px; margin: 0 auto; padding: 24px; display: flex; gap: 24px; }
        .browse-sidebar { width: 210px; flex-shrink: 0; position: sticky; top: 80px; align-self: flex-start; }
        .browse-main { flex: 1; min-width: 0; }
        .mobile-filter-btn { display: none; }
        .mobile-filter-sheet { display: none; }
        @media (max-width: 640px) {
          .browse-layout { padding: 16px; flex-direction: column; gap: 12px; }
          .browse-sidebar { display: none; }
          .mobile-filter-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: 0.5px solid var(--border-strong); background: var(--bg-primary); color: var(--text-secondary); font-size: 13px; cursor: pointer; font-family: var(--font-sans); border-radius: 8px; }
          .mobile-filter-sheet { display: block; position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.5); }
          .mobile-filter-inner { position: absolute; bottom: 0; left: 0; right: 0; background: var(--bg-primary); border-radius: 16px 16px 0 0; padding: 20px 20px 40px; max-height: 80vh; overflow-y: auto; }
          .sort-bar { flex-wrap: wrap; gap: 4px !important; }
          .sort-bar button { font-size: 11px !important; padding: 4px 8px !important; }
        }
      `}</style>

      {showMobileFilters && (
        <div className="mobile-filter-sheet" onClick={() => setShowMobileFilters(false)}>
          <div className="mobile-filter-inner" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Filters</span>
              <button onClick={() => setShowMobileFilters(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      )}

      <div className="browse-layout">
        <aside className="browse-sidebar">{filterPanel}</aside>
        <div className="browse-main">
          <form onSubmit={handleSearch} style={{ marginBottom: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search sequences, authors, specs..."
                style={{ width: '100%', height: 40, paddingLeft: 36, paddingRight: 16, border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </div>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{loading ? '-' : `${count.toLocaleString()} sequences`}</span>
              <button className="mobile-filter-btn" onClick={() => setShowMobileFilters(true)}>
                <SlidersHorizontal size={13} />
                Filters
                {hasActiveFilters && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />}
              </button>
            </div>
            <div className="sort-bar" style={{ display: 'flex', gap: 2, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 2 }}>
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setFilter('sort', opt.value)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: filters.sort === opt.value ? 'var(--bg-primary)' : 'transparent', color: filters.sort === opt.value ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: filters.sort === opt.value ? 500 : 400, fontFamily: 'var(--font-sans)' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ height: 120, background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', opacity: 0.6 }} />
              ))}
            </div>
          ) : sequences.length === 0 ? (
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No sequences found. Try adjusting your filters or be the first to post one!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sequences.map(seq => <SequenceCard key={seq.id} sequence={seq} />)}
            </div>
          )}

          {count > (filters.limit || 20) && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button onClick={() => setFilter('page', Math.max(1, (filters.page || 1) - 1))} disabled={(filters.page || 1) <= 1} style={{ padding: '6px 14px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Previous</button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>Page {filters.page || 1}</span>
              <button onClick={() => setFilter('page', (filters.page || 1) + 1)} disabled={((filters.page || 1) * (filters.limit || 20)) >= count} style={{ padding: '6px 14px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Next</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )
}

function FilterItem({ label, active, onClick, color, indent }: { label: string; active: boolean; onClick: () => void; color?: string; indent?: boolean }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: indent ? '4px 8px' : '5px 8px', borderRadius: 'var(--radius-sm)', border: 'none', background: active ? 'var(--accent-subtle)' : 'transparent', color: active ? 'var(--accent-text)' : indent ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: indent ? 12 : 13, fontWeight: active ? 500 : 400, fontFamily: 'var(--font-sans)' }}>
      {color && <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, border: color === '#FFFFFF' ? '1px solid var(--border)' : 'none' }} />}
      {label}
    </button>
  )
}
