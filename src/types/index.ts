export type WowClass = {
  id: number
  name: string
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

export type Profile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  battletag: string | null
  bio: string | null
  created_at: string
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
  keybind_info: KeybindInfo | null
  talent_string: string | null
  warcraftlogs_url: string | null
  performance_notes: string | null
  view_count: number
  save_count: number
  is_published: boolean
  is_featured: boolean
  created_at: string
  updated_at: string
  // Joined fields
  author?: Profile
  avg_score?: number
  rating_count?: number
  user_has_saved?: boolean
  user_rating?: number
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
  version_label: string
  grip_string: string
  raw_steps: SequenceStep[] | null
  changelog: string | null
  created_at: string
}

// Filter/search types
export type SequenceFilters = {
  class_id?: number
  spec_name?: string
  content_type?: ContentType
  grip_version?: string
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