import { unstable_cache } from 'next/cache'
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
async function fetchAvailablePatchesUncached(): Promise<string[]> {
  const supabase = createPublicClient()
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

async function fetchCurrentPatchUncached(): Promise<string | null> {
  const supabase = createPublicClient()
  const { data } = await supabase.from('site_config').select('current_patch').single()
  return data?.current_patch ?? null
}

// Both of these produce the same answer for every request regardless of filters -- patches list
// only grows when a sequence posts on a new patch, current_patch only changes when an admin sets
// it -- but /browse and /browse/[slug] (#24) were re-running them, full-table scan and all, on
// every single hit alongside the actual filtered listing query. Wrapped with unstable_cache so
// they run at most once per revalidate window and every request in between reuses that result,
// instead of asking Postgres and re-deriving the same Set/sort over again per request.
const getCachedAvailablePatches = unstable_cache(
  fetchAvailablePatchesUncached,
  ['browse-available-patches'],
  { revalidate: 300, tags: ['browse-available-patches'] }
)

const getCachedCurrentPatch = unstable_cache(
  fetchCurrentPatchUncached,
  ['browse-current-patch'],
  { revalidate: 300, tags: ['browse-current-patch'] }
)

// sequences: null means "the server could not fetch this", which makes the page omit every
// initial-* prop so BrowseContent degrades to the client fetch it does today. An empty array
// would instead render the permanent "No sequences found" empty state.
export async function fetchBrowsePage(filters: SequenceFilters): Promise<BrowsePageData> {
  try {
    const supabase = createPublicClient()
    const [listing, currentPatch, availablePatches] = await Promise.all([
      buildBrowseQuery(supabase, filters),
      getCachedCurrentPatch(),
      getCachedAvailablePatches(),
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
              currentPatch,
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
      currentPatch,
      availablePatches,
    }
  } catch {
    return { sequences: null, count: 0, currentPatch: null, availablePatches: [] }
  }
}
