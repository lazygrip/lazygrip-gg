import type { ReactNode } from 'react'

type SectionProps = {
  title?: string
  children: ReactNode
  marginBottom?: number
}

/** Consistent h2 + body wrapper, replacing the one-off <section> blocks duplicated
 * across the guide subpages, about, faq, etc. */
export default function Section({ title, children, marginBottom = 48 }: SectionProps) {
  return (
    <section style={{ marginBottom }}>
      {title && (
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginBottom: 14,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
