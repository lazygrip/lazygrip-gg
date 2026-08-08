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
//   1. Fire the request with a short timeout (2.5s, inside his 2-3s ask).
//   2. On failure, retry twice with backoff (0.5s, 2s) -- transient network
//      blips and cold starts on his end are the common case, not a reason
//      to immediately give up or immediately queue.
//   3. If all attempts fail, log to relay_failures so a human can see it --
//      never just a console.error that scrolls off into Vercel's log
//      retention window unseen. This is the "don't swallow it" half.
//   4. The calling route's response to the user is never blocked on or
//      affected by any of this -- callers should not await this in a way
//      that delays their own response. Call it and let it run.

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
    // ever set from a real count taken before the row was removed -- never
    // guessed, never defaulted to 0. See fireDeletedRelay below.
    sequences_remaining?: number
  }
  discord?: {
    thread_id: string
    thread_created: boolean
  }
  idempotency_key: string
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
export async function fireSequenceRelay(payload: RelayPublishPayload): Promise<void> {
  const secret = process.env.DISCORD_RELAY_SECRET
  if (!secret) {
    console.error('[relay] DISCORD_RELAY_SECRET not configured, cannot fire relay event')
    return
  }

  const url = `${RELAY_BASE_URL}/relay/sequence-published`
  let lastError = ''

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
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
    idempotency_key: `${args.slug}:${args.event}:${new Date().toISOString()}`,
  }

  await fireSequenceRelay(payload)
}

// Convenience wrapper for the delete path. sequencesRemaining MUST be a real
// count taken before the row was deleted -- see the delete route for where
// that count comes from. Sataana was explicit: a "deleted" event with no
// count is rejected on his side as a 400, not assumed to be zero, because
// assuming zero is how someone with multiple sequences loses Forgemaster
// over a single deletion.
export async function fireSequenceDeletedRelay(args: {
  slug: string
  title: string
  userId: string
  sequencesRemaining: number
}): Promise<void> {
  const payload: RelayPublishPayload = {
    event: 'deleted',
    sequence: {
      slug: args.slug,
      title: args.title,
      url: `https://lazygrip.net/sequences/${args.slug}`,
    },
    author: {
      user_id: args.userId,
      sequences_remaining: args.sequencesRemaining,
    },
    idempotency_key: `${args.slug}:deleted:${new Date().toISOString()}`,
  }

  await fireSequenceRelay(payload)
}
