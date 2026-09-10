import { createPublicClient } from '@/lib/supabase/public'
import { buildBrowseQuery, BROWSE_PAGE_SIZE } from '@/lib/browse-query'
import type { Sequence, SequenceFilters } from '@/types'

export type BrowsePageData = {
  sequences: Sequence[] | null
  count: number
  currentPatch: string | null
  availablePatches: string[]
}

// Distinct patch_version values across published sequences, for the Browse patch filter.
// Sorted numerically (11.2 before 12.1) rather than lexically.
async function fetchAvailablePatches(supabase: ReturnType<typeof createPublicClient>): Promise<string[]> {
  const { data, error } = await supabase
    .from('sequences')
    .select('patch_version')
    .eq('status', 'published')
    .not('patch_version', 'is', null)

  if (error || !data) return []

  const values = new Set<string>()
  for (const row of data as { patch_version: string | null }[]) {
    const value = (row.patch_version || '').trim()
    if (value) values.add(value)
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  return Array.from(values).sort((a, b) => collator.compare(a, b))
}

// sequences: null means "the server could not fetch this", which makes the page omit every
// initial-* prop so BrowseContent degrades to the client fetch it does today. An empty array
// would instead render the permanent "No sequences found" empty state.
export async function fetchBrowsePage(filters: SequenceFilters): Promise<BrowsePageData> {
  try {
    const supabase = createPublicClient()
    const [listing, config, availablePatches] = await Promise.all([
      buildBrowseQuery(supabase, filters),
      supabase.from('site_config').select('current_patch').single(),
      fetchAvailablePatches(supabase),
    ])

    if (listing.error) {
      // PGRST103 means the requested offset starts past the last row, which is what an
      // out-of-range ?page= in the URL produces (measured live: 416, code PGRST103).
      // Clamp to the last real page and serve that, instead of returning null and
      // leaving the page on its loading skeleton while the client rebuilds the same
      // out-of-range query.
      if (listing.error.code === 'PGRST103' && (filters.page || 1) > 1) {
        const first = await buildBrowseQuery(supabase, { ...filters, page: 1 })
        if (!first.error) {
          const limit = filters.limit || BROWSE_PAGE_SIZE
          const lastPage = Math.max(1, Math.ceil((first.count ?? 0) / limit))
          const clamped = lastPage > 1 ? await buildBrowseQuery(supabase, { ...filters, page: lastPage }) : first
          if (!clamped.error) {
            return {
              sequences: (clamped.data ?? []) as Sequence[],
              count: clamped.count ?? 0,
              currentPatch: config.data?.current_patch ?? null,
              availablePatches,
            }
          }
        }
      }
      return { sequences: null, count: 0, currentPatch: null, availablePatches: [] }
    }

    return {
      sequences: (listing.data ?? []) as Sequence[],
      count: listing.count ?? 0,
      currentPatch: config.data?.current_patch ?? null,
      availablePatches,
    }
  } catch {
    return { sequences: null, count: 0, currentPatch: null, availablePatches: [] }
  }
}
