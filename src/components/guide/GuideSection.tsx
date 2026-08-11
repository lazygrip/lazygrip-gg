import type { ReactNode } from 'react'

type GuideSectionProps = {
  title: string
  children: ReactNode
  /** 'prose' (default) wraps children in one typographic block — used by settings,
   * how-it-works, and building-sequences. 'stack' gives children their own flex column
   * with gaps instead — used by installation, where each child is a self-contained Step. */
  layout?: 'prose' | 'stack'
}

/** Deduplicated from four guide subpages, which each defined an identical (or
 * near-identical) local Section component. Content is untouched — this only replaces
 * the wrapper. */
export default function GuideSection({ title, children, layout = 'prose' }: GuideSectionProps) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {layout === 'stack' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
      ) : (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>
      )}
    </div>
  )
}
