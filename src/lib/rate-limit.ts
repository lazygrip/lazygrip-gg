// src/lib/rate-limit.ts
//
// Lightweight in-memory rate limiter for public, unauthenticated API routes
// (the Workshop decode/convert/build/import endpoints). These accept raw
// user-supplied strings and run them through parsing/decompression with no
// auth gate by design -- the Workshop is meant to be usable without an
// account. That openness means there's no login friction to slow down a
// script hammering the endpoint, so this exists purely to blunt sustained
// abuse from a single IP, not to provide strong security guarantees.
//
// Deliberately in-memory rather than a Supabase table (unlike
// view_count_throttle): these are high-frequency, low-stakes endpoints, and
// a DB round-trip on every decode call is the wrong tradeoff. In-memory
// resets on cold start / redeploy and isn't shared across serverless
// instances -- that's an accepted gap, not an oversight. It still meaningfully
// slows a single sustained abuser hitting a single warm instance, which is
// the realistic threat model here (a script, not a coordinated botnet).
//
// If this ever needs to be airtight (e.g. actual cost/outage from abuse),
// swap this for the same Supabase-table-based pattern as
// increment_view_count / view_count_throttle instead of hardening this file.

const buckets = new Map<string, { count: number; windowStart: number }>()

// Prune old entries occasionally so this doesn't grow unbounded across a
// long-lived serverless instance.
let lastPrune = Date.now()
const PRUNE_INTERVAL_MS = 5 * 60 * 1000

function prune(now: number, windowMs: number) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return
  lastPrune = now
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > windowMs) {
      buckets.delete(key)
    }
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  // No IP available (e.g. local dev, direct DB access path N/A here since
  // this is HTTP-level). Fail open under a shared bucket rather than
  // blocking legitimate requests when we can't identify the caller.
  return 'unknown'
}

/**
 * Returns true if the request is allowed, false if it should be rejected
 * with 429. `key` should already include both the route name and the IP
 * (see rate-limited() below) so limits are per-route, not global per-IP.
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): boolean {
  const now = Date.now()
  prune(now, windowMs)

  const existing = buckets.get(key)
  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return true
  }

  if (existing.count >= limit) {
    return false
  }

  existing.count += 1
  return true
}
