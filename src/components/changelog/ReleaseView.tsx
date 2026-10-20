'use client'
import { useEffect, useMemo, useState } from 'react'
import { Bug, FlaskConical, Gamepad2, Keyboard, Languages, Layers, Package, RotateCcw, Save, Sparkles, Stethoscope, Swords, Trash2, Wrench, Info, type LucideIcon } from 'lucide-react'
import InlineMd, { InlineText } from './InlineMd'
import type { ArchivedRelease } from '@/lib/changelog/ems-archive'
import type { EmsItem } from '@/lib/changelog/ems'
import { AREA_ORDER, areaIndex, groupByArea, matches } from '@/lib/changelog/areas'
import { toneOf } from '@/lib/changelog/tone'

const TONE_ICON: Record<string, LucideIcon> = { added: Sparkles, changed: Wrench, removed: Trash2, fixed: Bug, other: Info }
const AREA_ICON: LucideIcon[] = [Languages, Gamepad2, RotateCcw, Stethoscope, FlaskConical, Package, Keyboard, Swords, Save, Layers]
const slug = (s: string) => s.toLowerCase().replace(/\W+/g, '-')

function Body({ item, id }: { item: EmsItem; id: string }) {
  const anchor = <a href={`#${id}`} className="cl-anchor" aria-label="Link to this entry">#</a>
  return item.lead ? (
    <>
      <div className="cl-lead"><InlineText text={item.lead} />{anchor}</div>
      {item.body && <div style={{ marginTop: 2 }}><InlineMd text={item.body} /></div>}
    </>
  ) : (
    <>
      <InlineMd text={item.markdown} />
      {anchor}
    </>
  )
}

function Entry({ item, id }: { item: EmsItem; id: string }) {
  return (
    <div id={id} className="cl-entry">
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65, minWidth: 0 }}>
        <Body item={item} id={id} />
      </div>
    </div>
  )
}

export default function ReleaseView({ release }: { release: ArchivedRelease }) {
  const [query, setQuery] = useState('')
  const [area, setArea] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const searching = query.trim() !== ''

  // An entry link into a folded area has to open that area before it can scroll there.
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
      release.sections.map(section => ({
        section,
        tone: toneOf(section.title),
        groups: groupByArea(section.items),
        kept: section.items.map((item, index) => ({ item, index })).filter(({ item }) => matches(item, query)),
      })),
    [release, query],
  )
  const total = sections.reduce((n, s) => n + s.kept.length, 0)

  // Area chips: every area that appears in any long section, with how many entries it holds.
  const chipCounts = new Map<string, number>()
  for (const s of sections) for (const g of s.groups ?? []) chipCounts.set(g.area, (chipCounts.get(g.area) ?? 0) + g.items.length)
  const chips = AREA_ORDER.filter(a => chipCounts.has(a))
  const hasGroups = chips.length > 0

  return (
    <div>
      <h2 style={{ margin: '36px 0 4px', fontSize: 'var(--text-lg)', fontWeight: 600 }}>Every entry</h2>
      <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        The author&apos;s own words, complete. Long sections are sorted into areas by LazyGrip.
      </p>

      <label htmlFor="ems-filter" style={{ position: 'absolute', left: -9999 }}>Filter this release</label>
      <input id="ems-filter" className="cl-field" type="search" value={query} onChange={e => setQuery(e.target.value)}
        placeholder={`Filter the ${release.sections.reduce((n, s) => n + s.items.length, 0)} entries in this release`} />
      {searching && (
        <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {total === 0 ? 'No entries match.' : `${total} ${total === 1 ? 'entry matches' : 'entries match'}.`}
        </p>
      )}

      {hasGroups && !searching && (
        <div role="group" aria-label="Filter by area" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0 0' }}>
          {chips.map(a => (
            <button key={a} type="button" className={`cl-chip cl-a-${areaIndex(a)}`} aria-pressed={area === a} onClick={() => setArea(area === a ? null : a)}>
              {a} <small>{chipCounts.get(a)}</small>
            </button>
          ))}
          {area && <button type="button" className="cl-btn" onClick={() => setArea(null)}>Show all</button>}
          {!area && <button type="button" className="cl-btn" onClick={() => setExpanded(e => !e)}>{expanded ? 'Collapse all' : 'Expand all'}</button>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 24 }}>
        {sections.filter(s => s.kept.length > 0).map(({ section, tone, groups, kept }) => {
          const Icon = TONE_ICON[tone]
          const idFor = (index: number) => `${slug(section.title)}-${index + 1}`
          const shown = groups && !searching ? groups.filter(g => !area || g.area === area) : null
          if (groups && !searching && shown!.length === 0) return null
          return (
            <section key={section.title} id={`sec-${slug(section.title)}`} className={`cl-t-${tone}`} style={{ scrollMarginTop: 90 }}>
              <div className="cl-head" style={{ marginBottom: 12 }}>
                <span className="cl-ico"><Icon size={16} strokeWidth={2.2} aria-hidden /></span>
                <h3 className="cl-h3" style={{ fontSize: 'var(--text-md, 1.05rem)' }}>{section.title}</h3>
                <span className="cl-pill">{searching ? `${kept.length} of ${section.items.length}` : section.items.length}</span>
              </div>
              {shown ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {shown.map((g, gi) => {
                    const AIcon = AREA_ICON[areaIndex(g.area)] ?? Layers
                    return (
                      <details key={g.area} className={`cl-area cl-a-${areaIndex(g.area)}`} open={expanded || !!area || gi === 0}>
                        <summary>
                          <span className="cl-ico"><AIcon size={15} strokeWidth={2.2} aria-hidden /></span>
                          <span className="cl-h3">{g.area}</span>
                          <span className="cl-pill">{g.items.length}</span>
                        </summary>
                        <div className="cl-entries">
                          {g.items.map(({ item, index }) => <Entry key={index} item={item} id={idFor(index)} />)}
                        </div>
                      </details>
                    )
                  })}
                </div>
              ) : searching ? (
                <div className="cl-card"><div className="cl-entries" style={{ padding: 0 }}>
                  {kept.map(({ item, index }) => <Entry key={index} item={item} id={idFor(index)} />)}
                </div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {kept.map(({ item, index }) => (
                    <article key={index} id={idFor(index)} className="cl-card" style={{ scrollMarginTop: 90 }}>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                        <Body item={item} id={idFor(index)} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
