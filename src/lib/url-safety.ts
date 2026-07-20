// URL allowlisting for user-supplied links and images (SEC7).
//
// Every user-controlled URL is validated the same way at write time and at
// render time: it must be an https URL whose host is on the field's allowlist.
// Anything else returns null, and callers skip rendering the link/image (or
// store null). Render-side use is the real security boundary -- it holds no
// matter how a value reached the database.

function parseHttps(raw: string | null | undefined): URL | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  return parsed
}

// warcraftlogs_url: https only, host must be warcraftlogs.com or a subdomain
// (www., classic., fresh. and regional variants all end in .warcraftlogs.com).
export function sanitizeWarcraftLogsUrl(raw: string | null | undefined): string | null {
  const parsed = parseHttps(raw)
  if (!parsed) return null
  const host = parsed.hostname.toLowerCase()
  if (host !== 'warcraftlogs.com' && !host.endsWith('.warcraftlogs.com')) return null
  return parsed.toString()
}

// avatar_url: https only, host must be the Supabase project host -- the only
// place avatars are ever written (storage.from('avatars').getPublicUrl()).
const AVATAR_HOST: string = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host.toLowerCase()
  } catch {
    return ''
  }
})()

export function sanitizeAvatarUrl(raw: string | null | undefined): string | null {
  const parsed = parseHttps(raw)
  if (!parsed) return null
  if (!AVATAR_HOST || parsed.host.toLowerCase() !== AVATAR_HOST) return null
  return parsed.toString()
}
