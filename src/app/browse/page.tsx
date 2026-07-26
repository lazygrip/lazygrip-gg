export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import BrowseContent from '@/components/browse/BrowseContent'

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
  searchParams: Promise<{ sort?: string; class_id?: string; content_type?: string }>
}

export default async function BrowsePage(props: Props) {
  const searchParams = await props.searchParams;
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 1200, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading...</p>
      </div>
    }>
      <BrowseContent initialFilters={{
        sort: (searchParams.sort as any) || 'recent',
        class_id: searchParams.class_id ? Number(searchParams.class_id) : undefined,
        content_type: searchParams.content_type as any,
      }} />
    </Suspense>
  )
}