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
  // The shape lives in .ui-badge (globals.css); only what depends on `color` is inline. The
  // homepage renders this on every ticker card and leaderboard row, and a server component's
  // style object is written into the response twice, once as HTML and once as Flight (#107).
  return (
    <span
      className={className ? `ui-badge ${className}` : 'ui-badge'}
      style={{
        color,
        background: `${color}1a`,
        border: `0.5px solid ${color}40`,
        ...style,
      }}
    >
      {children}
    </span>
  )
}
