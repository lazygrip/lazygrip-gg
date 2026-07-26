import type { SupabaseClient } from '@supabase/supabase-js'
import type { SequenceFilters } from '@/types'

export const BROWSE_PAGE_SIZE = 20

// Single source of truth for the browse listing query. The server page and the client
// component must produce identical result sets, otherwise the server-rendered first page
// is replaced by a different one the moment the client hydrates.
export function buildBrowseQuery(supabase: SupabaseClient, filters: SequenceFilters) {
  let query = supabase
    .from('sequences')
    .select('*, author:profiles(username, display_name, avatar_url)', { count: 'exact' })
    .eq('status', 'published')

  if (filters.class_id) query = query.eq('class_id', filters.class_id)
  if (filters.spec_id) query = query.eq('spec_id', filters.spec_id)
  if (filters.content_type) query = query.eq('content_type', filters.content_type)
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)

  switch (filters.sort) {
    case 'top_rated':
      query = query.gt('rating_count', 0).order('avg_score', { ascending: false }).order('rating_count', { ascending: false })
      break
    case 'most_viewed':
      query = query.order('view_count', { ascending: false })
      break
    case 'most_saved':
      query = query.order('save_count', { ascending: false })
      break
    default:
      query = query.order('updated_at', { ascending: false })
  }

  const limit = filters.limit || BROWSE_PAGE_SIZE
  const from = ((filters.page || 1) - 1) * limit
  return query.range(from, from + limit - 1)
}

// Stable identity for a filter set. The server hands the client the key it fetched with, and
// the client skips its first fetch for as long as the live filters still hash to that key.
export function browseFilterKey(filters: SequenceFilters): string {
  return JSON.stringify([
    filters.sort || 'recent',
    filters.page || 1,
    filters.limit || BROWSE_PAGE_SIZE,
    filters.class_id ?? null,
    filters.spec_id ?? null,
    filters.content_type ?? null,
    filters.search ?? null,
  ])
}
