// Search-facing wording for a sequence page: the <title>, the line under the
// heading. Pure functions with no Supabase, React or Next import, so the
// server metadata (page.tsx) and the client page (SequencePageClient.tsx)
// build the same words from the same fields.

export type SequenceSeoFields = {
  title: string
  class_name: string
  spec_name?: string | null
  patch_version?: string | null
  game_version?: string | null
}

// "Affliction Warlock", or "Warlock" when the sequence has no spec.
export function sequenceLead(seq: SequenceSeoFields): string {
  return seq.spec_name ? `${seq.spec_name} ${seq.class_name}` : seq.class_name
}

// WoW Forever wins over a patch number; null when there is neither.
export function sequenceVersionLabel(seq: SequenceSeoFields): string | null {
  if (seq.game_version === 'forever') return 'WoW Forever'
  return seq.patch_version || null
}

// "Affliction Warlock one-button macro, 12.1.5: mfdoom affliction warlock"
export function sequenceSeoTitle(seq: SequenceSeoFields): string {
  const version = sequenceVersionLabel(seq)
  const versionPart = version ? `, ${version}` : ''
  return `${sequenceLead(seq)} one-button macro${versionPart}: ${seq.title.trim()}`
}

// "Affliction Warlock one-button macro for Mythic+, 12.1.5. A GRIP-EMS sequence by mfdoom."
export function sequenceTagline(seq: SequenceSeoFields, contentLabel: string, authorName: string): string {
  const version = sequenceVersionLabel(seq)
  const versionPart = version ? `, ${version}` : ''
  const byline = authorName ? `A GRIP-EMS sequence by ${authorName}.` : 'A GRIP-EMS sequence.'
  return `${sequenceLead(seq)} one-button macro for ${contentLabel}${versionPart}. ${byline}`
}
