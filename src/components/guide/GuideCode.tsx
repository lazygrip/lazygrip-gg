import type { CSSProperties, ReactNode } from 'react'
import CopyButton from '@/components/ui/CopyButton'

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

// An inline chip for a slash command or a macro line somebody will paste into the
// game, with a small copy icon after it. Plain chips (setting names, field names,
// conditionals) stay plain, because there is nothing to paste.
export function GuideCommand({ children }: { children: string }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <code style={{ ...guideCodeStyle, whiteSpace: 'normal' }}>{children}</code>
      <CopyButton
        text={children}
        label={`Copy ${children}`}
        size={11}
        style={{ width: 18, height: 18, marginLeft: 3, verticalAlign: 'middle', background: 'transparent', border: 'none' }}
      />
    </span>
  )
}
