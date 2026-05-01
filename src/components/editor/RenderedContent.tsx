import DOMPurify from 'isomorphic-dompurify'

interface RenderedContentProps {
  html: string
}

export default function RenderedContent({ html }: RenderedContentProps) {
  if (!html || html.trim() === '' || html === '<p></p>') {
    return <p style={{ color: 'var(--text-muted, #9ca3af)', fontStyle: 'italic' }}>No description provided.</p>
  }

  // Sanitize HTML - whitelist approach prevents XSS
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 's', 'u',
      'h2', 'h3', 'h4',
      'ul', 'ol', 'li',
      'blockquote', 'code', 'pre',
      'a', 'hr', 'span',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  })

  return (
    <>
      <div
        className="rendered-content"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
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
