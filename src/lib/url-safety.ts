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

// The object key every upload path mints is `${profile.id}.${ext}` against a
// fixed bucket, so the whole public URL is known in advance:
//
//     https://<project>.supabase.co/storage/v1/object/public/<bucket>/<uuid>.<ext>
//
// and the handlers append a `?t=<ms>` cache-buster on top. MEASURED against
// the live corpus on 2026-09-17 rather than assumed: of 341 profiles, the 19
// avatar_url values on the Supabase host are ALL <uuid>.<ext>, and the single
// banner_url value is too. The extensions present are png (13), jpg (4),
// jpeg (1) and **PNG (1)** -- one uppercase, which is why the comparison below
// lowercases the extension instead of matching the allowlist literally.
// Everything else in that column is a cdn.discordapp.com URL written by
// handle_new_user() from the OAuth provider's metadata, and those were already
// rejected by the host check before this change.
const STORAGE_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// SEC / audit M7: "validates host only, never path or extension". The host
// check alone lets any path on the project host through, including one carrying
// the characters that break out of a CSS url() token -- see cssUrl below, which
// is the second and independent layer. This is the first: a value that is not
// shaped like something one of our own upload handlers wrote is not rendered.
function sanitizeStorageImageUrl(
  raw: string | null | undefined,
  bucket: 'avatars' | 'banners',
): string | null {
  const parsed = parseHttps(raw)
  if (!parsed) return null
  if (!AVATAR_HOST || parsed.host.toLowerCase() !== AVATAR_HOST) return null

  const prefix = `/storage/v1/object/public/${bucket}/`
  if (!parsed.pathname.startsWith(prefix)) return null

  // decodeURIComponent so a percent-encoded separator cannot smuggle a second
  // path segment past the check below. A key that does not decode is rejected
  // rather than used as-is.
  let key: string
  try {
    key = decodeURIComponent(parsed.pathname.slice(prefix.length))
  } catch {
    return null
  }
  if (!key || key.includes('/')) return null

  const dot = key.lastIndexOf('.')
  if (dot <= 0) return null
  if (!STORAGE_IMAGE_EXTENSIONS.has(key.slice(dot + 1).toLowerCase())) return null
  if (!UUID_RE.test(key.slice(0, dot))) return null

  return parsed.toString()
}

export function sanitizeAvatarUrl(raw: string | null | undefined): string | null {
  return sanitizeStorageImageUrl(raw, 'avatars')
}

// banner_url (migration 030): written the same way avatar_url is, into a
// different bucket. It was `= sanitizeAvatarUrl` until 2026-09-17, which was
// accurate while the rule was host-only and stopped being accurate the moment
// the rule became path-aware: an avatars/ key and a banners/ key are not
// interchangeable, and aliasing the two would have let a banner value point at
// the avatars bucket and vice versa.
export function sanitizeBannerUrl(raw: string | null | undefined): string | null {
  return sanitizeStorageImageUrl(raw, 'banners')
}

// The write half of the same allowlist. Both upload handlers did
//
//     const ext = file.name.split('.').pop()
//
// with no allowlist at all (ProfileTabs.tsx:1074 avatar, :1102 banner -- audit
// M7, still open and duplicated when PART 7 was written), so the object key was
// `${profile.id}.${anything the file happened to be called}`. Two consequences,
// and the second is the one that matters:
//
//   1. A file with no dot in its name produced a key equal to the whole file
//      name, and `pop()` on `['name']` returns 'name', not undefined -- so the
//      key silently became `<uuid>.name`.
//   2. **SVG.** An .svg accepted into a public bucket on the project host is a
//      same-origin document that executes script when opened directly, which is
//      a materially different class from a broken image. It is absent from
//      STORAGE_IMAGE_EXTENSIONS deliberately, and this comment is here so
//      nobody adds it back for "logo support".
//
// The MIME cross-check is what stops the rename. `file.type` is browser-derived
// from content sniffing plus the extension, so it is not a guarantee on its
// own; it is a cheap second opinion that disagrees loudly when someone renames
// evil.svg to evil.png. When the browser reports no type at all, the extension
// allowlist still has to pass, so the failure direction is "accept a correctly
// named image", not "accept anything".
const EXTENSION_MIME: Record<string, readonly string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  avif: ['image/avif'],
}

/**
 * The lowercased, allowlisted extension for an upload, or null to refuse it.
 *
 * Lowercased on purpose: the live corpus carries one avatar key ending `.PNG`,
 * written before this existed. The reader (sanitizeStorageImageUrl) still
 * accepts it, and this makes sure no new key is minted in that shape.
 */
export function allowedUploadExtension(
  fileName: string | null | undefined,
  mimeType?: string | null,
): string | null {
  if (typeof fileName !== 'string') return null
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return null

  const ext = fileName.slice(dot + 1).toLowerCase()
  if (!STORAGE_IMAGE_EXTENSIONS.has(ext)) return null

  const declared = typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : ''
  if (declared && !EXTENSION_MIME[ext].includes(declared)) return null

  return ext
}

export const UPLOAD_EXTENSION_REJECTED_MESSAGE =
  'That file type is not supported. Use a PNG, JPG, WEBP, GIF or AVIF image.'

// Characters that end a QUOTED CSS url("...") token, plus the ones that end a
// declaration outright. Rejected rather than escaped, deliberately: escaping is
// a transformation whose correctness depends on the exact CSS context the value
// lands in, and there is no legitimate Supabase Storage URL containing any of
// them -- so rejection costs nothing real and cannot be got wrong by a later
// caller pasting the result somewhere else.
//
// AUDIT F7.1, the reason this exists. `url(${safeBannerUrl})` was UNQUOTED at
// user/[username]/page.tsx:243 and ProfileTabs.tsx:1531. `URL.toString()`
// percent-encodes `"`, `<` and `>` but PRESERVES `(`, `)` and `;`, so a
// banner_url ending `...png);color:red;x:url(y` closed the background
// declaration and opened a second real one on every public profile. Not script
// execution -- `"` cannot survive, so there is no attribute breakout -- but a
// persistent `background-image: url(https://attacker/log)` on a page any
// visitor can load.
const CSS_URL_BREAKOUT_RE = /["'()\\;]|[\r\n\f\t]/

/**
 * Wrap an already-sanitized URL as a complete, quoted CSS `url("...")` token.
 *
 * Returns the whole token rather than the bare value on purpose: there is then
 * no shape in which a caller can use the result unquoted, which is the defect
 * this replaces. Returns null for anything carrying a character that could
 * terminate the token or the declaration, so `background: cssUrl(x) ?? fallback`
 * degrades to the fallback rather than emitting something half-escaped.
 */
export function cssUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (CSS_URL_BREAKOUT_RE.test(trimmed)) return null
  return `url("${trimmed}")`
}

// social_links values (migration 030): unlike every other sanitized field on
// this page, these are free-text creator input with no fixed host to check
// against -- a creator can link any platform. The Settings tab's own
// placeholders ("twitch.tv/yourchannel") show bare host+path with no scheme,
// so that's the expected shape, not an edge case.
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

export function sanitizeSocialLinkUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const schemeMatch = trimmed.match(SCHEME_RE)
  let candidate: string
  if (schemeMatch) {
    // An explicit scheme is present -- javascript:, data:, mailto: and so on
    // are all rejected outright rather than stripped or upgraded. Only a
    // literal https: scheme is let through as typed.
    if (!/^https:$/i.test(schemeMatch[0])) return null
    candidate = trimmed
  } else {
    // No scheme at all, e.g. "twitch.tv/yourchannel" -- this is the shape
    // every placeholder on the Settings tab shows, so assume https.
    candidate = `https://${trimmed}`
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (!parsed.hostname) return null
  return parsed.toString()
}
