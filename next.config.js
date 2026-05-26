/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['avatars.battlenet.com.cn', 'render.worldofwarcraft.com'],
  },
  async redirects() {
    return [
      // Class redirects — query param to clean slug
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '1' }], destination: '/browse/warrior', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '2' }], destination: '/browse/paladin', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '3' }], destination: '/browse/hunter', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '4' }], destination: '/browse/rogue', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '5' }], destination: '/browse/priest', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '6' }], destination: '/browse/death-knight', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '7' }], destination: '/browse/shaman', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '8' }], destination: '/browse/mage', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '9' }], destination: '/browse/warlock', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '10' }], destination: '/browse/monk', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '11' }], destination: '/browse/druid', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '12' }], destination: '/browse/demon-hunter', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'class_id', value: '13' }], destination: '/browse/evoker', permanent: true },
      // Content type redirects — query param to clean slug
      { source: '/browse', has: [{ type: 'query', key: 'content_type', value: 'raid' }], destination: '/browse/raid', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'content_type', value: 'mythic_plus' }], destination: '/browse/mythic-plus', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'content_type', value: 'pvp' }], destination: '/browse/pvp', permanent: true },
      { source: '/browse', has: [{ type: 'query', key: 'content_type', value: 'solo' }], destination: '/browse/solo', permanent: true },
    ]
  },
}
module.exports = nextConfig
