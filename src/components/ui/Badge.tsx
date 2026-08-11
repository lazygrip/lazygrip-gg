import type { CSSProperties, ReactNode } from 'react'

type BadgeProps = {
  children: ReactNode
  color?: string
  style?: CSSProperties
  className?: string
}

/**
 * Small pill tag — GSE Tools uses these constantly (COLLECTION, MACRO) to mark
 * item type at a glance in dense lists. We had nothing like it: every tag on
 * the site so far has been plain colored text, never a contained shape.
 */
export default function Badge({ children, color = 'var(--accent)', style, className }: BadgeProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color,
        background: `${color}1a`,
        border: `0.5px solid ${color}40`,
        borderRadius: 4,
        padding: '3px 6px',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
