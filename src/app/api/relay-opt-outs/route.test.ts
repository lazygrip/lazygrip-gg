import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const rangeMock = vi.fn()

// The chain the route builds: from().select().eq().order().range()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: (from: number, to: number) => rangeMock(from, to),
          }),
        }),
      }),
    }),
  }),
}))

const SECRET = 'test-relay-secret-value'

function request(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/relay-opt-outs', { headers })
}

async function loadRoute() {
  vi.resetModules()
  return import('./route')
}

describe('GET /api/relay-opt-outs', () => {
  beforeEach(() => {
    process.env.DISCORD_RELAY_SECRET = SECRET
    rangeMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    delete process.env.DISCORD_RELAY_SECRET
    vi.restoreAllMocks()
  })

  it('refuses a request with no secret without touching the database', async () => {
    const { GET } = await loadRoute()
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(rangeMock).not.toHaveBeenCalled()
  })

  it('refuses a wrong secret', async () => {
    const { GET } = await loadRoute()
    const res = await GET(request({ 'x-relay-secret': 'nope' }))
    expect(res.status).toBe(401)
    expect(rangeMock).not.toHaveBeenCalled()
  })

  it('refuses everything when the secret is not configured, even an empty header match', async () => {
    delete process.env.DISCORD_RELAY_SECRET
    const { GET } = await loadRoute()
    const res = await GET(request({ 'x-relay-secret': '' }))
    expect(res.status).toBe(401)
    const res2 = await GET(request({ 'x-relay-secret': 'undefined' }))
    expect(res2.status).toBe(401)
    expect(rangeMock).not.toHaveBeenCalled()
  })

  it('returns only ids for the opted out creators', async () => {
    rangeMock.mockResolvedValueOnce({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    const { GET } = await loadRoute()
    const res = await GET(request({ 'x-relay-secret': SECRET }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, ids: ['a', 'b'] })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('keeps reading until a page comes back short, so a long list is not truncated', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: `id-${i}` }))
    rangeMock
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: [{ id: 'last' }], error: null })
    const { GET } = await loadRoute()
    const res = await GET(request({ 'x-relay-secret': SECRET }))
    const body = await res.json()
    expect(body.ids).toHaveLength(1001)
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 999)
    expect(rangeMock).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('answers an error, never a partial list, when the read fails', async () => {
    rangeMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const { GET } = await loadRoute()
    const res = await GET(request({ 'x-relay-secret': SECRET }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false, error: 'Lookup failed' })
  })

  it('rate limits after twelve calls in a minute', async () => {
    rangeMock.mockResolvedValue({ data: [], error: null })
    const { GET } = await loadRoute()
    for (let i = 0; i < 12; i++) {
      expect((await GET(request({ 'x-relay-secret': SECRET }))).status).toBe(200)
    }
    expect((await GET(request({ 'x-relay-secret': SECRET }))).status).toBe(429)
  })
})
