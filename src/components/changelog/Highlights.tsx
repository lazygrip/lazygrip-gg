import { Keyboard, Map as MapIcon, RotateCcw, Save, Trash2, type LucideIcon } from 'lucide-react'
import InlineMd from './InlineMd'
import type { Highlight } from '@/data/ems-highlights'

const ICONS: Record<Highlight['icon'], LucideIcon> = {
  keyboard: Keyboard,
  rotate: RotateCcw,
  map: MapIcon,
  trash: Trash2,
  save: Save,
}

const KIND: Record<Highlight['tone'], string> = { added: 'New', changed: 'Changed', removed: 'Removed', fixed: 'Fixed' }

export default function Highlights({ items }: { items: Highlight[] }) {
  return (
    <section aria-labelledby="highlights" style={{ margin: '36px 0 8px' }}>
      <h2 id="highlights" style={{ margin: '0 0 4px', fontSize: 'var(--text-lg)', fontWeight: 600 }}>Highlights</h2>
      <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        The changes most players will notice, summarised by LazyGrip from the release notes below.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map(h => {
          const Icon = ICONS[h.icon]
          return (
            <article key={h.id} className={`cl-card cl-t-${h.tone}`}>
              <div className="cl-head">
                <span className="cl-ico"><Icon size={16} strokeWidth={2.2} aria-hidden /></span>
                <h3 className="cl-h3"><InlineMd text={h.title} inline /></h3>
                <span className="cl-pill" style={{ marginLeft: 'auto' }}>{KIND[h.tone]}</span>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                <InlineMd text={h.text} />
              </div>
              {h.diff && (
                <div className="cl-diff" role="group" aria-label="Before and after">
                  {h.diff.before.map(l => <div key={l} className="old">− {l}</div>)}
                  {h.diff.after.map(l => <div key={l} className="new">+ {l}</div>)}
                </div>
              )}
              {h.table && (
                <div className="cl-tablewrap">
                  <table className="cl-table">
                    <thead><tr><th scope="col">{h.table.head[0]}</th><th scope="col">{h.table.head[1]}</th></tr></thead>
                    <tbody>
                      {h.table.rows.map(([a, b]) => (
                        <tr key={a} className={b === 'Nothing' ? 'none' : undefined}><td>{a}</td><td>{b}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {h.chips && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>{h.chips.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {h.chips.names.map(n => <span key={n} className="cl-pill cl-t-added" style={{ fontFamily: 'var(--font-mono)' }}>{n}</span>)}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
