import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReportAlert, type ReportDetails } from '@/lib/report-alert'

// Reporting a private message goes through here, and no longer straight from the
// browser, so that a new report can alert the site owner on Discord. Migration 052 takes
// report_message away from signed-in members entirely and leaves it to the
// service role, which makes this route the only way a report can be filed.
//
// WHO THE REPORTER IS comes from the session below and never from the request
// body. The body names a message and a reason and nothing else, so there is no
// field a caller could use to file a report as someone else.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Sign in to report a message.' }, { status: 401 })
  }

  if (!(req.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 415 })
  }

  let raw: Record<string, unknown>
  try {
    raw = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const messageId = raw.messageId
  if (typeof messageId !== 'string' || !UUID_RE.test(messageId)) {
    return NextResponse.json({ ok: false, error: 'Invalid message.' }, { status: 400 })
  }

  const reasonRaw = raw.reason
  if (reasonRaw != null && typeof reasonRaw !== 'string') {
    return NextResponse.json({ ok: false, error: 'Invalid reason.' }, { status: 400 })
  }
  const reason = typeof reasonRaw === 'string' ? reasonRaw : null
  if (reason && reason.length > 500) {
    return NextResponse.json({ ok: false, error: 'Keep the reason under 500 characters.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('report_message', {
    p_reporter_id: user.id,
    p_message_id: messageId,
    p_reason: reason,
  })

  if (error) {
    if (error.code === 'P0002') {
      return NextResponse.json({ ok: false, error: 'That message could not be found.' }, { status: 404 })
    }
    if (error.code === 'P0001') {
      return NextResponse.json({ ok: false, error: error.message }, { status: 429 })
    }
    if (error.code === '22023') {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }
    console.error('[report-message] rpc failed:', error.code)
    return NextResponse.json({ ok: false, error: 'That report could not be sent. Try again in a moment.' }, { status: 500 })
  }

  const result = data as (ReportDetails & { inserted: boolean }) | null
  // Only a report that was actually new sends an alert, so pressing Report twice
  // on the same message is one alert and not two.
  if (result?.inserted) {
    after(() => sendReportAlert(result))
  }

  return NextResponse.json({ ok: true })
}
