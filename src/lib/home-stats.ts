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
// excludePatch lets the "previous patches" row skip whatever the "current patch" row is
// already showing, so the two tickers never duplicate the same sequence.
export async function fetchRecentSequences(limit = 10, excludePatch?: string | null): Promise<Sequence[]> {
  try {
    const supabase = createPublicClient()
    let query = supabase
      .from('sequences')
      .select('id, title, slug, class_id, class_name, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (excludePatch) query = query.neq('patch_version', excludePatch)
    const { data, error } = await query
    if (error) return []
    return (data ?? []) as Sequence[]
  } catch {
    return []
  }
}

// Powers the homepage "current patch" ticker row — reads the live current_patch out of
// site_config (same source of truth the browse page and sequence-detail staleness check
// use) rather than hardcoding a patch string, so this never drifts when an admin bumps it.
// Returns the patch string alongside the sequences so the row label can say what patch it
// actually means instead of a vague "Current".
export async function fetchCurrentPatchTicker(limit = 10): Promise<{ patch: string | null; sequences: Sequence[] }> {
  try {
    const supabase = createPublicClient()
    const { data: config } = await supabase.from('site_config').select('current_patch').eq('id', true).single()
    const patch = config?.current_patch ?? null
    if (!patch) return { patch: null, sequences: [] }

    const { data, error } = await supabase
      .from('sequences')
      .select('id, title, slug, class_id, class_name, view_count, created_at, author:profiles(username, display_name)')
      .eq('status', 'published')
      .eq('patch_version', patch)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return { patch, sequences: [] }
    return { patch, sequences: (data ?? []) as unknown as Sequence[] }
  } catch {
    return { patch: null, sequences: [] }
  }
}
