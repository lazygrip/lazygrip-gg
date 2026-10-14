// The one place the site's WoW patch options are defined.
//
// Newest first, so the patch a player is most likely on is always the first thing a
// dropdown or filter shows. When a new patch ships, add it at the top of PATCH_VERSIONS
// and change LATEST_PATCH to match, and every picker on the site follows.
//
// This list only decides what the publish form offers and what the Browse filter always
// includes. The patch a sequence is tagged with is still the author's own claim, and the
// site's stored current_patch (which drives the "Needs revalidation" badge) is set
// separately with set_current_patch(), so changing this file does not flip any badge.

export const LATEST_PATCH = '12.1.5'

export const PATCH_VERSIONS: string[] = ['12.1.5', '12.1', '12.0.7', '12.0.5', '12.0']

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/** Newest patch first. Numeric, so 12.1.5 sorts above 12.1 and 12.1 above 12.0.7. */
export function comparePatchesNewestFirst(a: string, b: string): number {
  return collator.compare(b, a)
}

/**
 * Patch options for a filter: every patch that has a published sequence, plus the latest
 * patch even when nothing has been tagged with it yet, newest first.
 */
export function orderPatchOptions(values: Iterable<string>): string[] {
  const set = new Set<string>()
  for (const raw of values) {
    const value = (raw || '').trim()
    if (value) set.add(value)
  }
  set.add(LATEST_PATCH)
  return Array.from(set).sort(comparePatchesNewestFirst)
}
