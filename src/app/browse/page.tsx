export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import BrowseContent from '@/components/browse/BrowseContent'

interface Props {
  searchParams: { sort?: string; class_id?: string; content_type?: string }
}

export default function BrowsePage({ searchParams }: Props) {
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