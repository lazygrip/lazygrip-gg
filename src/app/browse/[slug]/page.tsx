export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getClassBySlug, getContentTypeBySlug } from '@/lib/wow-data'
import BrowseContent from '@/components/browse/BrowseContent'
import { fetchBrowsePage } from '@/lib/browse-server'
import { BROWSE_PAGE_SIZE, browseFilterKey } from '@/lib/browse-query'
import type { SequenceFilters } from '@/types'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    sort?: string
    page?: string
    class_id?: string
    spec_id?: string
    content_type?: string
    search?: string
  }>
}

export default async function BrowseSlugPage(props: Props) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { slug } = params

  const matchedClass = getClassBySlug(slug)
  const matchedContent = getContentTypeBySlug(slug)

  // Slug resolves to neither a class nor a content type. This used to be a client-side
  // router.replace, which meant a 200 with an empty body. A server redirect is a real 307.
  if (!matchedClass && !matchedContent) redirect('/browse')

  const baseFilters: Partial<SequenceFilters> = matchedClass
    ? { class_id: matchedClass.id }
    : { content_type: matchedContent!.value as SequenceFilters['content_type'] }

  // Must match what BrowseContent derives, or the filter key will not line up and the client will
  // refetch the page the server already delivered. Both sides fall back to the same baseline, so
  // they agree without the class_id/content_type query parameter being present in the URL.
  const filters: SequenceFilters = {
    sort: (searchParams.sort as SequenceFilters['sort']) || 'recent',
    page: searchParams.page ? Number(searchParams.page) : 1,
    limit: BROWSE_PAGE_SIZE,
    class_id: searchParams.class_id ? Number(searchParams.class_id) : baseFilters.class_id,
    spec_id: searchParams.spec_id ? Number(searchParams.spec_id) : undefined,
    content_type: (searchParams.content_type as SequenceFilters['content_type']) || baseFilters.content_type,
    search: searchParams.search || undefined,
  }

  const page = await fetchBrowsePage(filters)
  const heading = matchedClass
    ? `${matchedClass.name} GRIP-EMS Sequences`
    : `${matchedContent!.label} GRIP-EMS Sequences`

  // Deliberately no Suspense boundary, matching /browse. This route has never had one and has
  // never shown the stuck-fallback symptom that /browse does; adding one to reach
  // useSearchParams would have spread that bug to all 13 class hubs and 4 content hubs.
  // force-dynamic removes the need for the boundary instead.
  return (
    <BrowseContent
      key={slug}
      heading={heading}
      initialFilters={baseFilters}
      initialSequences={page.sequences ?? undefined}
      initialCount={page.count}
      initialCurrentPatch={page.sequences ? page.currentPatch : undefined}
      initialFilterKey={page.sequences ? browseFilterKey(filters) : undefined}
    />
  )
}
