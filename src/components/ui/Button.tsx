'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode, MouseEvent } from 'react'

type ButtonProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline'
  type?: 'button' | 'submit'
  style?: CSSProperties
  fullWidth?: boolean
  disabled?: boolean
}

/**
 * Every CTA on the site was a hand-rolled <Link style={{...}}> with no hover state —
 * --accent-hover existed in globals.css but nothing ever referenced it. This is the
 * single place that now does, so every button gets real hover feedback for free.
 */
export default function Button({
  children,
  href,
  onClick,
  variant = 'primary',
  type = 'button',
  style,
  fullWidth,
  disabled,
}: ButtonProps) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    textDecoration: 'none',
    padding: '10px 20px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-base)',
    fontWeight: 500,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
    pointerEvents: disabled ? 'none' : undefined,
    transition: 'background-color 0.15s, border-color 0.15s',
    width: fullWidth ? '100%' : undefined,
    ...style,
  }

  const variants: Record<string, CSSProperties> = {
    primary: { background: 'var(--accent)', color: 'white' },
    secondary: { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '0.5px solid var(--border-strong)' },
    outline: { background: 'transparent', color: 'var(--accent)', border: '0.5px solid var(--accent)' },
  }

  const hoverBg: Record<string, string | undefined> = {
    primary: 'var(--accent-hover)',
    secondary: 'var(--bg-tertiary)',
    outline: 'var(--accent-subtle)',
  }

  const combined = { ...base, ...variants[variant] }
  const restoreBg = variants[variant].background as string | undefined

  const onEnter = (e: MouseEvent<HTMLElement>) => {
    const hover = hoverBg[variant]
    if (hover) e.currentTarget.style.backgroundColor = hover
  }
  const onLeave = (e: MouseEvent<HTMLElement>) => {
    if (restoreBg) e.currentTarget.style.backgroundColor = restoreBg
  }

  if (href) {
    return (
      <Link href={href} style={combined} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={combined} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
    </button>
  )
}
