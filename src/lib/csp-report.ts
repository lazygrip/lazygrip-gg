// src/lib/csp-report.ts
//
// Turns the body of a Content-Security-Policy violation report into one short,
// log-safe record. Browsers send two shapes and both are handled:
//
//   legacy report-uri   {"csp-report": {"violated-directive": ..., "blocked-uri": ...}}
//   Reporting API       [{"type": "csp-violation", "body": {"effectiveDirective": ..., "blockedURL": ...}}]
//
// The input is whatever an unauthenticated caller chose to POST, so every field
// is coerced to a short string with control characters removed. A report that
// carries a newline would otherwise be able to forge a second log line.

export type CspRecord = {
  directive: string
  blocked: string
  page: string
  source: string
  line: string
  disposition: string
}

const MAX_FIELD = 300
export const MAX_REPORTS_PER_REQUEST = 5

function clean(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, MAX_FIELD)
}

function pick(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = clean(body[key])
    if (v) return v
  }
  return ''
}

export function parseCspReports(parsed: unknown): CspRecord[] {
  const items = Array.isArray(parsed) ? parsed : [parsed]
  const out: CspRecord[] = []
  for (const item of items.slice(0, MAX_REPORTS_PER_REQUEST)) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const legacy = obj['csp-report']
    const body = (legacy && typeof legacy === 'object' ? legacy : obj.body) as Record<string, unknown> | undefined
    if (!body || typeof body !== 'object') continue
    out.push({
      directive: pick(body, 'effectiveDirective', 'effective-directive', 'violated-directive', 'violatedDirective'),
      blocked: pick(body, 'blockedURL', 'blocked-uri', 'blockedUri'),
      page: pick(body, 'documentURL', 'document-uri', 'documentUri'),
      source: pick(body, 'sourceFile', 'source-file'),
      line: pick(body, 'lineNumber', 'line-number'),
      disposition: pick(body, 'disposition'),
    })
  }
  return out
}
