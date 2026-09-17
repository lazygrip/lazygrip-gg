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
      // !sequences_author_id_fkey: required as of migration 030 -- see
      // browse-query.ts's buildBrowseQuery comment for the full explanation.
      // This is THE root cause of the "Sequence not found" bug Ed hit
      // 2026-09-14 clicking into a real published sequence: without the
      // hint, PostgREST returned an ambiguous-relationship error here, this
      // function treated it as `error.code !== 'PGRST116'` and returned
      // 'unavailable', and the client-side fetch this page falls back to
      // (SequencePageClient.tsx) ran the exact same unqualified embed and
      // got the exact same failure, so the page had nothing left to render
      // but "not found."
      // `author:profiles(*)` until 2026-09-17. Narrowed because `select=*`
      // expands to every column at parse time and therefore needs SELECT on
      // every column -- so it is incompatible with the column-scoped grant
      // migration 034 adds, and would have started returning 42501 rather than
      // a row. Two columns, both measured from the consumers rather than
      // guessed: `username` is read at SequencePageClient.tsx:1042-1052, and
      // `display_name` at sequences/[slug]/page.tsx:148, which is the ONLY
      // display_name read off any author embed in the codebase -- drop it and
      // the JSON-LD author name silently degrades to the raw username.
      .select('*, author:profiles!sequences_author_id_fkey(username, display_name)')
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
        // Comments embed. Unqualified on purpose -- comments has a single FK to
        // profiles, so there is no ambiguity to hint past (see the 030
        // two-FK incident). `username` is the only author field CommentThread
        // reads: SequencePageClient.tsx:2052-2180.
        .select('*, author:profiles(username)')
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
