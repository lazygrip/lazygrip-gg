'use client'
import { useEffect, useMemo, useState } from 'react'
import InlineMd from './InlineMd'
import type { ArchivedRelease } from '@/lib/changelog/ems-archive'
import type { EmsItem } from '@/lib/changelog/ems'
import { groupByArea, matches } from '@/lib/changelog/areas'

const TYPE_COLOR: Record<string, string> = {
  Added: 'var(--accent)',
  Changed: 'var(--text-secondary)',
  Fixed: 'var(--text-muted)',
  Removed: 'var(--text-muted)',
}

const muted = { fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' } as const

function Entry({ item, id, color }: { item: EmsItem; id: string; color: string }) {
  return (
    <div id={id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, scrollMarginTop: 90 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 8 }} />
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, minWidth: 0 }}>
        {item.lead ? (
          <>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              <InlineMd text={item.lead} />{' '}
              <a href={`#${id}`} aria-label="Link to this entry" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 400 }}>#</a>
            </div>
            {item.body && <div style={{ marginTop: 2 }}><InlineMd text={item.body} /></div>}
          </>
        ) : (
          <InlineMd text={item.markdown} />
        )}
      </div>
    </div>
  )
}

// One release, with the totals up top, a filter box, and long sections sorted by area.
export default function ReleaseView({ release }: { release: ArchivedRelease }) {
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''

  // A link to an entry inside a folded area has to open that area before it can scroll there.
  useEffect(() => {
    const reveal = () => {
      const el = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null
      if (!el) return
      for (let n: HTMLElement | null = el; n; n = n.parentElement) if (n instanceof HTMLDetailsElement) n.open = true
      el.scrollIntoView()
    }
    reveal()
    window.addEventListener('hashchange', reveal)
    return () => window.removeEventListener('hashchange', reveal)
  }, [])

  const sections = useMemo(
    () =>
      release.sections.map((section, si) => {
        const kept = section.items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => matches(item, query))
        return { section, si, kept }
      }),
    [release, query],
  )
  const total = sections.reduce((n, s) => n + s.kept.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {release.sections.filter(s => s.items.length).map(s => (
          <a key={s.title} href={`#sec-${s.title.toLowerCase().replace(/\W+/g, '-')}`}
            style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '6px 12px', borderRadius: 99, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)', textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: TYPE_COLOR[s.title] ?? 'var(--text-secondary)' }}>{s.items.length}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{s.title}</span>
          </a>
        ))}
      </div>

      <div>
        <label htmlFor="ems-filter" style={{ position: 'absolute', left: -9999 }}>Filter this release</label>
        <input
          id="ems-filter" type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder={`Filter the ${sections.reduce((n, s) => n + s.section.items.length, 0)} entries in this release`}
          style={{ width: '100%', padding: '9px 12px', fontSize: 'var(--text-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '0.5px solid var(--border-strong)', borderRadius: 8 }}
        />
        {searching && (
          <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {total === 0 ? 'No entries match.' : `${total} ${total === 1 ? 'entry matches' : 'entries match'}.`}
          </p>
        )}
      </div>

      {release.intro && !searching && (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}><InlineMd text={release.intro} /></div>
      )}

      {sections.filter(s => s.kept.length > 0).map(({ section, si, kept }) => {
        const color = TYPE_COLOR[section.title] ?? 'var(--text-muted)'
        const idFor = (index: number) => `${section.title.toLowerCase().replace(/\W+/g, '-')}-${index + 1}`
        // Area grouping works on the whole section so a filter never reshuffles the groups.
        const groups = searching ? null : groupByArea(section.items)
        return (
          <section key={si} id={`sec-${section.title.toLowerCase().replace(/\W+/g, '-')}`} style={{ scrollMarginTop: 90 }}>
            <div style={muted}>{section.title} <span style={{ fontWeight: 400 }}>({searching ? `${kept.length} of ${section.items.length}` : section.items.length})</span></div>
            {groups ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Sorted by area by LazyGrip. Every entry is the author&apos;s own wording.
                </p>
                {groups.map((g, gi) => (
                  <details key={g.area} open={gi === 0} style={{ border: '0.5px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {g.area} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({g.items.length})</span>
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                      {g.items.map(({ item, index }) => <Entry key={index} item={item} id={idFor(index)} color={color} />)}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                {kept.map(({ item, index }) => <Entry key={index} item={item} id={idFor(index)} color={color} />)}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
