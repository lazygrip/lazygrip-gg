export type WowClass = {
  id: number
  name: string
  slug: string
  color: string
  specs: WowSpec[]
}

export type WowSpec = {
  id: number
  name: string
  role: 'tank' | 'healer' | 'dps'
  heroTalents: string[]
}

export type ContentType = 'raid' | 'mythic_plus' | 'pvp' | 'solo'
export type StepFunction = 'Sequential' | 'Priority' | 'Rev. Priority' | 'Random'

// Hierarchical decoded action tree -- mirrors the shape
// src/lib/workshop/emsDecoder.ts's normalizeGripActions() produces and
// src/components/sequence/ActionTree.tsx renders. Stored verbatim in the
// `actions` jsonb column added by migration 025, alongside the older flat
// `raw_steps` array. Nullable everywhere it appears: older rows saved before
// this column existed have no actions data, and every consumer falls back to
// rendering the flat SequenceStep[] for those rows. See migration 025 for why
// this exists -- raw_steps alone can't represent Loop/Repeat/If structure, so
// a sequence built from a repeating loop displayed with no indication it
// repeated at all.
export type ActionNode = {
  index: number
  kind: 'Loop' | 'Action' | 'Repeat' | 'If' | 'Pause' | 'Embed'
  depth: number
  label: string
  text?: string
  stepFunction?: string
  repeat?: number
  interval?: number
  variable?: string
  children?: ActionNode[]
}

export type Profile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  battletag: string | null
  bio: string | null
  created_at: string
  // Set once the user completes the /welcome onboarding interstitial (custom
  // username + guidelines acknowledgment). Null until then. Added alongside
  // the has_completed_onboarding() DB function and the username-deadline policy.
  terms_accepted_at?: string | null
}

export type LinkedSequence = {
  id: string
  title: string
  slug: string
  content_type: ContentType
  class_name: string
  spec_name: string | null
  hero_talent: string | null
}

export type CollectionSequenceEntry = {
  name: string
  steps: SequenceStep[]
  // See ActionNode above. Optional -- collections published before migration
  // 025 (or any client that hasn't been updated to send it) simply omit this,
  // and the display falls back to `steps`.
  actions?: ActionNode[]
  stepFunction: string | null
  talent_string: string | null
}

export type Sequence = {
  id: string
  author_id: string
  title: string
  slug: string
  description: string | null
  class_id: number
  class_name: string
  spec_id: number | null
  spec_name: string | null
  content_type: ContentType
  hero_talent: string | null
  patch_version: string | null
  grip_version: string | null
  step_function: StepFunction
  step_count: number | null
  grip_string: string | null
  raw_steps: SequenceStep[] | null
  // See ActionNode above. Mirrors the CURRENT version's actions tree (kept in
  // sync by the write RPCs as of migration 025). Null for rows saved before
  // that migration until their author re-saves.
  actions: ActionNode[] | null
  keybind_info: KeybindInfo | null
  talent_string: string | null
  warcraftlogs_url: string | null
  performance_notes: string | null
  view_count: number
  save_count: number
  comment_count: number
  status: 'draft' | 'published' | 'archived'
  is_featured: boolean
  set_id: string | null
  collection_sequences: CollectionSequenceEntry[] | null
  current_version_id: string | null
  current_version_label: string | null
  // Original author as declared at creation time (from the export blob or the
  // author-lock system). Not the same as the posting account -- see `author`
  // below. Immutable after creation; edit RPCs never touch this column.
  // Optional rather than required: not every Sequence-typed object in the
  // codebase is guaranteed to be constructed from a full Supabase row.
  original_author?: string | null
  created_at: string
  updated_at: string
  // Joined fields
  author?: Profile
  avg_score?: number
  rating_count?: number
  user_has_saved?: boolean
  user_rating?: number
  linked_sequence?: LinkedSequence | null
}

export type SequenceStep = {
  index: number
  text: string
  char_count: number
  label?: string
}

export type KeybindInfo = {
  keyPress: string
  keyRelease: string
}

export type Rating = {
  id: string
  sequence_id: string
  user_id: string
  score: number
  created_at: string
}

export type Comment = {
  id: string
  sequence_id: string
  author_id: string
  parent_id: string | null
  body: string
  is_deleted: boolean
  // Added by migration 012, alongside comments.source's default of 'web'
  // and comments.discord_message_id -- present on every row since that
  // migration, this type just hadn't caught up until now (2026-08-11).
  source: 'web' | 'discord'
  discord_message_id: string | null
  created_at: string
  updated_at: string
  author?: Profile
  replies?: Comment[]
}

export type Save = {
  id: string
  sequence_id: string
  user_id: string
  created_at: string
}

export type SequenceVersion = {
  id: string
  sequence_id: string
  version_number: number
  version_label: string
  grip_string: string
  raw_steps: SequenceStep[] | null
  // See ActionNode above and Sequence.actions. This version's own tree,
  // independent of whichever version happens to be `current`.
  actions: ActionNode[] | null
  changelog: string | null
  author_id: string
  hero_talent: string | null
  content_type: string | null
  step_function: string | null
  grip_version: string | null
  talent_string: string | null
  warcraftlogs_url: string | null
  performance_notes: string | null
  created_at: string
}

// Filter/search types
export type SequenceFilters = {
  class_id?: number
  spec_id?: number
  spec_name?: string
  content_type?: ContentType
  grip_version?: string
  patch_version?: string
  search?: string
  sort?: 'recent' | 'top_rated' | 'most_viewed' | 'most_saved'
  page?: number
  limit?: number
}

export type PaginatedResponse<T> = {
  data: T[]
  count: number
  page: number
  totalPages: number
}
