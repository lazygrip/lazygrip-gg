// ---------------------------------------------------------------------------
// Audit M1: security headers.
//
// EVERY ORIGIN BELOW WAS MEASURED, not listed from memory. Loaded
// https://lazygrip.net/browse and read performance.getEntriesByType('resource')
// on 2026-09-17. What the live page actually pulls:
//
//   lazygrip.net                   16 script, 3 css, 2 link, 49 fetch
//   csldntgdalzlwxozlmgv.supabase.co   15 fetch, 11 link (storage images)
//   www.googletagmanager.com       1 link, plus the gtag script layout.tsx:102
//   fonts.googleapis.com           1 css
//   region1.google-analytics.com   1 fetch (the GA4 beacon -- a DIFFERENT
//                                  origin from googletagmanager, and the one a
//                                  connect-src written from memory always
//                                  forgets)
//
// Plus two image hosts that are not on /browse but are on other pages:
// cdn.discordapp.com, which handle_new_user() writes into profiles.avatar_url
// from OAuth metadata (measured: 300-odd of 341 profiles), and the two Blizzard
// hosts already declared in images.remotePatterns below.
//
// REPORT-ONLY FIRST, and here is the specific reason rather than a general one.
// The same page carries 6 inline <script> blocks -- the theme cookie reader,
// two JSON-LD blocks, Next's own __next_f flight-data pushes, and the gtag
// bootstrap -- so an enforcing policy without nonces breaks the site outright.
// Nonces mean threading one value through layout.tsx and Next's own script
// injection, which is its own change. Report-only lands the measurement now and
// costs nothing if a host was missed.
//
// style-src KEEPS 'unsafe-inline' PERMANENTLY, and that is architecture rather
// than laziness: the same page has 458 elements carrying a style attribute,
// because this codebase styles with React inline objects throughout. Removing
// it means rewriting the UI, not adding a nonce.
//
// WHAT THIS POLICY ACTUALLY BUYS while script-src still allows inline. It
// constrains ORIGINS, not inline injection -- so it does not stop an injected
// <script>, but it DOES stop the thing F7.1 was: img-src has no wildcard, and a
// CSS background-image pointing at an attacker host is an img-src fetch. That
// is the independent second mitigation the audit asked for, and it holds
// whatever happens to the sanitizer.
const SELF = "'self'"

// Derived from the env var rather than pasted as a literal, so a preview or a
// fork pointed at a different Supabase project gets a policy that matches ITS
// project rather than one that silently blocks every API call. Empty string
// when unset, and the filter below drops it -- a missing env var must not emit
// the token "undefined" into a directive, which is a source that matches
// nothing and reads like a typo forever after.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
  } catch {
    return ''
  }
})()
const SUPABASE_WS = SUPABASE_ORIGIN ? SUPABASE_ORIGIN.replace(/^https:/, 'wss:') : ''

const src = (...sources) => sources.filter(Boolean).join(' ')

const CSP_DIRECTIVES = [
  `default-src ${SELF}`,
  // 'unsafe-inline' is the nonce work, tracked as the precondition for moving
  // this header off -Report-Only. 'unsafe-eval' is deliberately ABSENT.
  `script-src ${SELF} 'unsafe-inline' https://www.googletagmanager.com`,
  `style-src ${SELF} 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src ${SELF} https://fonts.gstatic.com data:`,
  `img-src ${src(SELF, 'data:', 'blob:', SUPABASE_ORIGIN, 'https://cdn.discordapp.com', 'https://render.worldofwarcraft.com', 'https://avatars.battlenet.com.cn', 'https://www.googletagmanager.com')}`,
  `connect-src ${src(SELF, SUPABASE_ORIGIN, SUPABASE_WS, 'https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com')}`,
  // No iframes anywhere in src (grepped), no workers, no plugins.
  `frame-src 'none'`,
  `worker-src ${SELF}`,
  `object-src 'none'`,
  // frame-ancestors is the modern half of the X-Frame-Options below; both are
  // sent because the older header is what some scanners and older clients read.
  `frame-ancestors 'none'`,
  `base-uri ${SELF}`,
  `form-action ${SELF}`,
  'upgrade-insecure-requests',
]

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy-Report-Only', value: CSP_DIRECTIVES.join('; ') },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // strict-origin-when-cross-origin sends the full URL same-origin and only the
  // origin cross-origin. It matters here specifically because profile and
  // sequence URLs carry usernames and slugs, and those should not be handed to
  // every outbound link a creator puts in their bio.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.battlenet.com.cn' },
      { protocol: 'https', hostname: 'render.worldofwarcraft.com' },
    ],
  },
  // Deployment hostnames (*.vercel.app) serve byte-identical pages to lazygrip.net
  // and were being crawled and indexed alongside it. Every page already emits a
  // cross-domain canonical pointing at lazygrip.net, so this is consolidation
  // rather than rescue, but a crawlable duplicate still spends crawl budget and
  // can surface in results under the wrong hostname.
  //
  // This has to be a header rather than a robots.txt Disallow: a noindex is only
  // obeyed if the crawler is allowed to fetch the page and read it. robots.txt on
  // the deployment host therefore stays Allow: / on purpose.
  //
  // The rule is host-scoped, so it cannot reach lazygrip.net. Preview deploys get
  // generated hostnames (lazygrip-gg-<hash>-<scope>.vercel.app), which is why this
  // matches the whole *.vercel.app suffix rather than one literal host.
  async headers() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: '(?<deployHost>.*\\.vercel\\.app)' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      // Audit M1. LIVE-VERIFIED 2026-09-17: /browse on lazygrip.net carried
      // strict-transport-security and nothing else -- no CSP in either form, no
      // nosniff, no frame-options, no referrer-policy, no permissions-policy.
      //
      // Unscoped on purpose. The block above is host-scoped because a noindex
      // must NOT reach lazygrip.net; these must reach every host the app is
      // served from, previews included, or the preview deploys are the one
      // place the policy is never exercised before it goes live.
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ]
  },
  async redirects() {
    return [
      // Old singular sequence URLs -> canonical plural route (recovers indexed 404 links)
      { source: '/sequence/:slug', destination: '/sequences/:slug', permanent: true },
      // Old GSE-named guide URL -> renamed legacy-program page (recovers indexed 404)
      { source: '/guide/from-gse', destination: '/guide/from-legacy-program', permanent: true },
      // Convert tool taken off the Workshop hub; route kept alive as a redirect, not permanent
      // since the underlying code is disconnected, not deleted.
      { source: '/workshop/convert', destination: '/workshop', permanent: false },
      // Class redirects — query param to clean slug
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '1' }], destination: '/browse/warrior?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '2' }], destination: '/browse/paladin?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '3' }], destination: '/browse/hunter?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '4' }], destination: '/browse/rogue?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '5' }], destination: '/browse/priest?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '6' }], destination: '/browse/death-knight?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '7' }], destination: '/browse/shaman?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '8' }], destination: '/browse/mage?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '9' }], destination: '/browse/warlock?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '10' }], destination: '/browse/monk?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '11' }], destination: '/browse/druid?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '12' }], destination: '/browse/demon-hunter?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '13' }], destination: '/browse/evoker?', permanent: true },
      // Content type redirects — query param to clean slug
      { source: '/browse', has: [{ type: 'query', key: 'content_type', value: 'raid' }], destination: '/browse/raid?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'content_type', value: 'mythic_plus' }], destination: '/browse/mythic-plus?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'content_type', value: 'pvp' }], destination: '/browse/pvp?', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'content_type', value: 'solo' }], destination: '/browse/solo?', permanent: true },
    ]
  },
}
module.exports = nextConfig
