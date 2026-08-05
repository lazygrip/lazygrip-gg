'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import SequenceCard from '@/components/sequence/SequenceCard'
import { WOW_CLASSES, CONTENT_TYPES } from '@/lib/wow-data'
import { Sequence, SequenceFilters } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { BROWSE_PAGE_SIZE, browseFilterKey, buildBrowseQuery } from '@/lib/browse-query'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'top_rated', label: 'Top rated' },
  { value: 'most_viewed', label: 'Most viewed' },
  { value: 'most_saved', label: 'Most saved' },
]

interface Props {
  initialFilters?: Partial<SequenceFilters>
  heading?: string
  initialSequences?: Sequence[]
  initialCount?: number
  initialCurrentPatch?: string | null
  initialFilterKey?: string
}

export default function BrowseContent({
  initialFilters = {},
  heading,
  initialSequences,
  initialCount,
  initialCurrentPatch,
  initialFilterKey,
}: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [sequences, setSequences] = useState<Sequence[]>(initialSequences ?? [])
  const [loading, setLoading] = useState(initialSequences == null)
  const [count, setCount] = useState(initialCount ?? 0)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [currentPatch, setCurrentPatch] = useState<string | null>(initialCurrentPatch ?? null)

  // The filter key the sequences currently on screen were fetched with. Seeded with the server's
  // key when the server delivered data, undefined when it did not (then the client must fetch).
  const [displayedKey, setDisplayedKey] = useState<string | undefined>(
    initialSequences != null ? initialFilterKey : undefined
  )
  // The last server key adopted, so each distinct server payload is adopted exactly once.
  const [adoptedServerKey, setAdoptedServerKey] = useState<string | undefined>(
    initialSequences != null ? initialFilterKey : undefined
  )
  // Mirrors the URL's search value so back/forward can update the input without clobbering typing.
  const [lastUrlSearch, setLastUrlSearch] = useState(searchParams.get('search') || '')

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  // Monotonic id so a slow fetch that has been superseded cannot overwrite newer results.
  const fetchSeqRef = useRef(0)

  // Adopt the server's data whenever the server's filter key changes. Both browse routes are
  // force-dynamic, so a same-route filter change re-renders the server component and delivers a
  // fresh initialSequences plus a fresh initialFilterKey. useState initialisers never re-run and
  // the instance is reused, so without this the fresh server data is silently discarded and the
  // list keeps rendering the previous filter's cards. This is React's documented
  // adjust-state-during-render pattern: the guard turns false the moment the keys match, so it
  // settles in one extra render pass and cannot loop.
  if (initialSequences != null && initialFilterKey !== adoptedServerKey) {
    setAdoptedServerKey(initialFilterKey)
    setDisplayedKey(initialFilterKey)
    setSequences(initialSequences)
    setCount(initialCount ?? 0)
    setLoading(false)
  }

  // Same class of defect on the search input: its useState initialiser never re-runs either, so a
  // back/forward that changes ?search would leave stale text in the box. Keyed on the URL value
  // rather than on every render, so typing (which does not touch the URL) is never clobbered.
  const urlSearch = searchParams.get('search') || ''
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch)
    setSearch(urlSearch)
  }

  // Merge URL params with initialFilters — initialFilters are the baseline from the slug route,
  // URL params take precedence when they exist (e.g. after user interaction or back button)
  const filters: SequenceFilters = {
    sort: (searchParams.get('sort') || 'recent') as SequenceFilters['sort'],
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: BROWSE_PAGE_SIZE,
    content_type: (searchParams.get('content_type') || initialFilters.content_type || undefined) as SequenceFilters['content_type'],
    class_id: searchParams.get('class_id') ? Number(searchParams.get('class_id')) : initialFilters.class_id,
    spec_id: searchParams.get('spec_id') ? Number(searchParams.get('spec_id')) : undefined,
    search: searchParams.get('search') || undefined,
  }

  function updateUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    if (!('page' in updates)) {
      params.delete('page')
    }
    const query = params.toString()
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
  }

  const filterKey = browseFilterKey(filters)

  // Fetch only when the live filters differ from the filters the DISPLAYED data came from. The
  // previous one-shot fetch-latch ref could not tell "the server already has this" from "the
  // server has something else" after the first render, so it returned early forever.
  useEffect(() => {
    if (filterKey === displayedKey) {
      // What is on screen already matches the live filters, so any client fetch still in flight
      // is stale by definition. This is the path a server adoption lands on, and bumping here is
      // what stops a slow pre-adoption fetch from overwriting the server's newer data.
      fetchSeqRef.current++
      return
    }
    fetchSequences(filterKey, filters)
  }, [filterKey, displayedKey])

  // Fetch the site-wide current patch once on mount. Not re-fetched per filter change —
  // this value changes rarely (only when admin updates it) so one fetch per page load is enough.
  useEffect(() => {
    if (initialCurrentPatch !== undefined) return
    fetchCurrentPatch()
  }, [])

  async function fetchCurrentPatch() {
    try {
      const { data, error } = await supabase
        .from('site_config')
        .select('current_patch')
        .single()
      if (error) {
        console.error('Failed to fetch current_patch:', error)
        return
      }
      setCurrentPatch(data?.current_patch ?? null)
    } catch (e) {
      console.error(e)
    }
  }

  async function fetchSequences(keyForThisFetch: string, filtersForThisFetch: SequenceFilters) {
    const fetchId = ++fetchSeqRef.current
    setLoading(true)
    try {
      const query = buildBrowseQuery(supabase, filtersForThisFetch)
      const { data, count: total } = await query
      // A newer fetch started while this one was in flight; its result wins.
      if (fetchId !== fetchSeqRef.current) return
      setSequences(data || [])
      setCount(total || 0)
      setDisplayedKey(keyForThisFetch)
    } catch (e) {
      if (fetchId !== fetchSeqRef.current) return
      console.error(e)
    } finally {
      if (fetchId === fetchSeqRef.current) setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    updateUrl({ search: search || undefined })
  }

  function selectClass(classId: number | undefined) {
    setShowMobileFilters(false)
    const newId = filters.class_id === classId ? undefined : classId
    if (!newId) {
      // Deselecting or All classes — escape the slug route entirely
      router.push('/browse', { scroll: false })
    } else if (newId !== filters.class_id) {
      // Different class — navigate to its slug route
      const cls = WOW_CLASSES.find(c => c.id === newId)
      if (cls) router.push(`/browse/${cls.slug}`, { scroll: false })
    }
    // Clicking same class (toggle off) is handled by newId being undefined above
  }

  function selectSpec(specId: number) {
    const newId = filters.spec_id === specId ? undefined : specId
    updateUrl({ spec_id: newId ? String(newId) : undefined })
    setShowMobileFilters(false)
  }

  function selectContentType(value: string | undefined) {
    setShowMobileFilters(false)
    // On a content-type hub the slug carries the filter, so changing or clearing it has to move
    // routes, exactly as selectClass does for classes. Staying on the same path made "All" a dead
    // control: it deleted a query parameter that was not filtering anything, and initialFilters
    // immediately restored the hub's own type. Measured on production 2026-07-29: /browse/raid,
    // click All, card set unchanged at 1. Sort and search are carried across; they are not part
    // of the content filter.
    if (initialFilters.content_type) {
      const params = new URLSearchParams()
      if (filters.sort && filters.sort !== 'recent') params.set('sort', filters.sort)
      if (filters.search) params.set('search', filters.search)
      const query = params.toString()
      const target = value ? CONTENT_TYPES.find(ct => ct.value === value) : undefined
      const path = target ? `/browse/${target.slug}` : '/browse'
      router.push(`${path}${query ? `?${query}` : ''}`, { scroll: false })
      return
    }
    updateUrl({ content_type: value })
  }

  function clearFilters() {
    // Close the sheet like every other control in the panel. On /browse the push below is
    // same-route, so no remount closes it as a side effect; this has to be explicit.
    setShowMobileFilters(false)
    setSearch('')
    const params = new URLSearchParams()
    if (filters.sort && filters.sort !== 'recent') params.set('sort', filters.sort)
    const query = params.toString()
    // Clear has to escape the slug route as well. On /browse/druid the slug itself carries the
    // class filter, so pushing pathname left the class applied while the control said "Clear".
    // Measured 2026-07-29: spec_id dropped from the URL, card set unchanged at 1.
    router.push(`/browse${query ? `?${query}` : ''}`, { scroll: false })
  }

  const hasActiveFilters = filters.class_id || filters.content_type || filters.search || filters.spec_id

  const filterPanel = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Filters
        </span>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <X size={11} /> Clear
          </button>
        )}
      </div>
      <FilterSection title="Content">
        <FilterItem label="All" active={!filters.content_type} onClick={() => selectContentType(undefined)} />
        {CONTENT_TYPES.map(ct => (
          <FilterItem key={ct.value} label={ct.label} active={filters.content_type === ct.value} onClick={() => selectContentType(ct.value)} />
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
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Filters</span>
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
          {heading && (
            <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 12px', color: 'var(--text-primary)' }}>
              {heading}
            </h1>
          )}
          <form onSubmit={handleSearch} style={{ marginBottom: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search sequences, authors, specs..."
                style={{ width: '100%', height: 40, paddingLeft: 36, paddingRight: 16, border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </div>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{loading ? '-' : `${count.toLocaleString()} sequences`}</span>
              <button className="mobile-filter-btn" onClick={() => setShowMobileFilters(true)}>
                <SlidersHorizontal size={13} />
                Filters
                {hasActiveFilters && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />}
              </button>
            </div>
            <div className="sort-bar" style={{ display: 'flex', gap: 2, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 2 }}>
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => updateUrl({ sort: opt.value })} style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: filters.sort === opt.value ? 'var(--bg-primary)' : 'transparent', color: filters.sort === opt.value ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: filters.sort === opt.value ? 500 : 400, fontFamily: 'var(--font-sans)' }}>
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
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>No sequences found. Try adjusting your filters or be the first to post one!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sequences.map(seq => <SequenceCard key={seq.id} sequence={seq} currentPatch={currentPatch} />)}
            </div>
          )}

          {count > (filters.limit || 20) && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button onClick={() => updateUrl({ page: String(Math.max(1, (filters.page || 1) - 1)) })} disabled={(filters.page || 1) <= 1} style={{ padding: '6px 14px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Previous</button>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>Page {filters.page || 1}</span>
              <button onClick={() => updateUrl({ page: String((filters.page || 1) + 1) })} disabled={((filters.page || 1) * (filters.limit || 20)) >= count} style={{ padding: '6px 14px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Next</button>
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
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{title}</div>
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
