import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCsp, generateNonce } from './csp'

const SUPABASE = 'https://abcdefgh.supabase.co'

function directive(policy: string, name: string): string {
  const found = policy.split('; ').find(d => d === name || d.startsWith(name + ' '))
  if (!found) throw new Error(`no ${name} directive in: ${policy}`)
  return found
}

describe('generateNonce', () => {
  it('is base64 and long enough to be unguessable', () => {
    const n = generateNonce()
    expect(n).toMatch(/^[A-Za-z0-9+/]+=*$/)
    // 16 random bytes encode to 24 base64 characters
    expect(n.length).toBe(24)
  })

  it('is different every call', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateNonce()))
    expect(seen.size).toBe(50)
  })
})

describe('buildCsp script-src', () => {
  const policy = buildCsp('NONCEVALUE', { supabaseUrl: SUPABASE, isDev: false })
  const scriptSrc = directive(policy, 'script-src')

  it('carries the nonce', () => {
    expect(scriptSrc).toContain("'nonce-NONCEVALUE'")
  })

  it('does not allow inline scripts or eval in production', () => {
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
  })

  it('does not use strict-dynamic, so the host list keeps meaning something', () => {
    expect(scriptSrc).not.toContain("'strict-dynamic'")
  })

  it('still allows same-origin chunks and the one Google Tag Manager host', () => {
    expect(scriptSrc).toContain("'self'")
    expect(scriptSrc).toContain('https://www.googletagmanager.com')
  })

  it('allows eval only in development, which React needs for error stacks', () => {
    const dev = buildCsp('N', { supabaseUrl: SUPABASE, isDev: true })
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'")
  })
})

describe('buildCsp everything else', () => {
  const policy = buildCsp('N', { supabaseUrl: SUPABASE, isDev: false })

  it('keeps style-src inline, because the UI styles with React inline objects', () => {
    expect(directive(policy, 'style-src')).toContain("'unsafe-inline'")
  })

  it('derives the Supabase origins from the env value', () => {
    expect(directive(policy, 'connect-src')).toContain(SUPABASE)
    expect(directive(policy, 'connect-src')).toContain('wss://abcdefgh.supabase.co')
    expect(directive(policy, 'img-src')).toContain(SUPABASE)
  })

  it('never writes the word undefined when the Supabase URL is missing or junk', () => {
    for (const supabaseUrl of [undefined, '', 'not a url']) {
      const p = buildCsp('N', { supabaseUrl, isDev: false })
      expect(p).not.toContain('undefined')
      expect(p).not.toMatch(/\s{2,}/)
      expect(p).not.toContain(' ;')
    }
  })

  it('keeps the lockdown directives and the report endpoint', () => {
    expect(directive(policy, 'default-src')).toBe("default-src 'self'")
    expect(directive(policy, 'object-src')).toBe("object-src 'none'")
    expect(directive(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive(policy, 'frame-src')).toBe("frame-src 'none'")
    expect(policy).toContain('upgrade-insecure-requests')
    expect(policy).toContain('report-uri /api/csp-report')
    expect(policy).toContain('report-to csp')
  })

  it('has no wildcard image source', () => {
    expect(directive(policy, 'img-src')).not.toMatch(/(^|\s)(\*|https:|http:)(\s|$)/)
  })
})

// Regression guard for the other half of the change. The policy above only
// works if every EXECUTABLE inline <script> in the app carries the nonce, so
// this reads the one file that has them and fails if a new one appears without.
// JSON-LD blocks are data, not code, and are exempt.
describe('layout inline scripts', () => {
  const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')

  it('puts the nonce on the theme script and both Script components', () => {
    const tags = [...layout.matchAll(/<(script|Script)\b[\s\S]*?(?:\/>|>)/g)].map(m => m[0])
    expect(tags.length).toBeGreaterThanOrEqual(5)
    for (const tag of tags) {
      if (tag.includes('application/ld+json')) continue
      expect(tag, `executable script without a nonce: ${tag}`).toMatch(/nonce=\{nonce\}/)
    }
  })

  it('reads the nonce from the request header the middleware sets', () => {
    expect(layout).toContain("get('x-nonce')")
  })
})

describe('middleware', () => {
  const mw = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')

  it('sets the policy on the request as well as the response', () => {
    // Next reads the nonce back out of the REQUEST header to stamp its own
    // scripts. A response-only header leaves them un-nonced and the page dead.
    expect(mw).toContain("requestHeaders.set('Content-Security-Policy'")
    expect(mw).toContain("response.headers.set('Content-Security-Policy'")
    expect(mw).toContain("requestHeaders.set('x-nonce'")
  })
})
