import { Suspense } from 'react'
import BrowseContent from '@/components/browse/BrowseContent'

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 1200, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading...</p>
      </div>
    }>
      <BrowseContent />
    </Suspense>
  )
}
