import { createAdminClient } from './supabase/admin'

// Shared helper for every outbound call to Sataana's gripbot
// (discord.griphub.dev), used by notify-discord (publish/update/edit) and
// the sequence-delete route.
//
// Sataana's one hard rule, stated directly: "a publish must never fail
// because my box is unreachable... but don't swallow it either, which is
// the same shape as the bug you just fixed." That's the duplicate-thread
// bug (notify-discord writeback failures being logged and forgotten). This
// helper exists so that failure shape only has to be gotten right once,
// not once per call site, since more call sites (comment relay) are coming.
//
// Behavior:
// 1. Fire the request with a short timeout (2.5s, inside his 2-3s ask).
// 2. On failure, retry twice with backoff (0.5s, 2s) -- transient network
// blips and cold starts on his end are the common case, not a reason
// to immediately give up or immediately queue.
// 3. If all attempts fail, log to relay_failures so a human can see it --
// never just a console.error that scrolls off into Vercel's log
// retention window unseen. This is the "don't swallow it" half.
// 4. The calling route's response to the user is never blocked on or
// affected by any of this -- callers should not await this in a way
// that delays their own response. Call it and let it run.
//
// 2026-08-08 delivery-time recompute: a live run showed a delete's
// sequences_remaining go stale between when it was computed and when it
// was actually delivered -- a second publish landed in the ~57s gap, so
// the count that arrived was true when computed and false when acted on.
// Sataana's fix on his end (event_at staleness guard) only prevents the
// bad revoke; it doesn't stop the count from being wrong. The actual fix,
// per Sataana's own suggestion, is to never let a stale count leave this
// file: fireSequenceDeletedRelay now takes a function that computes the
// count on demand, and fireSequenceRelay calls it fresh immediately before
// every send, including retries. A retried delete now always carries
// whatever is true right now, not whatever was true when the delete
// happened.
//
// 2026-08-08, later same day: both directions confirmed live against
// Sataana's actual bot -- grant, revoke, and the stale-count race all
// proven correct with the recompute in place. He asked, as an explicit
// "your call, not a request", for event_at on every event: his staleness
// guard is no longer load-bearing now that the recompute above closes the
// race properly, but it costs nothing to send and would catch a future
// regression if the recompute above ever silently breaks. Added below,
// stamped the same way idempotency_key already is -- fresh at construction
// for publish/update/edit, and freshly re-stamped at send time for deletes
// alongside the sequences_remaining recompute, since a delayed retry
// should report when it actually went out, not when the delete happened.

const RELAY_BASE_URL = 'https://discord.griphub.dev'
const RELAY_TIMEOUT_MS = 2500
const RETRY_DELAYS_MS = [500, 2000]

export type RelayEvent = 'published' | 'updated' | 'edited' | 'deleted'

export interface RelayPublishPayload {
  event: RelayEvent
  sequence: {
    slug: string
    title: string
    url: string
  }
  author: {
    user_id: string
    discord_id?: string
    // Required when event is 'deleted', ignored otherwise. The count of
    // published sequences this author has left after this deletion. Only
    // ever set from a real count taken fresh at send time -- never
    // guessed, never defaulted to 0, and never held over from an earlier
    // computation. See fireSequenceDeletedRelay below.
    sequences_remaining?: number
  }
  discord?: {
    thread_id: string
    thread_created: boolean
  }
  idempotency_key: string
  // ISO timestamp of when this event was actually sent (not when the
  // underlying action -- publish, delete -- happened). Optional on
  // Sataana's side; his guard treats its absence as "behave exactly as
  // before". For deletes it's re-stamped on every send attempt by
  // fireSequenceRelay, same lifecycle as the sequences_remaining refresh.
  event_at?: string
}

async function postWithTimeout(url: string, body: unknown, secret: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS)
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Relay-Secret': secret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function logRelayFailure(payload: RelayPublishPayload, lastError: string) {
  try {
    const admin = createAdminClient()
    await admin.from('relay_failures').insert({
      route: 'sequence-published',
      payload,
      error: lastError,
    })
  } catch (loggingError) {
    // If even the failure log fails, this is the one place a console.error
    // is the correct final fallback -- there is nowhere else left to put it.
    console.error('[relay] Failed to log relay failure to relay_failures:', loggingError)
    console.error('[relay] Original relay payload that failed:', payload, lastError)
  }
}

// Fire-and-forget from the caller's perspective: this function does its own
// retrying internally and never throws. Callers should invoke it without
// awaiting (or await it after their own response is already prepared) so a
// slow or failing relay never delays the user-facing request.
//
// refreshBeforeSend is optional. When provided, it's called immediately
// before every send attempt (including retries) and its result overwrites
// payload.author.sequences_remaining for that attempt. This is how a
// retried or delayed delete event picks up a current count instead of
// carrying whatever was true at construction time. Callers that don't need
// this (publish/update/edit) simply omit it and behavior is unchanged.
//
// event_at is re-stamped on every attempt too, whether or not
// refreshBeforeSend is provided -- it should always reflect when the
// network call actually went out, not when fireSequenceRelay was first
// invoked.
export async function fireSequenceRelay(
  payload: RelayPublishPayload,
  refreshBeforeSend?: () => Promise<number | null>,
): Promise<void> {
  const secret = process.env.DISCORD_RELAY_SECRET
  if (!secret) {
    console.error('[relay] DISCORD_RELAY_SECRET not configured, cannot fire relay event')
    return
  }

  const url = `${RELAY_BASE_URL}/relay/sequence-published`
  let lastError = ''

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (refreshBeforeSend) {
      // Recompute right before this specific attempt goes out. If the
      // refresh itself fails or comes back null, do not fall back to the
      // stale value already on the payload and do not default to 0 --
      // either would reintroduce the exact bug this exists to prevent.
      // Treat it as a transient failure and let the normal retry loop
      // below handle backoff, same as a network error would.
      const fresh = await refreshBeforeSend()
      if (fresh === null) {
        lastError = 'sequences_remaining refresh returned null, refusing to send a stale or guessed count'
        console.error('[relay]', lastError)
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt])
          continue
        }
        break
      }
      payload = {
        ...payload,
        author: { ...payload.author, sequences_remaining: fresh },
      }
    }

    payload = { ...payload, event_at: new Date().toISOString() }

    try {
      const res = await postWithTimeout(url, payload, secret)
      if (res.ok) return

      // A 4xx from Sataana's side (malformed payload, bad secret) will not
      // be fixed by retrying with the identical body -- retrying those
      // would just hammer his rate limit for no benefit. Only retry on 5xx
      // or network-level failures (caught below).
      const text = await res.text().catch(() => '')
      lastError = `HTTP ${res.status}: ${text}`
      if (res.status >= 400 && res.status < 500) {
        console.error('[relay] Sequence relay rejected (not retrying, client error):', lastError)
        await logRelayFailure(payload, lastError)
        return
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }

  console.error('[relay] Sequence relay failed after all retries:', lastError)
  await logRelayFailure(payload, lastError)
}

// Convenience wrapper for the publish/update/edit path, called from
// notify-discord once it already knows thread_id and thread_created.
export async function fireSequencePublishedRelay(args: {
  event: 'published' | 'updated' | 'edited'
  slug: string
  title: string
  userId: string
  threadId: string | null
  threadCreated: boolean
}): Promise<void> {
  const admin = createAdminClient()

  let discordId: string | undefined
  try {
    const { data, error } = await admin.rpc('lookup_discord_id_by_user_id', {
      p_user_id: args.userId,
    })
    if (!error && typeof data === 'string' && data.length > 0) {
      discordId = data
    }
  } catch (err) {
    // Not fatal -- Sataana's side will resolve it itself via relay-identity
    // if we don't send it. Just means one extra round trip on his end.
    console.error('[relay] Failed to pre-resolve discord_id for publish relay:', err)
  }

  const now = new Date().toISOString()
  const payload: RelayPublishPayload = {
    event: args.event,
    sequence: {
      slug: args.slug,
      title: args.title,
      url: `https://lazygrip.net/sequences/${args.slug}`,
    },
    author: {
      user_id: args.userId,
      ...(discordId ? { discord_id: discordId } : {}),
    },
    ...(args.threadId
      ? { discord: { thread_id: args.threadId, thread_created: args.threadCreated } }
      : {}),
    idempotency_key: `${args.slug}:${args.event}:${now}`,
    event_at: now,
  }

  await fireSequenceRelay(payload)
}

// Convenience wrapper for the delete path.
//
// getSequencesRemaining replaces a static sequencesRemaining number. It's
// called fresh immediately before every send attempt (including retries),
// so a delete that gets delayed or retried always reports the count that's
// true right now rather than the count that was true when the delete
// happened. The caller (the delete route) still does the original
// before-the-delete count for its own bookkeeping and to decide whether to
// proceed with the delete at all -- this callback is purely for what goes
// out on the wire, and it should re-query rather than close over that
// earlier value.
//
// Sataana was explicit: a "deleted" event with no count is rejected on his
// side as a 400, not assumed to be zero, because assuming zero is how
// someone with multiple sequences loses Forgemaster over a single
// deletion. Returning null from getSequencesRemaining is treated as a
// transient failure inside fireSequenceRelay (retried, never defaulted).
export async function fireSequenceDeletedRelay(args: {
  slug: string
  title: string
  userId: string
  getSequencesRemaining: () => Promise<number | null>
}): Promise<void> {
  const initialCount = await args.getSequencesRemaining()
  const now = new Date().toISOString()

  const payload: RelayPublishPayload = {
    event: 'deleted',
    sequence: {
      slug: args.slug,
      title: args.title,
      url: `https://lazygrip.net/sequences/${args.slug}`,
    },
    author: {
      user_id: args.userId,
      ...(initialCount !== null ? { sequences_remaining: initialCount } : {}),
    },
    idempotency_key: `${args.slug}:deleted:${now}`,
    event_at: now,
  }

  await fireSequenceRelay(payload, args.getSequencesRemaining)
}
