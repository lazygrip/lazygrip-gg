import type { ReactNode } from 'react'

/** Byte-identical across installation, settings, how-it-works, and building-sequences
 * before this — same duplication pattern as GuideSection. */
export default function GuideCallout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: '12px 14px',
        background: 'rgba(29,158,117,0.07)',
        border: '0.5px solid rgba(29,158,117,0.25)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  )
}
