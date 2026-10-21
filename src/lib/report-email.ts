// Emails the site owner when a private message is reported.
//
// The report itself is already stored by the time this runs, so nothing here can
// lose one: a missing key, a provider outage or a timeout means no email, and a
// line in the server log, and the report is still in message_reports. That is
// deliberate. The alert is a convenience on top of the record, and it must never
// be able to fail the person who pressed Report.
//
// What the email carries is usernames, the reason the reporter typed, and the
// ids needed to look the message up. It does NOT carry the message text. A
// private message sent through a third-party mail provider is a copy of it
// somewhere else, and the owner can read the text in one query in the Supabase
// SQL editor when they decide a report needs it.
//
// Two environment variables switch it on, both server-only:
//   RESEND_API_KEY    an API key from resend.com
//   REPORT_EMAIL_TO   the address to alert
// With either unset the alert is skipped. REPORT_EMAIL_FROM is optional; the
// default sender is Resend's shared test address, which Resend only delivers to
// the email the Resend account was opened with. Verify lazygrip.net in Resend
// and set REPORT_EMAIL_FROM to send from your own domain.

export type ReportDetails = {
  report_id: string
  message_id: string
  conversation_id: string
  sender_username: string | null
  reporter_username: string | null
  reason: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildReportEmailText(d: ReportDetails, reportedAt: Date): string {
  const reason = d.reason && d.reason.trim() ? d.reason.trim() : '(none given)'
  return [
    'A private message was reported on LazyGrip.',
    '',
    `Reported by: ${d.reporter_username ?? 'unknown'}`,
    `Message sent by: ${d.sender_username ?? 'unknown'}`,
    `Reason given: ${reason}`,
    `Reported at: ${reportedAt.toISOString()}`,
    '',
    'The message text is not in this email. To read the reported message, run this in the Supabase SQL editor:',
    '',
    `select body, created_at from public.messages where id = '${d.message_id}';`,
    '',
    'To read the conversation around it:',
    '',
    `select (select username from public.profiles where id = sender_id) as sender, body, created_at from public.messages where conversation_id = '${d.conversation_id}' order by created_at;`,
    '',
    'To see every report that has been filed:',
    '',
    'select * from public.message_reports order by created_at desc;',
  ].join('\n')
}

export async function sendReportAlert(details: ReportDetails): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.REPORT_EMAIL_TO
  if (!apiKey || !to) {
    console.warn('[report-email] RESEND_API_KEY or REPORT_EMAIL_TO is not set, so no alert was sent. The report is saved in message_reports.')
    return
  }

  // The ids are interpolated into SQL shown in the email. They come out of the
  // database, so they are uuids, but the shape is checked anyway so a surprise
  // can never put anything else in a query someone is about to paste.
  if (!UUID_RE.test(details.message_id) || !UUID_RE.test(details.conversation_id)) {
    console.error('[report-email] unexpected id shape, alert not sent')
    return
  }

  const from = process.env.REPORT_EMAIL_FROM || 'LazyGrip <onboarding@resend.dev>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'A private message was reported on LazyGrip',
        text: buildReportEmailText(details, new Date()),
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error(`[report-email] provider answered ${res.status}, alert not sent`)
    }
  } catch (err) {
    console.error('[report-email] could not reach the provider:', err instanceof Error ? err.message : 'unknown error')
  }
}
