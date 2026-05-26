'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClassBySlug, getContentTypeBySlug } from '@/lib/wow-data'
import BrowseContent from '@/components/browse/BrowseContent'

interface Props {
  params: { slug: string }
}

export default function BrowseSlugPage({ params }: Props) {
  const router = useRouter()
  const { slug } = params

  const matchedClass = getClassBySlug(slug)
  const matchedContent = getContentTypeBySlug(slug)

  // Strip any leftover query params from the URL bar without triggering a navigation
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, '', `/browse/${slug}`)
    }
  }, [slug])

  // If slug resolves to neither a class nor a content type, send to /browse
  useEffect(() => {
    if (!matchedClass && !matchedContent) {
      router.replace('/browse')
    }
  }, [matchedClass, matchedContent, router])

  if (!matchedClass && !matchedContent) return null

  const initialFilters = matchedClass
    ? { class_id: matchedClass.id }
    : { content_type: matchedContent!.value }

  return <BrowseContent initialFilters={initialFilters} />
}
