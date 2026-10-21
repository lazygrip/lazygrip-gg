// ---------------------------------------------------------------------------
// Audit M1: security headers.
//
// The Content-Security-Policy is NOT here. It needs a fresh nonce on every
// response, which a static header cannot carry, so it is built per request by
// src/lib/csp.ts and set from src/middleware.ts. This list is only the headers
// that are the same for every response.
//
// Reporting-Endpoints below is the one piece that stays: it defines the
// "csp" group that the policy's `report-to csp` points at.
// ---------------------------------------------------------------------------

const SECURITY_HEADERS = [
  { key: 'Reporting-Endpoints', value: 'csp="/api/csp-report"' },
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
      // The guide page for GSE users is /guide/from-gse again; the interim legacy-program URL
      // forwards to it so any link made while it was live keeps working.
      { source: '/guide/from-legacy-program', destination: '/guide/from-gse', permanent: true },
      // Site changelog moved under the Guide as LG-Changelog
      { source: '/changelog', destination: '/guide/lg-changelog', permanent: true },
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
