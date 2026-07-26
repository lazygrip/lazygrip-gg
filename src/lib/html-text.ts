// Plain-text projection of stored rich text.
//
// Three callers need the same thing and had two byte-identical private copies of it:
// sequence meta descriptions, browse card previews, and now the server pass of
// RenderedContent, which cannot run the browser-only sanitizer.
//
// Block-level tags close to a space rather than to nothing. Stripping them bare joined
// words across paragraph boundaries, so "<p>one</p><p>two</p>" read as "onetwo". That was
// invisible while this only fed truncated previews; it is not invisible now that the output
// is the crawlable body copy of a sequence page.
//
// The result is only ever rendered as a React text node or written into a meta attribute,
// both of which escape it, so decoding entities here does not reintroduce markup.
export function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
