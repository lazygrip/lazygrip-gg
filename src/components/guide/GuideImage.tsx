'use client'

import { useEffect, useState, type CSSProperties } from 'react'

/** Screenshot frame for guide pages — bordered/rounded like GuideInfoBox, with an
 * optional caption below in muted text. Plain <img>, not next/image: these are
 * hand-placed screenshots of varying source dimensions from the live addon, not a
 * fixed asset pipeline, so a static width/height would fight real screenshots.
 *
 * Clicking (or Enter/Space on) the frame opens the image full-size in a lightbox —
 * click the backdrop, press Escape, or hit the close button to dismiss. This is a
 * client component specifically for that interactivity; the surrounding guide pages
 * stay server components and just import it like any other component. */
export default function GuideImage({
  src,
  alt,
  caption,
  maxWidth,
  style,
}: {
  src: string
  alt: string
  caption?: string
  maxWidth?: number
  style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <div style={{ marginTop: 16, marginBottom: 4, ...style }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        aria-label={`Zoom in on screenshot: ${alt}`}
        style={{
          position: 'relative',
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 8,
          maxWidth: maxWidth ?? '100%',
          cursor: 'zoom-in',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'calc(var(--radius-md) - 4px)' }}
        />
        {/* Always-visible affordance, not hover-only — hover never fires on touch/mobile,
            which is most of the readership for a screenshot-heavy guide. */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          ⤢
        </span>
      </div>
      {caption && (
        <p style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{caption}</p>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 9999,
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              width: 'auto',
              height: 'auto',
              borderRadius: 8,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              cursor: 'default',
            }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
