import { createClient } from '@/lib/supabase/server'
import { Sequence, SequenceFilters, PaginatedResponse } from '@/types'

export async function getSequences(
  filters: SequenceFilters = {}
): Promise<PaginatedResponse<Sequence>> {
  const supabase = createClient()
  const {
    class_id, spec_name, content_type,
    search, sort = 'recent', page = 1, limit = 20
  } = filters

  let query = supabase
    .from('sequences')
    .select(`
      *,
      author:profiles(*),
      rating_data:sequence_ratings(avg_score, rating_count)
    `, { count: 'exact' })
    .eq('is_published', true)

  if (class_id) query = query.eq('class_id', class_id)
  if (spec_name) query = query.eq('spec_name', spec_name)
  if (content_type) query = query.eq('content_type', content_type)
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

  switch (sort) {
    case 'top_rated':
      query = query.order('avg_score', { ascending: false, nullsFirst: false })
      break
    case 'most_viewed':
      query = query.order('view_count', { ascending: false })
      break
    case 'most_saved':
      query = query.order('save_count', { ascending: false })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  const from = (page - 1) * limit
  query = query.range(from, from + limit - 1)

  const { data, error, count } = await query

  if (error) throw error

  const sequences = (data || []).map((row: any) => ({
    ...row,
    avg_score: row.rating_data?.[0]?.avg_score ?? null,
    rating_count: row.rating_data?.[0]?.rating_count ?? 0,
  }))

  return {
    data: sequences,
    count: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

export async function getSequenceBySlug(slug: string): Promise<Sequence | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('sequences')
    .select(`
      *,
      author:profiles(*),
      rating_data:sequence_ratings(avg_score, rating_count)
    `)
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !data) return null

  await supabase.rpc('increment_view_count', { seq_id: data.id })

  return {
    ...data,
    avg_score: data.rating_data?.[0]?.avg_score ?? null,
    rating_count: data.rating_data?.[0]?.rating_count ?? 0,
  }
}

export async function getComments(sequenceId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('comments')
    .select(`*, author:profiles(*)`)
    .eq('sequence_id', sequenceId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getFeaturedSequences(): Promise<Sequence[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('sequences')
    .select(`
      *,
      author:profiles(*),
      rating_data:sequence_ratings(avg_score, rating_count)
    `)
    .eq('is_featured', true)
    .eq('is_published', true)
    .limit(3)

  if (error) throw error

  return (data || []).map((row: any) => ({
    ...row,
    avg_score: row.rating_data?.[0]?.avg_score ?? null,
    rating_count: row.rating_data?.[0]?.rating_count ?? 0,
  }))
}
