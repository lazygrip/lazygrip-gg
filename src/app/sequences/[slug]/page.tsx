export const revalidate = 3600

import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'
import SequencePageClient from './SequencePageClient'
import { fetchSequencePage } from '@/lib/sequence-server'
import { stripHtml } from '@/lib/html-text'
import { getClassById, CONTENT_TYPES } from '@/lib/wow-data'
import { jsonLdString } from '@/lib/json-ld'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  // Prerender every published sequence at build so the cache starts warm. Wrapped
  // because CI builds with placeholder credentials: on failure this returns nothing
  // and every slug simply renders on demand, which is the pre-existing behaviour.
  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('sequences')
      .select('slug')
      .eq('status', 'published')
    return (data ?? []).map((row: { slug: string }) => ({ slug: row.slug }))
  } catch {
    return []
  }
}

// Resolves a slug through slug_aliases if it doesn't match a published
// sequence directly. Shared by generateMetadata and the page component so
// both agree on the same redirect target -- metadata (canonical URL, OG
// tags) must point at the same place the actual page redirects to, or a
// crawler following the canonical tag and a browser following the redirect
// would land on different signals for the same request.
async function resolveAliasedSlug(slug: string): Promise<string | null> {
  const supabase = createPublicClient()
  const { data: alias } = await supabase
    .from('slug_aliases')
    .select('sequences!inner(slug, status)')
    .eq('old_slug', slug)
    .eq('sequences.status', 'published')
    .maybeSingle()
  return (alias?.sequences as unknown as { slug: string } | null)?.slug ?? null
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const supabase = createPublicClient()

  const { data: sequence } = await supabase
    .from('sequences')
    // !sequences_author_id_fkey: required as of migration 030 -- see
    // sequence-server.ts's fetchSequencePage for the full explanation.
    .select('title, description, class_name, spec_name, hero_talent, content_type, patch_version, author:profiles!sequences_author_id_fkey(username)')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single()

  if (!sequence) {
    // Not found under this exact slug -- check slug_aliases before treating
    // it as truly gone. If it resolves, point metadata at the corrected
    // URL rather than describing a page that's about to redirect out from
    // under a crawler.
    const aliasedSlug = await resolveAliasedSlug(params.slug)
    if (aliasedSlug) {
      return {
        alternates: { canonical: `https://lazygrip.net/sequences/${aliasedSlug}` },
      }
    }
    return {
      title: 'Sequence Not Found',
      description: 'This sequence could not be found.',
    }
  }

  const contentLabels: Record<string, string> = {
    raid: 'Raid',
    mythic_plus: 'Mythic+',
    pvp: 'PvP',
    solo: 'Solo',
  }

  const contentLabel = contentLabels[sequence.content_type] ?? sequence.content_type
  const specPart = sequence.spec_name ? `${sequence.spec_name} ` : ''
  const heroTalentPart = sequence.hero_talent ? ` — ${sequence.hero_talent}` : ''
  const patchPart = sequence.patch_version ? ` | ${sequence.patch_version}` : ''
  const authorName = (sequence.author as any)?.username
  const authorPart = authorName ? ` by ${authorName}` : ''

  const title = sequence.title

  const plainDescription = sequence.description
    ? stripHtml(sequence.description).slice(0, 155)
    : `${specPart}${sequence.class_name}${heroTalentPart} GRIP-EMS sequence for ${contentLabel}${authorPart}${patchPart}. Free to import on LazyGrip.net.`

  const keywords = [
    'GRIP-EMS',
    'WoW macro',
    sequence.class_name,
    sequence.spec_name,
    sequence.hero_talent,
    contentLabel,
    'World of Warcraft',
    'GSE alternative',
    sequence.patch_version,
  ].filter(Boolean).join(', ')

  return {
    title,
    description: plainDescription,
    keywords,
    openGraph: {
      title,
      description: plainDescription,
      url: `https://lazygrip.net/sequences/${params.slug}`,
      siteName: 'LazyGrip.net',
      type: 'article',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
    },
    twitter: {
      card: 'summary',
      title,
      description: plainDescription,
    },
    alternates: {
      canonical: `https://lazygrip.net/sequences/${params.slug}`,
    },
  }
}

// Builds this sequence's JSON-LD: a BreadcrumbList (Home > Browse > class >
// title, so search results show that trail instead of the raw URL) and a
// SoftwareApplication block carrying an aggregateRating when the sequence
// actually has one. SoftwareApplication is the type Google's own structured-
// data documentation lists as eligible for review/rating rich results, and
// it's the honest fit here: a GRIP-EMS sequence is literally an importable
// piece of macro configuration, not an article about one. aggregateRating is
// omitted entirely rather than sent as zeros when rating_count is 0 --
// Google's guidelines require a rating to reflect real submitted reviews,
// and this site's own ratings are exactly that, so there's nothing to fake
// and nothing to hide either.
function buildSequenceJsonLd(seq: import('@/types').Sequence, canonicalUrl: string) {
  const classInfo = getClassById(seq.class_id)
  const contentLabel = CONTENT_TYPES.find(c => c.value === seq.content_type)?.label ?? seq.content_type
  const authorName = seq.author?.display_name || seq.author?.username

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lazygrip.net' },
      { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://lazygrip.net/browse' },
      ...(classInfo
        ? [{ '@type': 'ListItem', position: 3, name: classInfo.name, item: `https://lazygrip.net/browse/${classInfo.slug}` }]
        : []),
      { '@type': 'ListItem', position: classInfo ? 4 : 3, name: seq.title, item: canonicalUrl },
    ],
  }

  const description = seq.description
    ? stripHtml(seq.description).slice(0, 500)
    : `${seq.spec_name ? `${seq.spec_name} ` : ''}${seq.class_name} GRIP-EMS sequence for ${contentLabel}${authorName ? ` by ${authorName}` : ''}. Free to import.`

  const softwareApplication: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: seq.title,
    description,
    url: canonicalUrl,
    applicationCategory: 'GameApplication',
    operatingSystem: 'World of Warcraft',
    ...(authorName ? { author: { '@type': 'Person', name: authorName } } : {}),
    datePublished: seq.created_at,
    dateModified: seq.updated_at,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  }

  if (seq.rating_count && seq.rating_count > 0 && seq.avg_score != null) {
    softwareApplication.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: seq.avg_score,
      ratingCount: seq.rating_count,
      bestRating: 10,
      worstRating: 1,
    }
  }

  return [breadcrumb, softwareApplication]
}

export default async function SequencePage(props: Props) {
  const params = await props.params
  const initial = await fetchSequencePage(params.slug)

  // A corrected slug (see slug_aliases / the 2026-08-08 untitled-draft
  // backfill) redirects here rather than rendering a not-found page. Next's
  // redirect() throws internally and is caught by the framework -- this is
  // the standard pattern, not an unhandled exception.
  if (initial.status === 'redirect') {
    redirect(`/sequences/${initial.slug}`)
  }

  const jsonLdBlocks = initial.status === 'ok'
    ? buildSequenceJsonLd(initial.data.sequence, `https://lazygrip.net/sequences/${params.slug}`)
    : []

  return (
    <>
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(block) }}
        />
      ))}
      <SequencePageClient key={params.slug} initial={initial} />
    </>
  )
}
