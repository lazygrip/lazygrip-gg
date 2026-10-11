// ---------------------------------------------------------------------------
// Content-Security-Policy, built per request so script-src can carry a nonce.
//
// Audit M1 started this as a static header in next.config.js. It moved here
// because a nonce has to be different on every response, and next.config.js can
// only emit one fixed string. src/middleware.ts calls buildCsp() with a fresh
// nonce for each request and sets the result on BOTH the request (so Next can
// read the nonce back out of it and stamp it on its own scripts) and the
// response (so the browser enforces it).
//
// EVERY ORIGIN BELOW WAS MEASURED, not listed from memory. Loaded
// https://lazygrip.net/browse and read performance.getEntriesByType('resource')
// on 2026-09-17. What the live page actually pulls:
//
//   lazygrip.net                   16 script, 3 css, 2 link, 49 fetch
//   csldntgdalzlwxozlmgv.supabase.co   15 fetch, 11 link (storage images)
//   www.googletagmanager.com       1 link, plus the gtag script layout.tsx
//   fonts.googleapis.com           1 css
//   region1.google-analytics.com   1 fetch (the GA4 beacon -- a DIFFERENT
//                                  origin from googletagmanager, and the one a
//                                  connect-src written from memory always
//                                  forgets)
//
// Plus two image hosts that are not on /browse but are on other pages:
// cdn.discordapp.com, which handle_new_user() writes into profiles.avatar_url
// from OAuth metadata (measured: 185 of 206 avatars on 2026-10-11, the rest are
// on the project's own Supabase storage), and the two Blizzard hosts already
// declared in images.remotePatterns in next.config.js.
//
// HISTORY. The policy ran report-only first, then enforced with script-src
// allowing 'unsafe-inline' (2026-10-11, after ~25 public and signed-in pages
// produced zero violations through /api/csp-report). 'unsafe-inline' was there
// because the root layout carries inline <script> blocks and Next itself writes
// inline flight-data scripts into every page. Both now carry the request nonce,
// which is what lets 'unsafe-inline' come out of script-src: an injected
// <script> has no nonce and no longer runs.
//
// WHAT IS NOT NEEDED A NONCE. The three <script type="application/ld+json">
// blocks (layout.tsx, faq/page.tsx, sequences/[slug]/page.tsx) are data blocks.
// A browser never executes them, and CSP does not govern a script element whose
// type is not a JavaScript MIME type.
//
// NO 'strict-dynamic', ON PURPOSE. It would make browsers ignore the host list
// and 'self' below, so the policy would then trust only what a nonced script
// goes on to load. Everything this site loads is same-origin or on the one
// Google Tag Manager host, which the host list already covers, and an allow-list
// is easier to reason about than a trust chain.
//
// style-src KEEPS 'unsafe-inline' PERMANENTLY, and that is architecture rather
// than laziness: the same page has 458 elements carrying a style attribute,
// because this codebase styles with React inline objects throughout. Removing
// it means rewriting the UI, not adding a nonce.
//
// WHAT THIS POLICY BUYS. It constrains origins (img-src has no wildcard, so a
// CSS background-image pointing at an attacker host is blocked -- that was
// F7.1's mechanism) AND, since script-src lost 'unsafe-inline', it stops an
// injected <script> or inline event handler from running at all.
// ---------------------------------------------------------------------------

const SELF = "'self'"

// Derived from the env var rather than pasted as a literal, so a preview or a
// fork pointed at a different Supabase project gets a policy that matches ITS
// project rather than one that silently blocks every API call. Empty string
// when unset, and the filter below drops it -- a missing env var must not emit
// the token "undefined" into a directive, which is a source that matches
// nothing and reads like a typo forever after.
function supabaseOrigins(supabaseUrl: string | undefined): { http: string; ws: string } {
  try {
    const origin = new URL(supabaseUrl ?? '').origin
    return { http: origin, ws: origin.replace(/^https:/, 'wss:') }
  } catch {
    return { http: '', ws: '' }
  }
}

const src = (...sources: string[]) => sources.filter(Boolean).join(' ')

/**
 * A fresh, unguessable value for one response. 16 random bytes, base64, which is
 * the shape CSP's 'nonce-...' source expects. Uses Web Crypto and btoa rather
 * than Buffer so it runs in the middleware runtime as well as in Node.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export function buildCsp(
  nonce: string,
  options: { supabaseUrl?: string; isDev?: boolean } = {},
): string {
  const { http: SUPABASE_ORIGIN, ws: SUPABASE_WS } = supabaseOrigins(
    'supabaseUrl' in options ? options.supabaseUrl : process.env.NEXT_PUBLIC_SUPABASE_URL,
  )
  const isDev = options.isDev ?? process.env.NODE_ENV === 'development'

  return [
    `default-src ${SELF}`,
    // No 'unsafe-inline'. 'unsafe-eval' is deliberately ABSENT in production;
    // React only needs it in development, for readable server error stacks.
    `script-src ${src(SELF, `'nonce-${nonce}'`, 'https://www.googletagmanager.com', isDev ? "'unsafe-eval'" : '')}`,
    `style-src ${SELF} 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src ${SELF} https://fonts.gstatic.com data:`,
    `img-src ${src(SELF, 'data:', 'blob:', SUPABASE_ORIGIN, 'https://cdn.discordapp.com', 'https://render.worldofwarcraft.com', 'https://avatars.battlenet.com.cn', 'https://www.googletagmanager.com')}`,
    `connect-src ${src(SELF, SUPABASE_ORIGIN, SUPABASE_WS, 'https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com')}`,
    // No iframes anywhere in src (grepped), no workers, no plugins.
    `frame-src 'none'`,
    `worker-src ${SELF}`,
    `object-src 'none'`,
    // frame-ancestors is the modern half of the X-Frame-Options in
    // next.config.js; both are sent because the older header is what some
    // scanners and older clients read.
    `frame-ancestors 'none'`,
    `base-uri ${SELF}`,
    `form-action ${SELF}`,
    'upgrade-insecure-requests',
    // Violation reports go to our own route (src/app/api/csp-report/route.ts),
    // which only logs them. report-uri is the older spelling and report-to the
    // newer one; browsers that understand report-to use it and ignore
    // report-uri, and the rest still report. Both name the same endpoint, and
    // the Reporting-Endpoints header in next.config.js defines the group.
    'report-uri /api/csp-report',
    'report-to csp',
  ].join('; ')
}
