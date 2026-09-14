import { createPublicClient } from '@/lib/supabase/public'
import { buildBrowseQuery } from '@/lib/browse-query'
import type { Sequence } from '@/types'

export type HomeStats = {
  sequenceCount: number
  classCount: number
  memberCount: number
  viewCount: number
}

export type TopCreator = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_color: string | null
  sequenceCount: number
  totalViews: number
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
// means there. Scoped to the current patch (site_config.current_patch, same source of
// truth fetchCurrentPatchTicker reads below) so the leaderboard reflects the present
// season instead of surfacing view counts sequences racked up on patches players have
// since moved past. Falls back to an unscoped most-viewed query if no current patch is
// configured, so the section never goes empty over a missing config row. Returns []
// rather than null on failure: the leaderboard section just omits itself, same fallback
// shape as fetchHomeStats.
export async function fetchTrendingSequences(limit = 6): Promise<Sequence[]> {
  try {
    const supabase = createPublicClient()
    const { data: config } = await supabase.from('site_config').select('current_patch').eq('id', true).single()
    const patch = config?.current_patch ?? null

    const { data, error } = await buildBrowseQuery(
      supabase,
      patch ? { sort: 'most_viewed', limit, patch_version: patch } : { sort: 'most_viewed', limit }
    )
    if (error) return []
    return (data ?? []) as Sequence[]
  } catch {
    return []
  }
}

// Powers the homepage "Top Creators" leaderboard and the /creators directory page
// (which calls this with a much higher limit and no slice, effectively "everyone").
// Ranked by summed view_count across a creator's published sequences -- same metric
// "Top sequences" already ranks by, so the two leaderboards on the homepage tell one
// consistent story instead of two different definitions of "top."
//
// Aggregated in JS off a single fetch of (author_id, view_count) rather than a SQL
// GROUP BY, matching fetchHomeStats' existing pattern above for the same reason: this
// runs through the public/cacheable client and Supabase's JS query builder has no
// clean way to express "sum grouped by author, joined to profiles, ordered by the
// sum" in one call. At this site's scale that's one lightweight query plus one
// profiles lookup, not a real cost.
//
// Creators with zero published sequences never appear -- there's nothing to group,
// since the source query itself is scoped to status='published'. That's correct: a
// private or draft-only account has nothing to rank on a public leaderboard.
export async function fetchTopCreators(limit = 15): Promise<TopCreator[]> {
  try {
    const supabase = createPublicClient()

    const { data: sequences, error: seqError } = await supabase
      .from('sequences')
      .select('author_id, view_count')
      .eq('status', 'published')
    if (seqError || !sequences) return []

    const byAuthor = new Map<string, { sequenceCount: number; totalViews: number }>()
    for (const row of sequences) {
      if (!row.author_id) continue
      const entry = byAuthor.get(row.author_id) ?? { sequenceCount: 0, totalViews: 0 }
      entry.sequenceCount += 1
      entry.totalViews += row.view_count ?? 0
      byAuthor.set(row.author_id, entry)
    }

    const ranked = Array.from(byAuthor.entries())
      .sort((a, b) => b[1].totalViews - a[1].totalViews)
      .slice(0, limit)
    if (ranked.length === 0) return []

    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, avatar_color')
      .in('id', ranked.map(([authorId]) => authorId))
    if (profError || !profiles) return []

    // .in() doesn't preserve order, so the final ordering comes from `ranked`
    // (already sorted by views), not from whatever order profiles came back in.
    const profileById = new Map(profiles.map(p => [p.id, p]))
    return ranked
      .map(([authorId, stats]) => {
        const profile = profileById.get(authorId)
        if (!profile || !profile.username) return null
        return {
          id: authorId,
          username: profile.username,
          display_name: profile.display_name ?? null,
          avatar_url: profile.avatar_url ?? null,
          avatar_color: profile.avatar_color ?? null,
          sequenceCount: stats.sequenceCount,
          totalViews: stats.totalViews,
        }
      })
      .filter((c): c is TopCreator => c !== null)
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
      // !sequences_author_id_fkey: see browse-query.ts's buildBrowseQuery for why this
      // hint is required as of migration 030 (two FKs now exist between sequences and
      // profiles, so an unqualified embed is ambiguous to PostgREST).
      .select('id, title, slug, class_id, class_name, view_count, created_at, author:profiles!sequences_author_id_fkey(username, display_name)')
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
