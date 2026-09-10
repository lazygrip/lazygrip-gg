import type { ReactNode } from 'react'
import { slugifyGuideTitle } from '@/lib/guide-slug'

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
      {/* id derives from the title via the same slugify guide-search-index.ts uses to
          build result links, so every section is a real jump target without having to
          hand-maintain anchors on 55 sections across 8 pages. scrollMarginTop keeps the
          sticky header from covering the heading when a search result lands here. */}
      <h2 id={slugifyGuideTitle(title)} style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--text-primary)', scrollMarginTop: 96 }}>
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
