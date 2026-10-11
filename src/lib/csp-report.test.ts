import { describe, it, expect } from 'vitest'
import { parseCspReports, MAX_REPORTS_PER_REQUEST } from './csp-report'

describe('parseCspReports', () => {
  it('reads the legacy report-uri shape', () => {
    const out = parseCspReports({
      'csp-report': {
        'document-uri': 'https://lazygrip.net/browse',
        'violated-directive': 'img-src',
        'effective-directive': 'img-src',
        'blocked-uri': 'https://example.com/x.png',
        disposition: 'report',
      },
    })
    expect(out).toEqual([
      { directive: 'img-src', blocked: 'https://example.com/x.png', page: 'https://lazygrip.net/browse', source: '', line: '', disposition: 'report' },
    ])
  })

  it('reads the Reporting API shape', () => {
    const out = parseCspReports([
      { type: 'csp-violation', body: { effectiveDirective: 'script-src-elem', blockedURL: 'inline', documentURL: 'https://lazygrip.net/', lineNumber: 12, sourceFile: 'https://lazygrip.net/', disposition: 'report' } },
    ])
    expect(out[0]).toMatchObject({ directive: 'script-src-elem', blocked: 'inline', line: '12' })
  })

  it('strips control characters so a report cannot forge a log line', () => {
    const out = parseCspReports({ 'csp-report': { 'blocked-uri': 'https://a.test/\n[csp-report] {"fake":true}' } })
    expect(out[0].blocked).not.toContain('\n')
  })

  it('caps field length and the number of reports', () => {
    const long = 'x'.repeat(5000)
    const out = parseCspReports(Array.from({ length: 20 }, () => ({ 'csp-report': { 'blocked-uri': long } })))
    expect(out.length).toBe(MAX_REPORTS_PER_REQUEST)
    expect(out[0].blocked.length).toBeLessThanOrEqual(300)
  })

  it('ignores junk without throwing', () => {
    expect(parseCspReports(null)).toEqual([])
    expect(parseCspReports('hello')).toEqual([])
    expect(parseCspReports([1, null, { nothing: true }])).toEqual([])
  })
})
