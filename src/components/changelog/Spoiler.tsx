'use client'
import { useState, type ReactNode } from 'react'

// Blurred until clicked, the way a forum spoiler works. It is a real button, so a keyboard or a
// screen reader reaches it, and what is hidden is a short extra note, never something needed to use the page.
export default function Spoiler({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="cl-spoiler">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className={open ? 'open' : undefined}>
        <span className="cl-spoiler-hint">{open ? 'Hide' : 'Click to reveal'}: {label}</span>
        <span className="cl-spoiler-body" aria-hidden={open ? undefined : true}>{children}</span>
      </button>
    </div>
  )
}
