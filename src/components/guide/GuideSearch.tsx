'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { GUIDE_SEARCH_INDEX, type GuideSearchEntry } from '@/lib/guide-search-index'

const MAX_RESULTS = 8
const SNIPPET_RADIUS = 60

type Match = {
  entry: GuideSearchEntry
  // Where the query matched, for ranking (title first) and for deciding whether to
  // show a snippet at all -- a title match doesn't need one, the term is already
  // visible in the result's own heading.
  inTitle: boolean
  snippet: { pre: string; hit: string; post: string } | null
}

function findSnippet(body: string, query: string): Match['snippet'] {
  const idx = body.toLowerCase().indexOf(query)
  if (idx === -1) return null
  const start = Math.max(0, idx - SNIPPET_RADIUS)
  const end = Math.min(body.length, idx + query.length + SNIPPET_RADIUS)
  return {
    pre: (start > 0 ? '…' : '') + body.slice(start, idx),
    hit: body.slice(idx, idx + query.length),
    post: body.slice(idx + query.length, end) + (end < body.length ? '…' : ''),
  }
}

function search(query: string): Match[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const matches: Match[] = []
  for (const entry of GUIDE_SEARCH_INDEX) {
    const inTitle = entry.section.toLowerCase().includes(q) || entry.pageTitle.toLowerCase().includes(q)
    const inBody = entry.body.toLowerCase().includes(q)
    if (!inTitle && !inBody) continue
    matches.push({
      entry,
      inTitle,
      // Skip the snippet when the title itself already shows the match -- repeating
      // it as a body excerpt too just adds noise to a short dropdown row.
      snippet: inTitle ? null : findSnippet(entry.body, q),
    })
  }

  // Title/section hits first (someone typing "keybind" almost certainly wants the
  // section named Keybind Conflicts before a section that happens to mention the
  // word once in a paragraph). Stable otherwise -- Array.prototype.sort is stable
  // per spec, so ties keep the index's page order.
  matches.sort((a, b) => Number(b.inTitle) - Number(a.inTitle))
  return matches.slice(0, MAX_RESULTS)
}

export default function GuideSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // GUIDE_SEARCH_INDEX is 55 entries with full section text, still small enough
  // (well under 100KB) that a plain linear scan on every keystroke is not worth
  // debouncing or memoizing beyond the query itself.
  const results = useMemo(() => search(query), [query])

  function goTo(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', marginTop: 14 }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false) }
            if (e.key === 'Enter' && results[0]) { goTo(results[0].entry.href) }
          }}
          placeholder="Search the guide"
          aria-label="Search the guide"
          style={{
            width: '100%', height: 32, paddingLeft: 28, paddingRight: query ? 26 : 10,
            border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-xs)', background: 'var(--bg-primary)', color: 'var(--text-primary)',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            aria-label="Clear search"
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', padding: 2, cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          width: 300,
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          overflow: 'hidden', zIndex: 200,
        }}>
          {results.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              No matches in the guide.
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {results.map((m, i) => (
                <Link
                  key={m.entry.href}
                  href={m.entry.href}
                  onClick={() => { setOpen(false); setQuery('') }}
                  style={{
                    display: 'block', padding: '9px 14px',
                    borderBottom: i < results.length - 1 ? '0.5px solid var(--border)' : 'none',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500, marginBottom: 1 }}>
                    {m.entry.section}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {m.entry.pageTitle}
                  </div>
                  {m.snippet && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                      {m.snippet.pre}
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{m.snippet.hit}</span>
                      {m.snippet.post}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
