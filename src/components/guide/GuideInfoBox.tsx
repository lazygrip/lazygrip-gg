import type { ReactNode } from 'react'

/** Neutral aside box — distinct from GuideCallout, which has the accent left-border
 * treatment for warnings/things-to-watch-for. This is for plain supplementary info. */
export default function GuideInfoBox({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        marginTop: 14,
        marginBottom: 4,
      }}
    >
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}
