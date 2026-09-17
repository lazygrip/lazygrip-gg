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

  // Audit F2: /browse/pvp was submitted for indexing with zero sequences behind
  // it, so Google was being offered a no-results page. LIVE-VERIFIED
  // 2026-09-17: 87 published sequences, mythic_plus 82, raid 4, solo 1, **pvp
  // 0**, and /browse/pvp was one of the 143 URLs in sitemap.xml.
  //
  // These are COUNTED SEPARATELY from newestBy*, and that is the whole point of
  // them existing rather than reusing `newestByContentType.has(...)`. trackNewest
  // skips any row whose updated_at does not parse -- see the `continue` below --
  // so a hub whose every sequence carries an unusable timestamp would have no
  // map entry while genuinely having content. Gating on the timestamp map would
  // then drop a populated hub out of the sitemap for a reason that has nothing
  // to do with whether it is populated. Membership here means "at least one
  // published sequence", nothing else.
  const populatedClasses = new Set<number>()
  const populatedContentTypes = new Set<string>()

  for (const seq of sequences ?? []) {
    if (typeof seq.class_id === 'number') populatedClasses.add(seq.class_id)
    if (typeof seq.content_type === 'string' && seq.content_type) {
      populatedContentTypes.add(seq.content_type)
    }

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
      url: 'https://lazygrip.net/guide/features-and-behavior',
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
  // a per-hub timestamp is meaningful. The `?? listingUpdated` fallback below
  // no longer covers "hub with no sequences" -- that case is filtered out
  // entirely now -- it covers only a populated hub whose every updated_at
  // failed to parse.
  //
  // An empty hub is dropped rather than submitted. The routes still exist and
  // still render -- /browse/pvp is reachable, linked from the homepage footer,
  // and comes back into the sitemap by itself on the day someone publishes a
  // PvP sequence. What changes is that it is no longer OFFERED to a crawler as
  // a page worth indexing while it has nothing on it.
  const classHubPages: MetadataRoute.Sitemap = WOW_CLASSES
    .filter(wowClass => populatedClasses.has(wowClass.id))
    .map(wowClass => ({
      url: `https://lazygrip.net/browse/${wowClass.slug}`,
      lastModified: newestByClass.get(wowClass.id) ?? listingUpdated,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

  // Keyed on the DB value ('mythic_plus'), addressed by the URL slug
  // ('mythic-plus'); the two differ. This is the one F2 named: pvp was the only
  // empty hub when it was measured. The class hubs get the identical gate even
  // though all 13 are populated today, because it is one predicate and the
  // alternative is the same defect waiting for the first class to go empty.
  const contentTypeHubPages: MetadataRoute.Sitemap = CONTENT_TYPES
    .filter(contentType => populatedContentTypes.has(contentType.value))
    .map(contentType => ({
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
      // Audit PART 7.8: /creators shipped in the 029/030 delta with its own
      // metadata, canonical and `revalidate = 1800`, and was never added here.
      // Confirmed absent from the live sitemap's 143 URLs on 2026-09-17. It is
      // a real listing page linked from the header and the homepage, so it gets
      // the listing timestamp rather than CONTENT_UPDATED -- its content is the
      // creator ranking, which moves whenever a sequence does.
      url: 'https://lazygrip.net/creators',
      lastModified: listingUpdated,
      changeFrequency: 'daily',
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
        // Percent-encoded one segment at a time, and the reason is NOT the one
        // this comment used to give. It said "nothing constrains the character
        // set of a username on the way in ... the profile save only checks
        // uniqueness", so "a name carrying a space or a '#' is one signup away
        // from putting an invalid <loc> in here." That was wrong when it was
        // written: 008:76-78 adds profiles_username_format, which requires
        // `^[A-Za-z0-9_.-]{2,32}$`, so a space and a '#' are both rejected at
        // the database. A reader chasing that sentence would go looking for a
        // hole that a constraint already closed.
        //
        // The encoding stays, for two real reasons. That constraint is NOT
        // VALID, which exempts every row that existed before 008 -- including
        // the one live username beginning with a dot -- so historical rows are
        // not covered by it. And the /user/<username> canonical and og:url
        // encode the same way, so encoding here is what keeps the sitemap entry
        // and the page agreeing rather than a defence in its own right.
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
