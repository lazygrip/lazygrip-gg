'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

// One copy button for every box on the site that holds a string somebody might want
// to paste into the game: import strings, talent builds, macro lines, slash commands.
//
// The clipboard API is only offered on secure pages and can be refused (an embedded
// view, a browser that wants a fresh click, a permissions policy), so a refusal falls
// back to selecting a throwaway textarea and running the older copy command. If both
// fail the button says so instead of showing a tick it did not earn.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the older route
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '0'
    area.style.left = '0'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

type CopyButtonProps = {
  // The string to copy. A function is read at click time, for text that changes
  // while the box is open (an export that updates as you edit).
  text: string | (() => string)
  // Names the thing being copied, for screen readers and the hover tooltip.
  label?: string
  size?: number
  style?: CSSProperties
  onCopied?: () => void
}

export default function CopyButton({ text, label = 'Copy', size = 14, style, onCopied }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const value = typeof text === 'function' ? '' : text
  const empty = typeof text === 'function' ? false : !value

  async function handleClick(e: React.MouseEvent) {
    // Some boxes sit inside clickable rows or summaries.
    e.stopPropagation()
    e.preventDefault()
    const str = typeof text === 'function' ? text() : text
    if (!str) return
    const ok = await copyToClipboard(str)
    setState(ok ? 'copied' : 'failed')
    if (ok) onCopied?.()
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1500)
  }

  const shown = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed, select the text and copy it by hand' : label
  const box = size + 14

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={empty}
      title={shown}
      aria-label={shown}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: box, height: box, padding: 0, flexShrink: 0,
        background: state === 'copied' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
        border: '0.5px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        color: state === 'copied' ? 'var(--accent-text)' : state === 'failed' ? '#c0392b' : 'var(--text-secondary)',
        cursor: empty ? 'default' : 'pointer',
        opacity: empty ? 0.4 : 1,
        ...style,
      }}
    >
      {state === 'copied' ? <Check size={size} aria-hidden /> : <Copy size={size} aria-hidden />}
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : ''}
      </span>
    </button>
  )
}

// A box with the copy button pinned to its top right corner, the way a code block
// shows it. `padRight` keeps long text from running underneath the button.
export function CopyBox({
  text, label, children, style, innerStyle,
}: {
  text: string | (() => string)
  label?: string
  children: ReactNode
  style?: CSSProperties
  innerStyle?: CSSProperties
}) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <div style={{ paddingRight: 40, ...innerStyle }}>{children}</div>
      <CopyButton text={text} label={label} style={{ position: 'absolute', top: 6, right: 6 }} />
    </div>
  )
}
