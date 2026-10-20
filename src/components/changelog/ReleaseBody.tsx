import InlineMd from './InlineMd'
import type { ArchivedRelease } from '@/lib/changelog/ems-archive'

const SECTION_ACCENT: Record<string, string> = {
  Added: 'var(--accent)',
  Changed: 'var(--text-secondary)',
  Fixed: 'var(--text-muted)',
  Removed: 'var(--text-muted)',
}

// A section this long would bury the page, so it starts folded with its count in view.
const FOLD_AT = 15

export default function ReleaseBody({ release }: { release: ArchivedRelease }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {release.intro && (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <InlineMd text={release.intro} />
        </div>
      )}
      {release.sections.map(section => {
        const list = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
            {section.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: SECTION_ACCENT[section.title] ?? 'var(--text-muted)', flexShrink: 0, marginTop: 8 }} />
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, minWidth: 0 }}>
                  {item.lead ? (
                    <>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}><InlineMd text={item.lead} /></div>
                      {item.body && <div style={{ marginTop: 2 }}><InlineMd text={item.body} /></div>}
                    </>
                  ) : (
                    <InlineMd text={item.markdown} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )
        const heading = (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>
            {section.title} <span style={{ fontWeight: 400 }}>({section.items.length})</span>
          </span>
        )
        return section.items.length > FOLD_AT ? (
          <details key={section.title}>
            <summary style={{ cursor: 'pointer' }}>{heading}</summary>
            {list}
          </details>
        ) : (
          <div key={section.title}>{heading}{list}</div>
        )
      })}
    </div>
  )
}
