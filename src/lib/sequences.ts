import { createClient } from '@/lib/supabase/server'
import { Sequence, SequenceFilters, PaginatedResponse, LinkedSequence } from '@/types'

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
    .eq('status', 'published')

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
    .eq('status', 'published')
    .single()

  if (error || !data) return null

  await supabase.rpc('increment_view_count', { seq_id: data.id })

  let linked_sequence: LinkedSequence | null = null

  if (data.set_id) {
    const { data: linked } = await supabase
      .from('sequences')
      .select('id, title, slug, content_type, class_name, spec_name, hero_talent')
      .eq('set_id', data.set_id)
      .eq('status', 'published')
      .neq('id', data.id)
      .limit(1)
      .single()

    if (linked) linked_sequence = linked
  }

  return {
    ...data,
    avg_score: data.rating_data?.[0]?.avg_score ?? null,
    rating_count: data.rating_data?.[0]?.rating_count ?? 0,
    linked_sequence,
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
    .eq('status', 'published')
    .limit(3)

  if (error) throw error

  return (data || []).map((row: any) => ({
    ...row,
    avg_score: row.rating_data?.[0]?.avg_score ?? null,
    rating_count: row.rating_data?.[0]?.rating_count ?? 0,
  }))
}

// Link two sequences together as ST/MT variants.
// Looks up the target by slug, then assigns a shared set_id to both rows.
// If one already has a set_id that value is reused; otherwise a new one is generated.
export async function linkSequences(
  sourceId: string,
  targetSlug: string,
  sourceSetId: string | null
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { data: target, error: lookupError } = await supabase
    .from('sequences')
    .select('id, set_id')
    .eq('slug', targetSlug)
    .eq('status', 'published')
    .single()

  if (lookupError || !target) {
    return { error: 'Sequence not found. Check the slug and try again.' }
  }

  if (target.id === sourceId) {
    return { error: 'A sequence cannot be linked to itself.' }
  }

  // Prefer an existing set_id from either side, otherwise generate a new one.
  const setId = sourceSetId ?? target.set_id ?? crypto.randomUUID()

  const { error: updateError } = await supabase
    .from('sequences')
    .update({ set_id: setId })
    .in('id', [sourceId, target.id])

  if (updateError) {
    return { error: 'Failed to link sequences. Please try again.' }
  }

  return { error: null }
}

// Remove a sequence from its set. If the set_id is only shared by two sequences
// this effectively dissolves the link on both sides.
export async function unlinkSequence(
  sequenceId: string,
  setId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  // Clear this sequence's set_id first.
  const { error: clearSelf } = await supabase
    .from('sequences')
    .update({ set_id: null })
    .eq('id', sequenceId)

  if (clearSelf) return { error: 'Failed to unlink. Please try again.' }

  // If only one sequence remains in the set it no longer has a partner,
  // so clear it too rather than leaving an orphaned set_id.
  const { data: remaining } = await supabase
    .from('sequences')
    .select('id')
    .eq('set_id', setId)

  if (remaining && remaining.length === 1) {
    await supabase
      .from('sequences')
      .update({ set_id: null })
      .eq('id', remaining[0].id)
  }

  return { error: null }
}
