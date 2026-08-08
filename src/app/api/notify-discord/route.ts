import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fireSequencePublishedRelay } from '@/lib/relay'

const CONTENT_TYPE_LABELS: Record<string, string> = {
  mythic_plus: 'Mythic+',
  raid: 'Raid',
  leveling: 'Leveling',
  open_world: 'Open World',
  pvp: 'PvP',
}
const CLASS_COLORS: Record<string, number> = {
  'Death Knight': 0xC41E3A,
  'Demon Hunter': 0xA330C9,
  'Druid': 0xFF7C0A,
  'Evoker': 0x33937F,
  'Hunter': 0xAAD372,
  'Mage': 0x3FC7EB,
  'Monk': 0x00FF98,
  'Paladin': 0xF48CBA,
  'Priest': 0xFFFFFF,
  'Rogue': 0xFFF468,
  'Shaman': 0x0070DD,
  'Warlock': 0x8788EE,
  'Warrior': 0xC69B3A,
}

const SLUG_RE = /^[a-z0-9-]{1,120}$/
const SNOWFLAKE_RE = /^\d{17,20}$/

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const raw = (await req.json()) as Record<string, unknown>

    const slug = raw.slug
    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
      return NextResponse.json({ ok: false, error: 'Invalid slug' }, { status: 400 })
    }

    const classNameRaw = raw.className
    const contentTypeRaw = raw.contentType
    const title = cleanText(raw.title, 200) || 'Untitled sequence'
    const className = typeof classNameRaw === 'string' && classNameRaw in CLASS_COLORS ? classNameRaw : ''
    const specName = cleanText(raw.specName, 60)
    const heroTalent = cleanText(raw.heroTalent, 60)
    const contentType = typeof contentTypeRaw === 'string' && contentTypeRaw in CONTENT_TYPE_LABELS ? contentTypeRaw : ''
    const isUpdate = raw.isUpdate
    const isEdit = raw.isEdit
    const metaUsername = user.user_metadata?.username
    const authorUsername: string =
      (typeof metaUsername === 'string' ? metaUsername : user.email) ?? 'unknown'

    const admin = createAdminClient()

    const { data: sequenceRow, error: lookupError } = await admin
      .from('sequences')
      .select('discord_thread_id')
      .eq('slug', slug)
      .single()

    if (lookupError) {
      console.error('[notify-discord] Failed to look up sequence:', lookupError)
    }

    const storedThreadId = sequenceRow?.discord_thread_id ?? null
    const existingThreadId = storedThreadId && SNOWFLAKE_RE.test(storedThreadId) ? storedThreadId : null

    const color = CLASS_COLORS[className] ?? 0x1D9E75
    const specPart = specName ? `${specName} ` : ''
    const heroTalentPart = heroTalent ? ` — ${heroTalent}` : ''
    const contentLabel = CONTENT_TYPE_LABELS[contentType] ?? contentType
    const url = `https://lazygrip.net/sequences/${slug}`

    let embedTitle = title
    if (isEdit) embedTitle = `📝 ${title}`
    else if (isUpdate) embedTitle = `🔄 ${title}`

    const embed = {
      title: embedTitle,
      url,
      color,
      description: `**${specPart}${className}${heroTalentPart}** — ${contentLabel}`,
      author: {
        name: 'LazyGrip.net',
        url: 'https://lazygrip.net',
      },
      footer: {
        text: `Posted by ${authorUsername} · lazygrip.net`,
      },
      timestamp: new Date().toISOString(),
    }

    const postUrl = existingThreadId
      ? `${webhookUrl}?thread_id=${existingThreadId}&wait=true`
      : `${webhookUrl}?wait=true`

    const body: Record<string, unknown> = {
      embeds: [embed],
      username: 'LazyGrip',
    }

    if (!existingThreadId) {
      const threadPrefix = isEdit ? 'Edit: ' : isUpdate ? 'Updated: ' : 'New: '
      body.thread_name = `${threadPrefix}${title}`
    }

    let res = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    let retriedAsNewThread = false
    if (!res.ok && existingThreadId) {
      const failText = await res.text()
      console.error(
        '[notify-discord] Post into existing thread failed, retrying as new thread:',
        res.status,
        failText,
      )
      const retryBody: Record<string, unknown> = { ...body }
      const threadPrefix = isEdit ? 'Edit: ' : isUpdate ? 'Updated: ' : 'New: '
      retryBody.thread_name = `${threadPrefix}${title}`
      res = await fetch(`${webhookUrl}?wait=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryBody),
      })
      retriedAsNewThread = true
    }

    if (!res.ok) {
      const text = await res.text()
      console.error('[notify-discord] Discord rejected webhook:', res.status, text)
      return NextResponse.json({ ok: false, error: 'Discord rejected the webhook' }, { status: 502 })
    }

    const responseData = await res.json()

    const isNewThread = !existingThreadId || retriedAsNewThread
    let newThreadId: string | null = null
    if (isNewThread) {
      const candidate = responseData?.channel_id
      if (typeof candidate === 'string' && SNOWFLAKE_RE.test(candidate)) {
        newThreadId = candidate
      } else {
        console.error(
          '[notify-discord] New-thread response missing a valid channel_id, not persisting a thread id:',
          responseData,
        )
      }
    }

    const updatePayload: Record<string, unknown> = {
      last_discord_notified_at: new Date().toISOString(),
    }
    if (newThreadId) {
      updatePayload.discord_thread_id = newThreadId
    }

    const { error: updateError } = await admin
      .from('sequences')
      .update(updatePayload)
      .eq('slug', slug)

    let threadLinkWarning: string | null = null
    if (updateError) {
      console.error('[notify-discord] Failed to write back thread id, retrying once:', updateError)

      const { error: retryUpdateError } = await admin
        .from('sequences')
        .update(updatePayload)
        .eq('slug', slug)

      if (retryUpdateError) {
        console.error('[notify-discord] Retry also failed to write back thread id:', retryUpdateError)
        // Do NOT return here. Whether this site's own copy of the thread
        // id got saved is unrelated to whether Sataana's bot should be
        // told the publish happened -- a Discord thread genuinely exists
        // at this point regardless of what Supabase does next. Returning
        // early here previously skipped fireSequencePublishedRelay
        // entirely with no exception and nothing logged to
        // relay_failures, which is exactly the failure mode that made a
        // real publish invisible to Sataana's bot on 2026-08-08 with zero
        // trace in any log. Record the warning and keep going so the
        // relay call below still fires.
        threadLinkWarning =
          'Discord notification sent, but the site could not save the thread link. A future edit may create a duplicate thread.'
      }
    }

    // Fire the relay to Sataana's gripbot now that we know the resolved
    // thread id and whether it was newly created. This now runs
    // unconditionally after a successful Discord post, regardless of
    // whether the thread-id write-back above succeeded -- those are two
    // independent concerns and a failure in one must never silently
    // suppress the other.
    //
    // SCHEDULED WITH after() RATHER THAN LEFT AS A FLOATING PROMISE. This
    // used to be a bare call whose promise nobody held, immediately followed
    // by the return below. On a serverless platform the invocation can be
    // frozen or torn down the moment the response is returned, and anything
    // still pending goes with it. fireSequencePublishedRelay awaits a
    // Supabase round trip (the discord_id lookup) BEFORE its outbound fetch,
    // so the handler reached its return while the relay was still parked on
    // that first await and the request never left the process. That produces
    // a specific and very confusing signature: nothing arrives at the bot AND
    // nothing is written to relay_failures, because that insert sits
    // downstream of the fetch that never happened. The Discord thread is
    // still created, because that work is awaited above.
    //
    // after() hands the promise to the platform's waitUntil, which keeps the
    // invocation alive until it settles. It does NOT block or delay this
    // response, so the fire-and-forget contract with the bot is unchanged and
    // a slow or unreachable gripbot still cannot fail a publish. The relay
    // helper keeps owning its own retries and failure logging.
    //
    // Note that after() runs within the route's max duration, so the retry
    // ladder in relay.ts (three attempts, 2.5s timeout each, 0.5s and 2s
    // backoff) is bounded by that budget rather than by itself.
    const finalThreadId = newThreadId ?? existingThreadId
    const relayEvent = isEdit ? 'edited' : isUpdate ? 'updated' : 'published'
    after(() =>
      fireSequencePublishedRelay({
        event: relayEvent,
        slug,
        title,
        userId: user.id,
        threadId: finalThreadId,
        threadCreated: isNewThread && newThreadId !== null,
      }).catch((err) => {
        // fireSequencePublishedRelay already handles and logs its own
        // failures internally -- this catch only guards against a truly
        // unexpected throw so it can never affect the response below.
        console.error('[notify-discord] Unexpected error firing sequence relay:', err)
      }),
    )

    if (threadLinkWarning) {
      return NextResponse.json({ ok: true, warning: threadLinkWarning })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify-discord] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
