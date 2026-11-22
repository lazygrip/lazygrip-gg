'use client'
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import DOMPurify from 'dompurify'
import { stripHtml } from '@/lib/html-text'
import { copyToClipboard } from '@/components/ui/CopyButton'

interface RenderedContentProps {
  html: string
}

// "Are we on the client yet" is a fact about the environment, not component state.
// Nothing ever changes it after hydration, so the subscribe callback has nothing to
// subscribe to; useSyncExternalStore is here for its server snapshot, which is the
// only thing that distinguishes the two renders.
const NEVER_CHANGES = () => () => {}
const ON_CLIENT = () => true
const ON_SERVER = () => false

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 's', 'u',
    'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'a', 'hr', 'span',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
}


// The sanitized description is plain HTML, so its code blocks cannot carry a React
// button. After the HTML is in place each <pre> is wrapped and given a copy button
// with the same icon the rest of the site uses. The wrapper keeps the button fixed in
// the corner while a long line scrolls sideways inside the block. The returned
// function puts every block back the way it was, which matters under React's
// double-run of effects in development.
const COPY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'

function addCopyButtons(root: HTMLElement): () => void {
  const undo: Array<() => void> = []
  root.querySelectorAll('pre').forEach(pre => {
    const parent = pre.parentNode
    if (!parent) return
    const wrap = document.createElement('div')
    wrap.className = 'rc-pre'
    parent.insertBefore(wrap, pre)
    wrap.appendChild(pre)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'rc-copy'
    btn.title = 'Copy'
    btn.setAttribute('aria-label', 'Copy code')
    btn.innerHTML = COPY_SVG
    let timer: ReturnType<typeof setTimeout> | undefined
    const onClick = async () => {
      const ok = await copyToClipboard(pre.textContent ?? '')
      btn.innerHTML = ok ? CHECK_SVG : COPY_SVG
      btn.title = ok ? 'Copied' : 'Copy failed, select the text and copy it by hand'
      btn.setAttribute('aria-label', btn.title)
      btn.dataset.state = ok ? 'copied' : 'failed'
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        btn.innerHTML = COPY_SVG
        btn.title = 'Copy'
        btn.setAttribute('aria-label', 'Copy code')
        delete btn.dataset.state
      }, 1500)
    }
    btn.addEventListener('click', onClick)
    wrap.appendChild(btn)

    undo.push(() => {
      if (timer) clearTimeout(timer)
      btn.removeEventListener('click', onClick)
      // If React already replaced the HTML these nodes are detached and there is
      // nothing to put back.
      if (wrap.parentNode) {
        wrap.parentNode.insertBefore(pre, wrap)
        wrap.remove()
      }
    })
  })
  return () => undo.forEach(fn => fn())
}

export default function RenderedContent({ html }: RenderedContentProps) {
  // dompurify here is the browser build. Outside a DOM it sets isSupported = false and never
  // assigns sanitize at all, so calling it on the server throws TypeError and 500s the route
  // now that sequence pages render server-side. Verified against the installed 3.4.12.
  //
  // Rather than leave the description out of the server HTML, the server renders its
  // plain-text projection, which needs no sanitizer because React escapes a text node, and
  // the client swaps in the sanitized rich HTML after mount. The description is therefore in
  // the crawlable markup, no DOM shim is added, and no sanitizer is hand-rolled.
  //
  // clean stays null until mounted, so the first client render matches the server byte for
  // byte and hydration is clean.
  //
  // This was state written from a mount effect until 2026-09-17. Sanitizing is a
  // pure function of `html`, so it belongs in the render rather than in an effect
  // that assigns its result to state: same output, one render pass instead of two,
  // and the sanitized string can no longer lag a prop change by a frame.
  const onClient = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER)
  const clean = useMemo(
    () => (onClient ? DOMPurify.sanitize(html, SANITIZE_OPTIONS) : null),
    [onClient, html],
  )

  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = contentRef.current
    if (!root || clean === null) return
    return addCopyButtons(root)
  }, [clean])

  if (!html || html.trim() === '' || html === '<p></p>') {
    return <p style={{ color: 'var(--text-muted, #9ca3af)', fontStyle: 'italic' }}>No description provided.</p>
  }

  return (
    <>
      {clean === null ? (
        <div key="text" className="rendered-content">
          <p>{stripHtml(html)}</p>
        </div>
      ) : (
        <div
          key="html"
          ref={contentRef}
          className="rendered-content"
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      )}
      <style>{`
        .rendered-content {
          font-size: 16px;
          line-height: 1.7;
          color: var(--text-primary, #111827);
          word-wrap: break-word;
        }
        .rendered-content > *:first-child { margin-top: 0; }
        .rendered-content > *:last-child { margin-bottom: 0; }
        .rendered-content p { margin: 0 0 14px 0; }
        .rendered-content h2 {
          font-size: 22px;
          font-weight: 600;
          margin: 28px 0 12px 0;
          color: var(--text-primary, #111827);
          letter-spacing: -0.01em;
        }
        .rendered-content h3 {
          font-size: 18px;
          font-weight: 600;
          margin: 22px 0 10px 0;
          color: var(--text-primary, #111827);
        }
        .rendered-content ul {
          padding-left: 26px;
          margin: 0 0 14px 0;
          list-style-type: disc;
        }
        .rendered-content ol {
          padding-left: 26px;
          margin: 0 0 14px 0;
          list-style-type: decimal;
        }
        .rendered-content li {
          margin: 6px 0;
          line-height: 1.65;
          display: list-item;
        }
        .rendered-content li p { margin: 0; }
        .rendered-content blockquote {
          border-left: 3px solid var(--accent, #10b981);
          padding: 8px 16px;
          margin: 16px 0;
          color: var(--text-secondary, #4b5563);
          background: var(--bg-secondary, #f9fafb);
          border-radius: 0 6px 6px 0;
        }
        .rendered-content blockquote p { margin: 0; }
        .rendered-content code {
          background: var(--bg-secondary, #f3f4f6);
          padding: 2px 7px;
          border-radius: 4px;
          font-family: ui-monospace, 'SF Mono', Menlo, Monaco, monospace;
          font-size: 14px;
          color: var(--text-primary, #111827);
        }
        .rendered-content pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 14px 16px;
          border-radius: 8px;
          margin: 16px 0;
          overflow-x: auto;
          font-size: 13px;
          line-height: 1.5;
        }
        .rendered-content .rc-pre { position: relative; margin: 16px 0; }
        .rendered-content .rc-pre pre { margin: 0; padding-right: 48px; }
        .rendered-content .rc-copy {
          position: absolute; top: 6px; right: 6px;
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; padding: 0; cursor: pointer;
          background: rgba(255, 255, 255, 0.08);
          border: 0.5px solid rgba(255, 255, 255, 0.25);
          border-radius: 4px; color: #e5e7eb;
        }
        .rendered-content .rc-copy:hover { background: rgba(255, 255, 255, 0.16); }
        .rendered-content .rc-copy[data-state='copied'] { color: #34d399; border-color: #34d399; }
        .rendered-content .rc-copy[data-state='failed'] { color: #f87171; border-color: #f87171; }
        .rendered-content pre code {
          background: none;
          color: inherit;
          padding: 0;
          font-size: inherit;
        }
        .rendered-content a {
          color: var(--accent, #10b981);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .rendered-content a:hover {
          text-decoration: none;
        }
        .rendered-content hr {
          border: none;
          border-top: 1px solid var(--border, #e5e7eb);
          margin: 24px 0;
        }
        .rendered-content strong { font-weight: 600; }
        .rendered-content em { font-style: italic; }
      `}</style>
    </>
  )
}
