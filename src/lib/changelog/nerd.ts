import type { EmsItem } from './ems'
import type { ArchivedRelease } from './ems-archive'

// Picks the entries of a release that say the most about how the addon works underneath, for the
// click-to-reveal "For the nerds" note at the end of its page. Nothing is written or invented
// here: each note is the author's own sentence, chosen by how many technical terms it uses, or
// the release's most detailed entry when none of them is technical.
const TECH = /\b(attribute|api|lua|secure|taint(ed)?|savedvariables?|events?|frames?|functions?|cvars?|hooks?|payload|toc|interface|handler|namespace|macro text|256|255|byte|string|table|metatable|nil|pcall|c_|token)\b/gi

export function techScore(item: EmsItem): number {
  return (item.markdown.match(TECH) ?? []).length
}

function firstSentences(text: string, max = 2): string {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]
  return parts.slice(0, max).join('').trim()
}

export function nerdNotes(release: ArchivedRelease, count = 2): string[] {
  const all = release.sections.flatMap(s => s.items)
  let scored = all
    .map(item => ({ item, score: techScore(item) }))
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score || b.item.markdown.length - a.item.markdown.length)
    .slice(0, count)
  // A release with nothing technical still gets a note: its most detailed write-up.
  if (scored.length === 0 && all.length > 0) {
    const longest = [...all].sort((a, b) => b.markdown.length - a.markdown.length)[0]
    scored = [{ item: longest, score: 0 }]
  }
  return scored.map(({ item }) =>
    item.lead ? `**${item.lead}** ${firstSentences(item.body, 2)}`.trim() : firstSentences(item.markdown, 2),
  )
}
