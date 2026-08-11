import type { ReactNode } from 'react'

export type Stat = {
  value: string
  label: string
  icon?: ReactNode
}

/**
 * Numeral-first stat row (Nexus-style: big bold number, small label underneath) —
 * replaces the icon+label chip row that had no actual numbers in it.
 *
 * align defaults to 'left' so every existing caller (homepage hero) is
 * unaffected -- added 2026-08-11 specifically so /user/[username] could opt
 * into centered stats without forking this component or fighting inline-
 * style specificity from outside it.
 */
export default function StatBlock({ stats, align = 'left' }: { stats: Stat[]; align?: 'left' | 'center' }) {
  return (
    <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      {stats.map(s => (
        <div key={s.label} style={{ textAlign: align }}>
          <div
            style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: align === 'center' ? 'center' : 'flex-start',
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
