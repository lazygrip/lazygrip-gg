import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

// lastmod for the guide pages plus /about and /faq. These are hand-written
// pages, so bump this date whenever that content actually changes.
const CONTENT_UPDATED = new Date('2026-07-21')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const { data: sequences } = await supabase
    .from('sequences')
    .select('slug, updated_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // The homepage and /browse are listings: they genuinely change when a
  // sequence changes, so their lastmod is the newest sequence timestamp.
  const newestSequenceUpdate = (sequences ?? []).reduce<Date | null>((newest, seq) => {
    const updated = new Date(seq.updated_at)
    if (Number.isNaN(updated.getTime())) return newest
    return newest === null || updated > newest ? updated : newest
  }, null)
  const listingUpdated = newestSequenceUpdate ?? new Date()

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: 'https://lazygrip.net',
      lastModified: listingUpdated,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: 'https://lazygrip.net/browse',
      lastModified: listingUpdated,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: 'https://lazygrip.net/guide',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://lazygrip.net/guide/installation',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://lazygrip.net/guide/how-it-works',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://lazygrip.net/guide/building-sequences',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://lazygrip.net/guide/from-legacy-program',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://lazygrip.net/guide/validating',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://lazygrip.net/about',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://lazygrip.net/faq',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://lazygrip.net/tos',
      lastModified: new Date('2026-05-03'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://lazygrip.net/privacy',
      lastModified: new Date('2026-05-03'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  const sequencePages: MetadataRoute.Sitemap = (sequences ?? []).map(seq => ({
    url: `https://lazygrip.net/sequences/${seq.slug}`,
    lastModified: new Date(seq.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...sequencePages]
}
