import type { SupabaseClient } from '@supabase/supabase-js'
import type { BrowseSequence, SequenceFilters } from '@/types'
import { DEFAULT_GAME_VERSION } from '@/lib/wow-data'

export const BROWSE_PAGE_SIZE = 20

// The columns the browse listing selects. Issue #24: this was `*`, and `*` on sequences
// means grip_string, raw_steps, the actions tree and collection_sequences for every card
// on the page, none of which a card renders. Those rows are parsed from PostgREST, rendered
// through React, and then serialized a second time as the client component's props in the
// page HTML, on every request, and both browse routes render per request (the root layout
// needs a fresh CSP nonce, see src/lib/csp.ts). Measured 2026-10-15 on a local production
// build of main against 20 synthetic rows of about 12 KB each (30 steps, a 3 KB
// grip_string), 60 sequential requests, CPU read off the server process: /browse was
// 491 KB of HTML, 351 KB of it serialized props, at 46 ms of CPU per request, against
// 14 ms for a page that renders only the layout. With this list: 184 KB, 44 KB of props,
// 26.5 ms. The full table is in the commit that introduced this.
//
// `satisfies` rejects a name here that is not a BrowseSequence column, and the Assert below
// rejects a BrowseSequence column that is not listed here, so the type and the query cannot
// drift apart in either direction without the build failing. `author` is the embed, not a
// column of sequences, so it is excluded from both sides rather than from one.
type BrowseColumn = Exclude<keyof BrowseSequence, 'author'>

export const BROWSE_CARD_COLUMNS = [
  'id',
  'slug',
  'title',
  'description',
  'class_id',
  'class_name',
  'spec_name',
  'content_type',
  'patch_version',
  'game_version',
  'grip_version',
  'current_version_label',
  'view_count',
  'save_count',
  'comment_count',
  'avg_score',
  'rating_count',
  'created_at',
  'updated_at',
] as const satisfies readonly BrowseColumn[]

type Assert<T extends true> = T
type ColumnNotSelected = Exclude<BrowseColumn, (typeof BROWSE_CARD_COLUMNS)[number]>
export type BrowseColumnsCoverEveryColumn = Assert<ColumnNotSelected extends never ? true : false>

// !sequences_author_id_fkey pins the embed to the author_id relationship.
// Migration 030 added profiles.featured_sequence_id, a SECOND foreign key
// between sequences and profiles (pointing the other way). PostgREST can no
// longer infer which relationship an unqualified profiles(...) embed means
// once two exist between the same two tables -- it returns HTTP 300 with a
// "more than one relationship was found" body instead of data. Confirmed
// live 2026-09-14: this exact query was silently returning that 300 (Ed's
// Death Knight browse page showing "0 sequences" with real published rows
// in the table) until this hint was added.
//
// username is what SequenceCard renders; display_name is read by the homepage
// leaderboard, which runs this same query through fetchTrendingSequences.
export const BROWSE_LISTING_SELECT = `${BROWSE_CARD_COLUMNS.join(', ')}, author:profiles!sequences_author_id_fkey(username, display_name)`

// PostgREST reads `or=` as a comma-separated condition list, so an unquoted user term containing a
// comma splits the filter into malformed conditions and the whole request 400s. Wrapping the LIKE
// pattern in double quotes makes commas, parentheses and periods literal; backslash and double
// quote then have to be escaped inside the quotes. Measured against live PostgREST 2026-07-29:
// unquoted `guardian,` returns 400, quoted returns 200 with the same rows a plain term gives.
// Deliberately does NOT escape the LIKE wildcards % and _. That would change what every existing
// search matches, and it is not needed to stop the 400.
export function searchPattern(search: string): string {
  const escaped = search.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"%${escaped}%"`
}

// Single source of truth for the browse listing query. The server page and the client
// component must produce identical result sets, otherwise the server-rendered first page
// is replaced by a different one the moment the client hydrates.
export function buildBrowseQuery(supabase: SupabaseClient, filters: SequenceFilters) {
  let query = supabase
    .from('sequences')
    .select(BROWSE_LISTING_SELECT, { count: 'exact' })
    .eq('status', 'published')

  if (filters.class_id) query = query.eq('class_id', filters.class_id)
  if (filters.spec_id) query = query.eq('spec_id', filters.spec_id)
  if (filters.content_type) query = query.eq('content_type', filters.content_type)
  if (filters.patch_version) query = query.eq('patch_version', filters.patch_version)
  // Retail is the default, so a listing never mixes a Forever sequence into retail results
  // unless the visitor asks for it. Same default on the server page and the client component.
  query = query.eq('game_version', filters.game_version ?? DEFAULT_GAME_VERSION)
  if (filters.search) {
    const pattern = searchPattern(filters.search)
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`)
  }

  switch (filters.sort) {
    case 'top_rated':
      query = query.gt('rating_count', 0).order('avg_score', { ascending: false }).order('rating_count', { ascending: false })
      break
    case 'most_viewed':
      query = query.order('view_count', { ascending: false })
      break
    case 'most_saved':
      query = query.order('save_count', { ascending: false })
      break
    default:
      query = query.order('updated_at', { ascending: false })
  }

  const limit = filters.limit || BROWSE_PAGE_SIZE
  const from = ((filters.page || 1) - 1) * limit
  return (
    query
      .range(from, from + limit - 1)
      // supabase-js types a select from the literal string it is given, and
      // BROWSE_LISTING_SELECT is assembled at runtime, so the parser cannot read it and
      // would type every row as its parse-error type. This is where the row type comes
      // from instead; merge: false so nothing of that error type survives in it.
      .overrideTypes<BrowseSequence[], { merge: false }>()
  )
}

// Stable identity for a filter set. The server hands the client the key it fetched with, and
// the client skips its first fetch for as long as the live filters still hash to that key.
export function browseFilterKey(filters: SequenceFilters): string {
  return JSON.stringify([
    filters.sort || 'recent',
    filters.page || 1,
    filters.limit || BROWSE_PAGE_SIZE,
    filters.class_id ?? null,
    filters.spec_id ?? null,
    filters.content_type ?? null,
    filters.patch_version ?? null,
    filters.game_version ?? null,
    filters.search ?? null,
  ])
}
