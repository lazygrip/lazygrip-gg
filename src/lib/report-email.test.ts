import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReportEmailText, sendReportAlert, type ReportDetails } from './report-email'

const details: ReportDetails = {
  report_id: '11111111-1111-4111-8111-111111111111',
  message_id: '22222222-2222-4222-8222-222222222222',
  conversation_id: '33333333-3333-4333-8333-333333333333',
  sender_username: 'Sender',
  reporter_username: 'Reporter',
  reason: 'rude',
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('buildReportEmailText', () => {
  it('names both members, the reason and the lookup queries', () => {
    const text = buildReportEmailText(details, new Date('2026-10-22T00:00:00Z'))
    expect(text).toContain('Reported by: Reporter')
    expect(text).toContain('Message sent by: Sender')
    expect(text).toContain('Reason given: rude')
    expect(text).toContain(details.message_id)
    expect(text).toContain(details.conversation_id)
    expect(text).toContain('2026-10-22T00:00:00.000Z')
  })

  it('says so when no reason was given', () => {
    const text = buildReportEmailText({ ...details, reason: null }, new Date())
    expect(text).toContain('Reason given: (none given)')
  })
})

describe('sendReportAlert', () => {
  it('sends nothing and does not throw when the keys are not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('REPORT_EMAIL_TO', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(sendReportAlert(details)).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to the provider with the key and the owner address when configured', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('REPORT_EMAIL_TO', 'owner@example.test')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    await sendReportAlert(details)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer test-key')
    const body = JSON.parse(init.body)
    expect(body.to).toEqual(['owner@example.test'])
    expect(body.text).toContain('Reported by: Reporter')
  })

  it('swallows a provider failure so a report is never lost to an email problem', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('REPORT_EMAIL_TO', 'owner@example.test')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sendReportAlert(details)).resolves.toBeUndefined()
  })

  it('refuses to build a query around an id that is not a uuid', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('REPORT_EMAIL_TO', 'owner@example.test')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await sendReportAlert({ ...details, message_id: "x'; drop table messages; --" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
