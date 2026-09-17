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
