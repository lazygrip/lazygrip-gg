import type { ReactNode } from 'react'

export type Stat = {
  value: string
  label: string
  icon?: ReactNode
}

/**
 * Numeral-first stat row (Nexus-style: big bold number, small label underneath) —
 * replaces the icon+label chip row that had no actual numbers in it.
 */
export default function StatBlock({ stats }: { stats: Stat[] }) {
  return (
    <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
      {stats.map(s => (
        <div key={s.label}>
          <div
            style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {s.icon}
            {s.value}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 6 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}
