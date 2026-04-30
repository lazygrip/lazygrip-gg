-- LazyGrip.gg Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- Extended user data linked to Supabase auth.users
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  battletag text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- ============================================================
-- SEQUENCES
-- The core content table - one row per posted GRIP sequence
-- ============================================================
create table public.sequences (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  slug text unique not null,
  description text,
  -- WoW metadata
  class_id integer not null,         -- WoW class ID (1-13)
  class_name text not null,          -- e.g. "Druid"
  spec_id integer,                   -- WoW spec ID
  spec_name text,                    -- e.g. "Guardian"
  content_type text not null,        -- 'raid' | 'mythic_plus' | 'pvp' | 'solo'
  hero_talent text,                  -- e.g. "Druid of the Claw"
  patch_version text,                -- e.g. "12.0.1"
  -- GRIP metadata
  grip_version text,                 -- e.g. "1.9.10"
  step_function text,                -- 'Sequential' | 'Priority' | 'Rev. Priority' | 'Random'
  step_count integer,
  -- The actual sequence data
  grip_string text,                  -- The GRIP1 export string for in-game import
  raw_steps jsonb,                   -- Array of step objects for display
  keybind_info jsonb,                -- {keyPress, keyRelease} strings
  talent_string text,                -- WoW talent import string
  -- Performance data (optional, from Warcraft Logs)
  warcraftlogs_url text,
  performance_notes text,
  -- Engagement
  view_count integer default 0,
  save_count integer default 0,
  -- Status
  is_published boolean default true,
  is_featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sequences enable row level security;

create policy "Published sequences are viewable by everyone"
  on public.sequences for select using (is_published = true);

create policy "Authors can insert their own sequences"
  on public.sequences for insert with check (auth.uid() = author_id);

create policy "Authors can update their own sequences"
  on public.sequences for update using (auth.uid() = author_id);

create policy "Authors can delete their own sequences"
  on public.sequences for delete using (auth.uid() = author_id);

-- ============================================================
-- RATINGS
-- 1-10 star ratings per user per sequence
-- ============================================================
create table public.ratings (
  id uuid default uuid_generate_v4() primary key,
  sequence_id uuid references public.sequences(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  score integer not null check (score >= 1 and score <= 10),
  created_at timestamptz default now(),
  unique(sequence_id, user_id)
);

alter table public.ratings enable row level security;

create policy "Ratings are viewable by everyone"
  on public.ratings for select using (true);

create policy "Authenticated users can rate"
  on public.ratings for insert with check (auth.uid() = user_id);

create policy "Users can update their own rating"
  on public.ratings for update using (auth.uid() = user_id);

-- ============================================================
-- COMMENTS
-- Threaded comments on sequences
-- ============================================================
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  sequence_id uuid references public.sequences(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

create policy "Authenticated users can comment"
  on public.comments for insert with check (auth.uid() = author_id);

create policy "Authors can update their own comments"
  on public.comments for update using (auth.uid() = author_id);

-- ============================================================
-- SAVES (bookmarks)
-- Users saving sequences to their profile
-- ============================================================
create table public.saves (
  id uuid default uuid_generate_v4() primary key,
  sequence_id uuid references public.sequences(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(sequence_id, user_id)
);

alter table public.saves enable row level security;

create policy "Users can view their own saves"
  on public.saves for select using (auth.uid() = user_id);

create policy "Users can save sequences"
  on public.saves for insert with check (auth.uid() = user_id);

create policy "Users can unsave sequences"
  on public.saves for delete using (auth.uid() = user_id);

-- ============================================================
-- SEQUENCE VERSIONS
-- Version history when authors update a sequence
-- ============================================================
create table public.sequence_versions (
  id uuid default uuid_generate_v4() primary key,
  sequence_id uuid references public.sequences(id) on delete cascade not null,
  version_label text not null,       -- e.g. "v6", "v14"
  grip_string text not null,
  raw_steps jsonb,
  changelog text,
  created_at timestamptz default now()
);

alter table public.sequence_versions enable row level security;

create policy "Versions are viewable by everyone"
  on public.sequence_versions for select using (true);

-- ============================================================
-- VIEWS - Computed rating average per sequence
-- ============================================================
create or replace view public.sequence_ratings as
  select
    sequence_id,
    round(avg(score)::numeric, 1) as avg_score,
    count(*) as rating_count
  from public.ratings
  group by sequence_id;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-increment view count
create or replace function increment_view_count(seq_id uuid)
returns void as $$
  update public.sequences set view_count = view_count + 1 where id = seq_id;
$$ language sql security definer;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- INDEXES
-- ============================================================
create index sequences_class_id_idx on public.sequences(class_id);
create index sequences_content_type_idx on public.sequences(content_type);
create index sequences_author_id_idx on public.sequences(author_id);
create index sequences_created_at_idx on public.sequences(created_at desc);
create index comments_sequence_id_idx on public.comments(sequence_id);
create index ratings_sequence_id_idx on public.ratings(sequence_id);
