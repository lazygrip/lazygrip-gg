import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { WOW_CLASSES, CONTENT_TYPES } from '@/lib/wow-data'

// lastmod for the guide pages plus /about and /faq. These are hand-written
// pages, so bump this date whenever that content actually changes.
const CONTENT_UPDATED = new Date('2026-07-21')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const { data: sequences } = await supabase
    .from('sequences')
    .select('slug, updated_at, class_id, content_type, author_id')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // A published row should always carry a real timestamptz, but the sitemap is
  // the one route where a single unusable value takes every other URL with it:
  // Next calls toISOString() on whatever lastModified holds, so one unparseable
  // string throws RangeError and the whole document 500s. A null would be worse
  // than useless rather than fatal, since new Date(null) is the 1970 epoch and
  // would publish a lastmod we know is false. Parse in one place and treat
  // anything unusable as absent.
  const parseUpdated = (value: string | null | undefined): Date | null => {
    if (value === null || value === undefined) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  // The homepage and /browse are listings: they genuinely change when a
  // sequence changes, so their lastmod is the newest sequence timestamp.
  const newestSequenceUpdate = (sequences ?? []).reduce<Date | null>((newest, seq) => {
    const updated = parseUpdated(seq.updated_at)
    if (updated === null) return newest
    return newest === null || updated > newest ? updated : newest
  }, null)
  const listingUpdated = newestSequenceUpdate ?? new Date()

  // Newest published sequence per class, per content type and per author, so
  // each hub and profile can carry a real lastmod of its own rather than
  // sharing the site-wide one. Same parseUpdated guard as the reduce above.
  const newestByClass = new Map<number, Date>()
  const newestByContentType = new Map<string, Date>()
  const newestByAuthor = new Map<string, Date>()

  const trackNewest = <K>(map: Map<K, Date>, key: K | null | undefined, updated: Date) => {
    if (key === null || key === undefined) return
    const current = map.get(key)
    if (current === undefined || updated > current) map.set(key, updated)
  }

  for (const seq of sequences ?? []) {
    const updated = parseUpdated(seq.updated_at)
    if (updated === null) continue
    trackNewest(newestByClass, seq.class_id, updated)
    trackNewest(newestByContentType, seq.content_type, updated)
    trackNewest(newestByAuthor, seq.author_id, updated)
  }

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

  // Class and content-type hubs, generated from wow-data so they cannot drift
  // from the routes that /browse/[slug] actually serves. Both are listings, so
  // a per-hub timestamp is meaningful; hubs with no published sequences yet
  // fall back to the site-wide listing timestamp.
  const classHubPages: MetadataRoute.Sitemap = WOW_CLASSES.map(wowClass => ({
    url: `https://lazygrip.net/browse/${wowClass.slug}`,
    lastModified: newestByClass.get(wowClass.id) ?? listingUpdated,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  // Keyed on the DB value ('mythic_plus'), addressed by the URL slug
  // ('mythic-plus'); the two differ.
  const contentTypeHubPages: MetadataRoute.Sitemap = CONTENT_TYPES.map(contentType => ({
    url: `https://lazygrip.net/browse/${contentType.slug}`,
    lastModified: newestByContentType.get(contentType.value) ?? listingUpdated,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  const additionalStaticPages: MetadataRoute.Sitemap = [
    {
      url: 'https://lazygrip.net/guide/settings',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://lazygrip.net/workshop',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://lazygrip.net/workshop/build',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: 'https://lazygrip.net/workshop/decode',
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      // Generated from commit history, so its real change time is not knowable
      // here. lastmod is optional in the protocol; omit it rather than publish
      // a value we cannot stand behind.
      url: 'https://lazygrip.net/changelog',
      changeFrequency: 'daily',
      priority: 0.4,
    },
  ]

  // Author profiles are currently the only pages that server-render links into
  // /sequences/, so they are the sole crawl path to the sequence corpus.
  const authorIds = [
    ...new Set(
      (sequences ?? [])
        .map(seq => seq.author_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ]

  let profilePages: MetadataRoute.Sitemap = []

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', authorIds)

    profilePages = (profiles ?? [])
      .filter(profile => typeof profile.username === 'string' && profile.username.length > 0)
      .map(profile => ({
        // Percent-encoded one segment at a time. Nothing constrains the
        // character set of a username on the way in (signup enforces a 3 char
        // minimum, the profile save only checks uniqueness) and one live
        // username already begins with a dot, so a name carrying a space or a
        // '#' is one signup away from putting an invalid <loc> in here. The
        // /user/<username> canonical and og:url encode the same way, so the
        // sitemap entry and the page still agree.
        url: `https://lazygrip.net/user/${encodeURIComponent(profile.username)}`,
        lastModified: newestByAuthor.get(profile.id) ?? listingUpdated,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }))
  }

  const sequencePages: MetadataRoute.Sitemap = (sequences ?? []).map(seq => {
    const updated = parseUpdated(seq.updated_at)
    return {
      url: `https://lazygrip.net/sequences/${seq.slug}`,
      // Omitted rather than faked when the row's timestamp is unusable, the
      // same reasoning as /changelog above.
      ...(updated === null ? {} : { lastModified: updated }),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }
  })

  return [
    ...staticPages,
    ...classHubPages,
    ...contentTypeHubPages,
    ...additionalStaticPages,
    ...profilePages,
    ...sequencePages,
  ]
}
