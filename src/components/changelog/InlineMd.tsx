import type { ReactNode } from 'react'

// Renders the small slice of markdown the GRIP-EMS changelog uses (bold, italic, `code`,
// links and nested bullets) as React nodes. It never builds HTML from the text, so nothing
// in a changelog entry can inject markup, and a link only becomes a link when it is http(s).

// A code span that names a key is drawn as a key cap, anything else as a code chip.
const KEY = /^(Tab|Space|Esc|Escape|Enter|Shift|Ctrl|Alt|Backspace|Delete|Caps Lock|F\d{1,2}|[A-Z0-9]|Mouse Button \d|Left Click|Right Click|Middle Click)$/

const codeStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.92em',
  background: 'var(--bg-tertiary)',
  padding: '1px 5px',
  borderRadius: 4,
} as const

const TOKEN = /(`[^`\n]+`)|(\*\*[^*]+?\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\n]+\*)/g

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const tok = m[0]
    const key = `${keyBase}-${i++}`
    if (m[1]) {
      const code = tok.slice(1, -1)
      out.push(KEY.test(code) ? <kbd key={key} className="cl-kbd">{code}</kbd> : <code key={key} style={codeStyle}>{code}</code>)
    }
    else if (m[2]) out.push(<strong key={key} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inline(tok.slice(2, -2), key)}</strong>)
    else if (m[3]) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)
      if (mm && /^https?:\/\//i.test(mm[2])) {
        out.push(<a key={key} href={mm[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{mm[1]}</a>)
      } else out.push(mm ? mm[1] : tok)
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    last = at + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// Inline-only version for a single line, so a trailing link can sit on the same line.
export function InlineText({ text }: { text: string }) {
  return <>{inline(text, 't')}</>
}

export default function InlineMd({ text, inline: oneLine }: { text: string; inline?: boolean }) {
  if (oneLine) return <>{inline(text, 'i')}</>
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`} style={{ margin: 0 }}>{inline(para.join(' '), `p${blocks.length}`)}</p>)
    para = []
  }
  const flushList = () => {
    if (list.length) {
      const k = `l${blocks.length}`
      blocks.push(
        <ul key={k} style={{ margin: '6px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {list.map((li, n) => <li key={n}>{inline(li, `${k}-${n}`)}</li>)}
        </ul>,
      )
    }
    list = []
  }
  for (const line of lines) {
    const bullet = /^\s+[-*]\s+(.*)$/.exec(line)
    if (bullet) { flushPara(); list.push(bullet[1]) }
    else if (line.trim() === '') { flushPara(); flushList() }
    else if (list.length) list[list.length - 1] += ' ' + line.trim()
    else para.push(line.trim())
  }
  flushPara()
  flushList()
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{blocks}</div>
}
