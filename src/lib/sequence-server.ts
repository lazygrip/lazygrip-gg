import { createPublicClient } from '@/lib/supabase/public'
import type { Comment, LinkedSequence, Sequence, SequenceVersion } from '@/types'

export type SequencePageData = {
  sequence: Sequence
  versions: SequenceVersion[]
  comments: Comment[]
  linkedSequence: LinkedSequence | null
  currentPatch: string | null
}

export type SequencePageResult =
  | { status: 'ok'; data: SequencePageData }
  | { status: 'redirect'; slug: string }
  | { status: 'not-found' }
  | { status: 'unavailable' }

// Mirrors SequencePageClient.fetchSequence with one deliberate omission: no
// increment_view_count. Counting a view here would count it twice, and would also count
// crawler and prefetch hits. The client keeps that call.
//
// 'unavailable' is the error path and makes the page render with no seeded props, so the
// client fetches exactly as it does today. Only 'not-found' asserts the slug is really absent.
//
// 'redirect' is new (2026-08-08, slug_aliases backfill). A slug that no
// longer resolves directly is checked against slug_aliases before being
// treated as truly gone -- this is how the corrected untitled-draft-*
// URLs keep working for anyone who bookmarked, linked, or has a Discord
// thread pointing at the old slug.
export async function fetchSequencePage(slug: string): Promise<SequencePageResult> {
  try {
    const supabase = createPublicClient()

    const { data: seq, error } = await supabase
      .from('sequences')
      .select('*, author:profiles(*)')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (error && error.code !== 'PGRST116') return { status: 'unavailable' }

    if (!seq) {
      const { data: alias } = await supabase
        .from('slug_aliases')
        .select('sequence_id, sequences!inner(slug, status)')
        .eq('old_slug', slug)
        .eq('sequences.status', 'published')
        .maybeSingle()

      const aliasedSlug = (alias?.sequences as unknown as { slug: string } | null)?.slug
      if (aliasedSlug) return { status: 'redirect', slug: aliasedSlug }

      return { status: 'not-found' }
    }

    const [comments, versions, config] = await Promise.all([
      supabase
        .from('comments')
        .select('*, author:profiles(*)')
        .eq('sequence_id', seq.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true }),
      supabase
        .from('sequence_versions')
        .select('*')
        .eq('sequence_id', seq.id)
        .order('version_number', { ascending: false }),
      supabase.from('site_config').select('current_patch').single(),
    ])

    let linkedSequence: LinkedSequence | null = null
    if (seq.set_id) {
      const { data: linked } = await supabase
        .from('sequences')
        .select('id, title, slug, content_type, class_name, spec_name, hero_talent')
        .eq('set_id', seq.set_id)
        .eq('status', 'published')
        .neq('id', seq.id)
        .limit(1)
        .single()
      if (linked) linkedSequence = linked as LinkedSequence
    }

    return {
      status: 'ok',
      data: {
        sequence: seq as Sequence,
        versions: (versions.data ?? []) as SequenceVersion[],
        comments: (comments.data ?? []) as Comment[],
        linkedSequence,
        currentPatch: config.data?.current_patch ?? null,
      },
    }
  } catch {
    return { status: 'unavailable' }
  }
}
