// Shared between GuideSection (which stamps the id on each section's <h2>) and
// guide-search-index (which has to produce the exact same anchor to link to). Keeping
// this in one place is deliberate -- two independent slugifiers drifting apart is how
// you get a search result that links to a page and silently fails to land on the
// section, with no error anywhere to catch it.
export function slugifyGuideTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
