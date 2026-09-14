import type { SupabaseClient } from '@supabase/supabase-js'

// Owner-only helpers for the creator dashboard section of /user/[username].
// Unlike home-stats.ts, these deliberately take a caller-supplied Supabase
// client rather than constructing their own createPublicClient() -- both
// reads here are gated by RLS to "the authenticated owner only"
// (sequence_view_daily's own policy, and notifications being a per-user
// table nobody else's session could read anyway), so they only make sense
// against the per-request, cookie-bearing server client the page already
// builds for its own auth.getUser() call, never the cookie-free public one.

export type ViewTrendPoint = { day: string; views: number }

// Builds a zero-filled daily series over the last `days` days (today
// included) from sequence_view_daily, summed across every sequence id
// passed in. Zero-filling matters specifically because a day with no rows
// (no views logged that day) must render as a real 0 bar in the trend
// chart, not silently disappear and compress the x-axis -- which is what a
// naive "just return whatever the query found" pass-through would do.
//
// sequence_view_daily only exists from migration 030 forward (see that
// migration's comment) -- there is no historical backfill, so a creator
// who's been posting for months will correctly see mostly zeros until the
// rollup has had time to accumulate. That's a real limitation of the data,
// not a bug in this function.
export async function fetchCreatorViewTrend(
  supabase: SupabaseClient,
  sequenceIds: string[],
  days = 30
): Promise<ViewTrendPoint[]> {
  if (sequenceIds.length === 0) return []
  try {
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - (days - 1))
    const sinceStr = since.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('sequence_view_daily')
      .select('day, views')
      .in('sequence_id', sequenceIds)
      .gte('day', sinceStr)

    if (error) return []

    const byDay = new Map<string, number>()
    for (const row of (data ?? []) as { day: string; views: number }[]) {
      byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.views)
    }

    const out: ViewTrendPoint[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(since)
      d.setUTCDate(d.getUTCDate() + i)
      const key = d.toISOString().slice(0, 10)
      out.push({ day: key, views: byDay.get(key) ?? 0 })
    }
    return out
  } catch {
    return []
  }
}

export type ActivityItem = {
  id: string
  type: string
  message: string
  created_at: string
  is_read: boolean
  sequence: { slug: string; title: string } | null
}

// Reuses the existing `notifications` table (see /notifications page for
// the sibling query) -- it already captures exactly "someone commented on /
// replied to / rated one of your sequences" via triggers that predate this
// feature, so the creator-dashboard activity feed needed no new backend at
// all, just a smaller-limit read of data that already exists.
export async function fetchCreatorActivity(
  supabase: SupabaseClient,
  userId: string,
  limit = 15
): Promise<ActivityItem[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, message, created_at, is_read, sequence:sequences(slug, title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data ?? []) as unknown as ActivityItem[]
  } catch {
    return []
  }
}
