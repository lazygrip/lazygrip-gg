'use client'

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation'
import { getClassBySlug, getContentTypeBySlug } from '@/lib/wow-data'
import BrowseContent from '@/components/browse/BrowseContent'

interface Props {
  params: Promise<{ slug: string }>
}

export default function BrowseSlugPage(props: Props) {
  const params = use(props.params);
  const router = useRouter()
  const { slug } = params

  const matchedClass = getClassBySlug(slug)
  const matchedContent = getContentTypeBySlug(slug)

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
