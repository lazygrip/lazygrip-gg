// The one place that decides what name a LazyGrip account is shown under in
// public, off-site surfaces: the Discord sequence embed footer, and every
// comment relayed into a Discord forum thread.
//
// WHY THIS IS A MODULE AND NOT FORTY LINES INSIDE notify-discord. It started
// there, and in one night it was fixed twice: PR 31 stopped an email address
// reaching the embed footer, and PR 32 added the BattleTag guard PR 31 had
// missed. Phase 3 of the Discord bridge needs the identical decision for the
// webhook username on every relayed comment. A second copy of a predicate
// that has already been wrong twice is a predicate that will get fixed in one
// place and left wrong in the other.
//
// THE RULE. Three strings must never appear on a public surface:
//
//   an email local part   profiles.username is SEEDED from split_part(email,
//                         '@', 1) by handle_new_user() (migration 002) when
//                         an account arrives with no Discord identity. The
//                         stored string carries no marker saying which branch
//                         produced it, so it cannot be judged by looking at
//                         it. It has to be compared against the real value.
//
//   a BattleTag           same seed, one branch earlier, and the seed strips
//                         the discriminator with split_part(..., '#', 1). So
//                         both forms are checked: with and without.
//
//   a user_<hash>         the seed's last resort, 'user_' || the first 8
//                         characters of the account uuid. Not personal data
//                         and it leaks nothing, so this one is a readability
//                         decision rather than a privacy one: "user_a3f9c1e0"
//                         posted as the author of a Discord message reads as
//                         a bug in the bridge, not as a person. Decided
//                         2026-08-09, design doc section 13.2.
//
// display_name is NOT guarded and must not be. It is free text the account
// holder set for public display, so what it says is their choice to make.

export const GENERIC_PUBLIC_NAME = 'a LazyGrip member'

// 'user_' || substr(id::text, 1, 8), and a uuid's first eight characters are
// hex. Anchored at both ends so a real username that merely STARTS with
// user_ is left alone.
const PLACEHOLDER_USERNAME = /^user_[0-9a-f]{8}$/i

export interface PublicNameInput {
  displayName?: string | null
  username?: string | null
  battletag?: string | null
  // The session email. Only its local part is ever compared, and neither the
  // address nor the local part is returned by anything in this module.
  email?: string | null
}

// Exported separately from publicName because notify-discord logs a warning
// when it suppresses a username, and a caller that wants to do the same needs
// to know suppression happened rather than inferring it from the result.
export function isUnsafePublicUsername(
  username: string | null | undefined,
  input: Pick<PublicNameInput, 'battletag' | 'email'> = {},
): boolean {
  const candidate = username?.trim() ?? ''
  if (!candidate) return false

  if (PLACEHOLDER_USERNAME.test(candidate)) return true

  const forbidden = new Set(
    [
      input.email?.split('@')[0],
      input.battletag,
      input.battletag?.split('#')[0],
    ]
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.trim().toLowerCase()),
  )

  return forbidden.has(candidate.toLowerCase())
}

// display_name, then a username that survived the check above, then the
// generic literal. The order matches the expression the site already uses to
// name someone publicly in src/app/user/[username]/page.tsx; the difference
// is that the username step here is conditional.
//
// The literal is therefore reachable three ways, not one: no profile row at
// all, an author with neither name set, or an author whose only name is one
// of the three suppressed shapes.
export function publicName(input: PublicNameInput): string {
  const display = input.displayName?.trim() ?? ''
  if (display) return display

  const username = input.username?.trim() ?? ''
  if (username && !isUnsafePublicUsername(username, input)) return username

  return GENERIC_PUBLIC_NAME
}
