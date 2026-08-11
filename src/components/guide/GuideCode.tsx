import type { CSSProperties, ReactNode } from 'react'

// The six guide subpages had two different inline-code treatments before this: four
// used a borderless style object (fontFamily/fontSize/bg-tertiary/accent text), the
// other two used a bordered <Code> component with accent-text color. Standardizing on
// the bordered version — it reads more clearly as an inline code chip against prose.
export const guideCodeStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  background: 'var(--bg-tertiary)',
  border: '0.5px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  padding: '1px 6px',
  color: 'var(--accent-text)',
}

export default function GuideCode({ children }: { children: ReactNode }) {
  return <code style={guideCodeStyle}>{children}</code>
}
