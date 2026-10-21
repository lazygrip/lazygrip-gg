// Posts an alert to the site owner's private Discord channel when a private
// message is reported.
//
// The report itself is already stored by the time this runs, so nothing here can
// lose one: a missing webhook, a Discord outage or a timeout means no alert and a
// line in the server log, and the report is still in message_reports. That is
// deliberate. The alert is a convenience on top of the record, and it must never
// be able to fail the person who pressed Report.
//
// What the alert carries is usernames, the reason the reporter typed, and the
// queries needed to look the message up. It does NOT carry the message text. A
// private message posted to Discord is a copy of it somewhere else, and the
// owner can read the text in one query in the Supabase SQL editor when they
// decide a report needs it.
//
// One server-only environment variable switches it on:
//   DISCORD_REPORT_WEBHOOK_URL   a webhook for a PRIVATE channel only the owner
//                                can see. Not the sequence forum webhook, and not
//                                a channel in a community server.
// Unset means the alert is skipped. A webhook URL is a credential: anyone who has
// it can post to that channel, so it lives in the host's environment settings and
// never in the repository.

export type ReportDetails = {
  report_id: string
  message_id: string
  conversation_id: string
  sender_username: string | null
  reporter_username: string | null
  reason: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WEBHOOK_RE = /^https:\/\/(?:canary\.|ptb\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/

export function buildReportAlert(d: ReportDetails, reportedAt: Date) {
  const reason = d.reason && d.reason.trim() ? d.reason.trim() : '(none given)'
  const queries = [
    '-- the reported message',
    `select body, created_at from public.messages where id = '${d.message_id}';`,
    '',
    '-- the conversation around it',
    `select (select username from public.profiles where id = sender_id) as sender, body, created_at from public.messages where conversation_id = '${d.conversation_id}' order by created_at;`,
    '',
    '-- every report so far',
    'select * from public.message_reports order by created_at desc;',
  ].join('\n')

  return {
    username: 'LazyGrip reports',
    // Nothing in an alert can ping anyone, whatever the reporter typed into the reason.
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        title: 'A private message was reported',
        color: 0xc0392b,
        timestamp: reportedAt.toISOString(),
        fields: [
          { name: 'Reported by', value: d.reporter_username ?? 'unknown', inline: true },
          { name: 'Message sent by', value: d.sender_username ?? 'unknown', inline: true },
          { name: 'Reason given', value: reason.slice(0, 1000) },
          {
            name: 'To read it',
            value: 'The message text is not in this alert. Run these in the Supabase SQL editor.',
          },
        ],
        description: '```sql\n' + queries + '\n```',
      },
    ],
  }
}

export async function sendReportAlert(details: ReportDetails): Promise<void> {
  const webhook = process.env.DISCORD_REPORT_WEBHOOK_URL
  if (!webhook) {
    console.warn('[report-alert] DISCORD_REPORT_WEBHOOK_URL is not set, so no alert was sent. The report is saved in message_reports.')
    return
  }

  // Only ever post to a Discord webhook address, so a mistyped or tampered
  // setting cannot turn this into a request to somewhere else.
  if (!WEBHOOK_RE.test(webhook)) {
    console.error('[report-alert] DISCORD_REPORT_WEBHOOK_URL is not a Discord webhook address, alert not sent')
    return
  }

  // The ids are interpolated into SQL shown in the alert. They come out of the
  // database, so they are uuids, but the shape is checked anyway so a surprise
  // can never put anything else in a query someone is about to paste.
  if (!UUID_RE.test(details.message_id) || !UUID_RE.test(details.conversation_id)) {
    console.error('[report-alert] unexpected id shape, alert not sent')
    return
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildReportAlert(details, new Date())),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error(`[report-alert] Discord answered ${res.status}, alert not sent`)
    }
  } catch (err) {
    console.error('[report-alert] could not reach Discord:', err instanceof Error ? err.message : 'unknown error')
  }
}
