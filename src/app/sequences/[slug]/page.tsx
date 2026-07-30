export const revalidate = 3600

import { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import SequencePageClient from './SequencePageClient'
import { fetchSequencePage } from '@/lib/sequence-server'
import { stripHtml } from '@/lib/html-text'

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

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const supabase = createPublicClient()

  const { data: sequence } = await supabase
    .from('sequences')
    .select('title, description, class_name, spec_name, hero_talent, content_type, patch_version, author:profiles(username)')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single()

  if (!sequence) {
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

export default async function SequencePage(props: Props) {
  const params = await props.params
  const initial = await fetchSequencePage(params.slug)
  return <SequencePageClient key={params.slug} initial={initial} />
}
