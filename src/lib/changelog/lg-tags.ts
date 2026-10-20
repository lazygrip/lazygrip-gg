import type { Tone } from './tone'

// Tags a public LG-Changelog line with what kind of change it is and which part of the site it
// touches, so the page can colour them the way the EMS-Changelog does. Both are guesses from the
// wording of the commit message, so they only ever decide a colour and a chip, never what is shown.
export type LgKind = { tone: Tone; label: string }

export function kindOf(entry: string): LgKind {
  if (/^(remove|drop|delete|retire)\b/i.test(entry)) return { tone: 'removed', label: 'Removed' }
  if (/^fix\b|\bfix(es|ed)?\b|\bbug\b|broken|no longer|instead of hanging|\bstop\b/i.test(entry)) return { tone: 'fixed', label: 'Fixed' }
  if (/^(add|new|introduc|launch|build|support|enable|record)\b/i.test(entry)) return { tone: 'added', label: 'New' }
  return { tone: 'changed', label: 'Changed' }
}

const AREAS: { name: string; test: RegExp }[] = [
  { name: 'Phones', test: /phone|mobile|\btap\b|touch/i },
  { name: 'Accounts', test: /sign.?in|password|profile|username|account|email|log.?in|welcome/i },
  { name: 'Sequences', test: /sequence|rating|publish|collection|import|export|workshop|spec\b/i },
  { name: 'Browse and search', test: /browse|search|filter|top rated|mythic|raid|sort|sitemap/i },
  { name: 'Guide and pages', test: /guide|faq|about|changelog|footer|page|wow: forever|compatib/i },
  { name: 'Look and feel', test: /font|colou?r|theme|hero|home|header|layout|ticker|banner|logo|text/i },
]

export const LG_AREAS = [...AREAS.map(a => a.name), 'Everything else']

export function areaOfEntry(entry: string): string {
  return AREAS.find(a => a.test.test(entry))?.name ?? 'Everything else'
}
