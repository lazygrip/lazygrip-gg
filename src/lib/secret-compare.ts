// src/lib/secret-compare.ts
//
// One constant-time comparison for every shared secret this app checks.
//
// WHY THIS IS A MODULE AND NOT A SIXTH COPY. Until 2026-09-17 this function
// existed five times: `timingSafeEqualStrings` in relay-identity and the three
// relay/discord-comment* routes, and `secretMatches` in admin/sequence-thread.
// Four of those five carry a comment saying they were "copied from
// src/app/api/relay-identity/route.ts rather than reimplemented", which is the
// honest version of the problem rather than a defence of it. The cron
// patch-reminder route needed the same comparison and would have been the
// sixth, so the decision became a module instead -- the same move, for the same
// reason, that public-name.ts and discord-embed.ts already record: when a
// second caller shows up for a decision, the decision stops being a copy.
//
// The five originals are rewired to this file in the same change. Nothing about
// the comparison itself changed; the bodies were byte-identical apart from the
// utf8 argument, which is the default anyway.
//
// WHY timingSafeEqual AND NOT ===. A shared secret in a header is compared on
// every call, and === bails at the first differing byte, which leaks the length
// of the matching prefix to anyone willing to measure.
//
// WHY THE LENGTH CHECK IS FINE. timingSafeEqual THROWS on inputs of different
// length, so the length comparison has to come first, and that comparison is
// inherently not constant time. The only thing it leaks is the length of the
// configured secret, which is not the secret.
//
// NOTE FOR CALLERS: importing this pins your route to the nodejs runtime,
// because node:crypto is not available on edge. Every caller says so with an
// explicit `export const runtime = 'nodejs'` rather than relying on it being
// the default for route handlers.

import { timingSafeEqual } from 'node:crypto'

export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
