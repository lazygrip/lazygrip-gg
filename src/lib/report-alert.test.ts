import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReportAlert, sendReportAlert, type ReportDetails } from './report-alert'

const details: ReportDetails = {
  report_id: '11111111-1111-4111-8111-111111111111',
  message_id: '22222222-2222-4222-8222-222222222222',
  conversation_id: '33333333-3333-4333-8333-333333333333',
  sender_username: 'Sender',
  reporter_username: 'Reporter',
  reason: 'rude',
}

const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abc-DEF_123'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('buildReportAlert', () => {
  it('names both members, the reason and the lookup queries', () => {
    const alert = buildReportAlert(details, new Date('2026-10-22T00:00:00Z'))
    const fields = alert.embeds[0].fields
    expect(fields.find(f => f.name === 'Reported by')?.value).toBe('Reporter')
    expect(fields.find(f => f.name === 'Message sent by')?.value).toBe('Sender')
    expect(fields.find(f => f.name === 'Reason given')?.value).toBe('rude')
    expect(alert.embeds[0].description).toContain(details.message_id)
    expect(alert.embeds[0].description).toContain(details.conversation_id)
    expect(alert.embeds[0].timestamp).toBe('2026-10-22T00:00:00.000Z')
  })

  it('cannot ping anyone, whatever the reason says', () => {
    const alert = buildReportAlert({ ...details, reason: '@everyone look at this' }, new Date())
    expect(alert.allowed_mentions).toEqual({ parse: [] })
  })

  it('says so when no reason was given', () => {
    const alert = buildReportAlert({ ...details, reason: null }, new Date())
    expect(alert.embeds[0].fields.find(f => f.name === 'Reason given')?.value).toBe('(none given)')
  })

  it('keeps a long reason inside what Discord accepts for one field', () => {
    const alert = buildReportAlert({ ...details, reason: 'a'.repeat(5000) }, new Date())
    expect(alert.embeds[0].fields.find(f => f.name === 'Reason given')!.value.length).toBeLessThanOrEqual(1000)
  })
})

describe('sendReportAlert', () => {
  it('sends nothing and does not throw when the webhook is not set', async () => {
    vi.stubEnv('DISCORD_REPORT_WEBHOOK_URL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(sendReportAlert(details)).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to the webhook when configured', async () => {
    vi.stubEnv('DISCORD_REPORT_WEBHOOK_URL', WEBHOOK)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)
    await sendReportAlert(details)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(WEBHOOK)
    const body = JSON.parse(init.body)
    expect(body.embeds[0].title).toBe('A private message was reported')
    expect(init.body).not.toContain('Hello')
  })

  it('refuses to post anywhere that is not a Discord webhook address', async () => {
    vi.stubEnv('DISCORD_REPORT_WEBHOOK_URL', 'https://example.test/hook')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await sendReportAlert(details)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows a Discord failure so a report is never lost to an alert problem', async () => {
    vi.stubEnv('DISCORD_REPORT_WEBHOOK_URL', WEBHOOK)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sendReportAlert(details)).resolves.toBeUndefined()
  })

  it('refuses to build a query around an id that is not a uuid', async () => {
    vi.stubEnv('DISCORD_REPORT_WEBHOOK_URL', WEBHOOK)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await sendReportAlert({ ...details, message_id: "x'; drop table messages; --" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
