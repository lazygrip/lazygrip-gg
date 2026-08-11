'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode, MouseEvent } from 'react'

type CardProps = {
  children: ReactNode
  href?: string
  /** Colored left border, e.g. the Workshop banner or a content-type card. */
  accentColor?: string
  /** Border color to switch to on hover. Works whether or not href is set —
   * e.g. an external link card wraps its own <a> around a hrefless Card. */
  hoverColor?: string
  padding?: 'sm' | 'md' | 'lg'
  style?: CSSProperties
  className?: string
}

const PADDING = { sm: '16px', md: '20px 24px', lg: '24px 28px' }

export default function Card({
  children,
  href,
  accentColor,
  hoverColor,
  padding = 'md',
  style,
  className,
}: CardProps) {
  const baseStyle: CSSProperties = {
    background: 'var(--bg-primary)',
    border: '0.5px solid var(--border)',
    ...(accentColor ? { borderLeft: `3px solid ${accentColor}` } : {}),
    borderRadius: 'var(--radius-lg)',
    padding: PADDING[padding],
    transition: 'border-color 0.15s',
    ...style,
  }

  const onEnter = (e: MouseEvent<HTMLElement>) => {
    if (hoverColor) e.currentTarget.style.borderColor = hoverColor
  }
  const onLeave = (e: MouseEvent<HTMLElement>) => {
    if (hoverColor) e.currentTarget.style.borderColor = 'var(--border)'
  }

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        style={{ ...baseStyle, display: 'block', textDecoration: 'none', color: 'inherit' }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
      </Link>
    )
  }

  return (
    <div className={className} style={baseStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
    </div>
  )
}
