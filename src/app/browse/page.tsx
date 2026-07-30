export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import BrowseContent from '@/components/browse/BrowseContent'
import { fetchBrowsePage } from '@/lib/browse-server'
import { BROWSE_PAGE_SIZE, browseFilterKey } from '@/lib/browse-query'
import type { SequenceFilters } from '@/types'

export const metadata: Metadata = {
  title: 'Browse GRIP-EMS Sequences',
  description: 'Every published GRIP-EMS macro sequence on LazyGrip.net. Filter by class, spec, and content type. Free to import.',
  alternates: {
    canonical: 'https://lazygrip.net/browse',
  },
  openGraph: {
    title: 'Browse GRIP-EMS Sequences',
    description: 'Every published GRIP-EMS macro sequence on LazyGrip.net. Filter by class, spec, and content type. Free to import.',
    url: 'https://lazygrip.net/browse',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

interface Props {
  searchParams: Promise<{
    sort?: string
    page?: string
    class_id?: string
    spec_id?: string
    content_type?: string
    search?: string
  }>
}

export default async function BrowsePage(props: Props) {
  const searchParams = await props.searchParams
  const filters: SequenceFilters = {
    sort: (searchParams.sort as SequenceFilters['sort']) || 'recent',
    page: searchParams.page ? Number(searchParams.page) : 1,
    limit: BROWSE_PAGE_SIZE,
    class_id: searchParams.class_id ? Number(searchParams.class_id) : undefined,
    spec_id: searchParams.spec_id ? Number(searchParams.spec_id) : undefined,
    content_type: searchParams.content_type as SequenceFilters['content_type'],
    search: searchParams.search || undefined,
  }
  const page = await fetchBrowsePage(filters)

  // No Suspense boundary here on purpose. The route is force-dynamic, so useSearchParams
  // inside BrowseContent does not need one, and the boundary was actively harmful: React
  // 19.2 streamed it, marked it queued-for-reveal ($~), never revealed it, and left the
  // server markup in the DOM under a display:none parent with the fallback showing. That is
  // the /browse "no cards render" bug. Measured on the live site 2026-07-26: hard load gave
  // 0 articles and a stuck fallback, a client-side navigation to the same URL gave 20
  // articles, and /browse/[slug] -- which has no boundary -- always worked.
  return (
    <BrowseContent
      heading="Browse GRIP-EMS Sequences"
      initialFilters={{
        sort: filters.sort,
        class_id: filters.class_id,
        content_type: filters.content_type,
      }}
      initialSequences={page.sequences ?? undefined}
      initialCount={page.count}
      initialCurrentPatch={page.sequences ? page.currentPatch : undefined}
      initialFilterKey={page.sequences ? browseFilterKey(filters) : undefined}
    />
  )
}