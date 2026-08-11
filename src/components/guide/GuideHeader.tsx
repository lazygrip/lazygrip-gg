import Link from 'next/link'
import type { ReactNode } from 'react'

type GuideHeaderProps = {
  crumbLabel: string
  title: string
  description: ReactNode
}

// Unifies two header patterns that had drifted apart: installation/settings/how-it-works/
// building-sequences had a breadcrumb + 32px/700 h1; from-legacy-program/validating had no
// breadcrumb at all and a smaller 28px/600 h1. Every guide subpage now gets the same
// breadcrumb + heading treatment. Description text (which sometimes contains inline
// <Link>s to other guide pages) is untouched — passed through as children.
export default function GuideHeader({ crumbLabel, title, description }: GuideHeaderProps) {
  return (
    <>
      <nav style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 24, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link href="/guide" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Guide</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{crumbLabel}</span>
      </nav>
      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12, color: 'var(--text-primary)' }}>
        {title}
      </h1>
      {/* div, not <p> — some pages pass a single inline block, others pass multiple
          <p> elements with their own spacing, and <p> cannot nest inside <p>. */}
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 40 }}>
        {description}
      </div>
    </>
  )
}
