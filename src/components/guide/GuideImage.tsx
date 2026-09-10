import type { CSSProperties } from 'react'

/** Screenshot frame for guide pages — bordered/rounded like GuideInfoBox, with an
 * optional caption below in muted text. Plain <img>, not next/image: these are
 * hand-placed screenshots of varying source dimensions from the live addon, not a
 * fixed asset pipeline, so a static width/height would fight real screenshots. */
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
  return (
    <div style={{ marginTop: 16, marginBottom: 4, ...style }}>
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 8,
          maxWidth: maxWidth ?? '100%',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'calc(var(--radius-md) - 4px)' }}
        />
      </div>
      {caption && (
        <p style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{caption}</p>
      )}
    </div>
  )
}
