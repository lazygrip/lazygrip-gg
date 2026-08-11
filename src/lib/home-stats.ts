import { createPublicClient } from '@/lib/supabase/public'
import { buildBrowseQuery } from '@/lib/browse-query'
import type { Sequence } from '@/types'

export type HomeStats = {
  sequenceCount: number
  classCount: number
  memberCount: number
  viewCount: number
}

// Real numbers for the homepage stat block, not placeholder copy. Same cookie-free
// public client pattern as browse-server.ts, so this stays cacheable rather than
// opting the homepage into dynamic rendering. Returns null on any failure so the
// page can omit the stat block rather than render zeros or stale-looking numbers.
export async function fetchHomeStats(): Promise<HomeStats | null> {
  try {
    const supabase = createPublicClient()

    const [sequences, classes, members] = await Promise.all([
      supabase
        .from('sequences')
        .select('view_count', { count: 'exact' })
        .eq('status', 'published'),
      supabase
        .from('sequences')
        .select('class_name')
        .eq('status', 'published'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ])

    if (sequences.error || classes.error || members.error) return null

    const classCount = new Set((classes.data ?? []).map(row => row.class_name)).size
    const viewCount = (sequences.data ?? []).reduce((sum, row) => sum + (row.view_count ?? 0), 0)

    return {
      sequenceCount: sequences.count ?? 0,
      classCount,
      memberCount: members.count ?? 0,
      viewCount,
    }
  } catch {
    return null
  }
}

// Powers the homepage "Top Sequences" leaderboard — same query builder the browse page
// uses (buildBrowseQuery), so this can never drift from what "most viewed" actually
// means there. Returns [] rather than null on failure: the leaderboard section just
// omits itself, same fallback shape as fetchHomeStats.
export async function fetchTrendingSequences(limit = 6): Promise<Sequence[]> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await buildBrowseQuery(supabase, { sort: 'most_viewed', limit })
    if (error) return []
    return (data ?? []) as Sequence[]
  } catch {
    return []
  }
}

// Powers the homepage activity ticker — most recently posted sequences, oldest-first
// within the batch so the scroll reads left-to-right as "newest arrives from the right."
export async function fetchRecentSequences(limit = 10): Promise<Sequence[]> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('sequences')
      .select('id, title, slug, class_id, class_name, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data ?? []) as Sequence[]
  } catch {
    return []
  }
}
