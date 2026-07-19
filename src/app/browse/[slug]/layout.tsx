import { Metadata } from 'next'
import { getClassBySlug, getContentTypeBySlug } from '@/lib/wow-data'

interface MetadataProps {
  params: { slug: string }
}

export function generateMetadata({ params }: MetadataProps): Metadata {
  const wowClass = getClassBySlug(params.slug)
  const contentType = getContentTypeBySlug(params.slug)

  if (!wowClass && !contentType) {
    return { title: 'Browse Sequences' }
  }

  const label = wowClass ? wowClass.name : contentType!.label
  const title = `${label} GRIP-EMS Sequences`
  const description = wowClass
    ? `Browse ${wowClass.name} macro sequences for World of Warcraft. ${wowClass.specs.map(s => s.name).join(', ')} builds rated by the community, free to import into GRIP-EMS.`
    : `Browse ${contentType!.label} macro sequences for World of Warcraft. Every class and spec, rated by the community and free to import into GRIP-EMS.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://lazygrip.net/browse/${params.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://lazygrip.net/browse/${params.slug}`,
      siteName: 'LazyGrip.net',
      type: 'website',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
    },
  }
}

export default function BrowseSlugLayout({ children }: { children: React.ReactNode }) {
  return children
}
