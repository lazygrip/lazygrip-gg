// Shared helper for every JSON-LD block on the site. The one thing every
// caller needs and would otherwise have to remember on its own: several of
// these blocks embed user-submitted text (a sequence's title/description,
// most notably) straight into a <script> tag via dangerouslySetInnerHTML.
// JSON.stringify alone does not escape '<', so a title containing the
// literal string "</script>" would close the script tag early and dump the
// rest of the JSON as visible page text -- or worse, let whatever text
// follows in the source be interpreted as markup. Escaping '<' to its
// unicode escape defeats that without changing the JSON's meaning (a
// browser's JSON.parse and any crawler's JSON-LD parser both read <
// back as the same character).
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
