import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import SequencePageClient from './SequencePageClient'

type Props = {
  params: { slug: string }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()

  const { data: sequence } = await supabase
    .from('sequences')
    .select('title, description, class_name, spec_name, hero_talent, content_type, patch_version, author:profiles(username)')
    .eq('slug', params.slug)
    .eq('is_published', true)
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
      url: `https://lazygrip.net/sequence/${params.slug}`,
      siteName: 'LazyGrip.net',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description: plainDescription,
    },
    alternates: {
      canonical: `https://lazygrip.net/sequence/${params.slug}`,
    },
  }
}

export default function SequencePage() {
  return <SequencePageClient />
}
