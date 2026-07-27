import { createClient } from '@/lib/supabase/server'
import { buildBrowseQuery } from '@/lib/browse-query'
import type { Sequence, SequenceFilters } from '@/types'

export type BrowsePageData = {
  sequences: Sequence[] | null
  count: number
  currentPatch: string | null
}

// sequences: null means "the server could not fetch this", which makes the page omit every
// initial-* prop so BrowseContent degrades to the client fetch it does today. An empty array
// would instead render the permanent "No sequences found" empty state.
export async function fetchBrowsePage(filters: SequenceFilters): Promise<BrowsePageData> {
  try {
    const supabase = await createClient()
    const [listing, config] = await Promise.all([
      buildBrowseQuery(supabase, filters),
      supabase.from('site_config').select('current_patch').single(),
    ])

    if (listing.error) {
      return { sequences: null, count: 0, currentPatch: null }
    }

    return {
      sequences: (listing.data ?? []) as Sequence[],
      count: listing.count ?? 0,
      currentPatch: config.data?.current_patch ?? null,
    }
  } catch {
    return { sequences: null, count: 0, currentPatch: null }
  }
}
