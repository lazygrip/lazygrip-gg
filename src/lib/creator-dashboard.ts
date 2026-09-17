import type { SupabaseClient } from '@supabase/supabase-js'

// Owner-only helpers for the creator dashboard section of /user/[username].
// Unlike home-stats.ts, these deliberately take a caller-supplied Supabase
// client rather than constructing their own createPublicClient() -- both
// reads here are gated by RLS to "the authenticated owner only"
// (sequence_view_daily's own policy, and notifications being a per-user
// table nobody else's session could read anyway), so they only make sense
// against the per-request, cookie-bearing server client the page already
// builds for its own auth.getUser() call, never the cookie-free public one.
//
// AUDIT F7.6, fixed 2026-09-17. The paragraph above is still true and was
// never the problem. The problem was that it was the WHOLE protection: both
// functions took an identity from their caller -- a userId argument, a list of
// sequence ids -- and neither checked it against the session, so their safety
// lived entirely outside them. RLS held only because every caller happened to
// pass the per-request client. createAdminClient() exists and is used in nine
// places, and the day one of them calls fetchCreatorActivity(admin, anyUserId)
// it returns that user's notification feed with nothing left to stop it.
//
// Both now resolve the identity from the SESSION, inside the function, and
// return [] when there is no session. The caller-supplied value is still
// accepted, and is now treated as an assertion to check rather than a fact to
// trust: a mismatch returns empty rather than data. That keeps every existing
// call site working unchanged while making the functions safe against a client
// they were never meant to receive.
//
// getUser() rather than getSession(): getSession reads the cookie and believes
// it, getUser revalidates against the auth server. An admin client has no user
// at all, so it lands on the `return []` path -- which is the case this exists
// for.
async function sessionUserId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

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

  // F7.6. No session, no trend -- and an admin client has no session, which is
  // exactly the caller this guards against.
  const viewerId = await sessionUserId(supabase)
  if (!viewerId) return []

  try {
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - (days - 1))
    const sinceStr = since.toISOString().slice(0, 10)

    // Two changes from the original `.select('day, views').in('sequence_id', ids)`:
    //
    // 1. `sequences!inner(author_id)` with an equality on the embedded column
    //    makes the join an INNER join filtered to the session user's own rows,
    //    so authorship is enforced AT THE DATABASE rather than by whichever
    //    client the caller handed in. Verified against the live schema on
    //    2026-09-17: this exact shape returns 200, and the control with a
    //    nonexistent embed returns PGRST200, so the 200 means the relationship
    //    resolved rather than the filter being ignored.
    //
    // 2. THE UNBOUNDED `.in()` IS GONE (audit F7.7's first leftover). It put
    //    one uuid per sequence into the GET query string, so a prolific
    //    creator's dashboard grew the URL until PostgREST or Vercel refused
    //    it -- latent at today's scale, and the kind of thing that breaks for
    //    exactly one user, the most active one. The author filter already
    //    restricts the rows; `sequenceIds` is now applied in memory, below, to
    //    keep the published-only scope the caller intends. The query string is
    //    constant-size whatever the creator has posted.
    const { data, error } = await supabase
      .from('sequence_view_daily')
      .select('day, views, sequence_id, sequences!inner(author_id)')
      .eq('sequences.author_id', viewerId)
      .gte('day', sinceStr)

    if (error) return []

    // The caller's list is the published set the profile page loaded; keeping
    // it means a sequence the creator has since made private does not
    // retroactively appear in the trend.
    const wanted = new Set(sequenceIds)

    const byDay = new Map<string, number>()
    for (const row of (data ?? []) as { day: string; views: number; sequence_id: string }[]) {
      if (!wanted.has(row.sequence_id)) continue
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
  // F7.6. The id is resolved from the session and the argument is checked
  // against it rather than used. Returning [] on a mismatch rather than
  // throwing keeps this consistent with every other failure path in the file --
  // the dashboard degrades to an empty feed, it does not 500 the profile page.
  const viewerId = await sessionUserId(supabase)
  if (!viewerId || viewerId !== userId) return []

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, message, created_at, is_read, sequence:sequences(slug, title)')
      // viewerId, not userId. They are equal by the check above, and using the
      // session-derived value means a future edit that relaxes that check
      // cannot silently turn this back into a caller-controlled query.
      .eq('user_id', viewerId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data ?? []) as unknown as ActivityItem[]
  } catch {
    return []
  }
}
