-- 002_schema_sync.sql
--
-- Captures the live schema as of 2026-07-20, since 001_initial_schema.sql
-- predates most of the tables/columns/RPCs/policies below by a wide margin
-- and the repo has never been able to rebuild the real database from source.
--
-- Built by hand from direct SQL queries against the live database
-- (information_schema.columns, pg_policies, pg_get_functiondef, pg_enum),
-- NOT from `supabase db pull` -- Docker Desktop isn't installed on this
-- machine and db pull requires it to provision a local shadow database for
-- diffing. This file is a best-effort snapshot, not a CLI-verified diff.
-- It should still be reviewed against a real `supabase db pull` whenever
-- Docker becomes available, to catch anything this hand-built pass missed
-- (constraints, indexes, foreign keys, and trigger *bindings* in particular
-- were not exhaustively queried this session -- see NOTE at bottom).
--
-- This migration is intentionally idempotent (IF NOT EXISTS / OR REPLACE
-- everywhere) so it is safe to run against the live database even though
-- every object it describes already exists there.

-- ============================================================
-- ENUM TYPES
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sequence_status') then
    create type public.sequence_status as enum ('draft', 'published', 'archived');
  end if;
end $$;

-- ============================================================
-- TABLES
-- ============================================================

-- profiles
create table if not exists public.profiles (
  id uuid primary key,
  username text not null,
  display_name text,
  avatar_url text,
  battletag text,
  bio text,
  avatar_color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- sequences
create table if not exists public.sequences (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null,
  title text not null,
  slug text not null,
  description text,
  class_id integer not null,
  class_name text not null,
  spec_id integer,
  spec_name text,
  content_type text not null,
  hero_talent text,
  patch_version text,
  grip_version text,
  step_function text,
  step_count integer,
  grip_string text,
  raw_steps jsonb,
  keybind_info jsonb,
  talent_string text,
  warcraftlogs_url text,
  performance_notes text,
  view_count integer default 0,
  save_count integer default 0,
  is_featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  avg_score numeric,
  rating_count integer not null default 0,
  comment_count integer not null default 0,
  current_version_id uuid,
  current_version_label text,
  set_id uuid,
  collection_sequences jsonb,
  original_author text,
  attribution_acknowledged_at timestamptz,
  discord_thread_id text,
  last_discord_notified_at timestamptz,
  status public.sequence_status not null default 'draft'
);

-- sequence_versions
create table if not exists public.sequence_versions (
  id uuid primary key default uuid_generate_v4(),
  sequence_id uuid not null,
  version_label text not null,
  grip_string text not null,
  raw_steps jsonb,
  changelog text,
  created_at timestamptz default now(),
  version_number integer not null default 1,
  author_id uuid,
  hero_talent text,
  content_type text,
  step_function text,
  grip_version text,
  talent_string text,
  warcraftlogs_url text,
  performance_notes text
);

-- ratings
create table if not exists public.ratings (
  id uuid primary key default uuid_generate_v4(),
  sequence_id uuid not null,
  user_id uuid not null,
  score integer not null,
  created_at timestamptz default now(),
  reason_tags text[]
);

-- comments
create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  sequence_id uuid not null,
  author_id uuid not null,
  parent_id uuid,
  body text not null,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- saves
create table if not exists public.saves (
  id uuid primary key default uuid_generate_v4(),
  sequence_id uuid not null,
  user_id uuid not null,
  created_at timestamptz default now()
);

-- notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  sequence_id uuid,
  actor_id uuid,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- site_config: singleton table. id is a boolean primary key that can only
-- ever be `true`, so the table structurally cannot hold more than one row.
create table if not exists public.site_config (
  id boolean primary key default true,
  current_patch text,
  current_patch_updated_at timestamptz
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.sequences enable row level security;
alter table public.sequence_versions enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;
alter table public.saves enable row level security;
alter table public.notifications enable row level security;
alter table public.site_config enable row level security;

-- profiles
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- sequences
drop policy if exists "Published sequences are viewable by everyone" on public.sequences;
create policy "Published sequences are viewable by everyone"
  on public.sequences for select using (status = 'published'::sequence_status);

drop policy if exists "Authors can view their own sequences" on public.sequences;
create policy "Authors can view their own sequences"
  on public.sequences for select using (auth.uid() = author_id);

drop policy if exists "Authors can insert their own sequences" on public.sequences;
create policy "Authors can insert their own sequences"
  on public.sequences for insert with check (auth.uid() = author_id);

drop policy if exists "Authors can update their own sequences" on public.sequences;
create policy "Authors can update their own sequences"
  on public.sequences for update using (auth.uid() = author_id);

drop policy if exists "Authors can delete their own sequences" on public.sequences;
create policy "Authors can delete their own sequences"
  on public.sequences for delete using (auth.uid() = author_id);

-- sequence_versions
drop policy if exists "Versions are viewable by everyone" on public.sequence_versions;
create policy "Versions are viewable by everyone"
  on public.sequence_versions for select using (true);

drop policy if exists "Anyone can read sequence versions" on public.sequence_versions;
create policy "Anyone can read sequence versions"
  on public.sequence_versions for select using (true);

drop policy if exists "Authors can insert versions for their own sequences" on public.sequence_versions;
create policy "Authors can insert versions for their own sequences"
  on public.sequence_versions for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.sequences s
      where s.id = sequence_versions.sequence_id
        and s.author_id = auth.uid()
    )
  );

-- ratings (SEC1/SEC7-era policy already tightened this session)
drop policy if exists "Authenticated users can rate" on public.ratings;
create policy "Authenticated users can rate"
  on public.ratings for insert with check (auth.uid() = user_id);

drop policy if exists "Ratings visible to author and admin" on public.ratings;
create policy "Ratings visible to author and admin"
  on public.ratings for select using (
    auth.uid() = (select author_id from public.sequences where id = ratings.sequence_id)
    or auth.uid() = user_id
    or auth.uid() = 'c2374192-e541-4636-9baf-84fc192cff52'::uuid
  );

drop policy if exists "Users can update their own rating" on public.ratings;
create policy "Users can update their own rating"
  on public.ratings for update using (auth.uid() = user_id);

-- comments
-- NOTE (SEC8, staged by Sataana 2026-07-20): this SELECT policy is
-- confirmed live as `using (true)` with no is_deleted filter, meaning a
-- soft-deleted comment's body is still readable via the anon key. Captured
-- here as-is (matching live reality) rather than silently "fixed" inside a
-- schema-sync migration -- the SEC8 policy change belongs in its own,
-- separately reviewed migration, not bundled into this one.
drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

drop policy if exists "Authenticated users can comment" on public.comments;
create policy "Authenticated users can comment"
  on public.comments for insert with check (auth.uid() = author_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "Authors can update their own comments" on public.comments;
create policy "Authors can update their own comments"
  on public.comments for update using (auth.uid() = author_id);

-- saves
drop policy if exists "Users can view their own saves" on public.saves;
create policy "Users can view their own saves"
  on public.saves for select using (auth.uid() = user_id);

drop policy if exists "Users can save sequences" on public.saves;
create policy "Users can save sequences"
  on public.saves for insert with check (auth.uid() = user_id);

drop policy if exists "Users can unsave sequences" on public.saves;
create policy "Users can unsave sequences"
  on public.saves for delete using (auth.uid() = user_id);

-- notifications
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "Users can insert notifications" on public.notifications;
create policy "Users can insert notifications"
  on public.notifications for insert with check (auth.uid() is not null);

drop policy if exists "Users can mark their own notifications as read" on public.notifications;
create policy "Users can mark their own notifications as read"
  on public.notifications for update using (auth.uid() = user_id);

-- site_config
drop policy if exists "site_config_select_all" on public.site_config;
create policy "site_config_select_all"
  on public.site_config for select using (true);

-- ============================================================
-- FUNCTIONS (all SECURITY DEFINER, matching live -- verified this session
-- via pg_get_functiondef against the real database, not reconstructed from
-- memory or inferred from call sites)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, avatar_color)
  VALUES (
    NEW.id,
    split_part(
      COALESCE(
        NEW.raw_user_meta_data->>'user_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'battletag',
        split_part(NEW.email, '@', 1),
        'user_' || substr(NEW.id::text, 1, 8)
      ),
      '#', 1
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    '#7c3aed'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

create or replace function public.increment_view_count(seq_id uuid)
returns void
language sql
security definer
as $function$
  update public.sequences set view_count = view_count + 1 where id = seq_id;
$function$;

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
as $function$
declare
  seq_author_id uuid;
  seq_title text;
  actor_username text;
begin
  select author_id, title into seq_author_id, seq_title
  from sequences where id = new.sequence_id;

  if seq_author_id = new.author_id then
    return new;
  end if;

  select username into actor_username
  from profiles where id = new.author_id;

  insert into notifications (user_id, type, sequence_id, actor_id, message)
  values (
    seq_author_id,
    'comment',
    new.sequence_id,
    new.author_id,
    actor_username || ' commented on "' || seq_title || '"'
  );

  return new;
end;
$function$;

create or replace function public.notify_on_rating()
returns trigger
language plpgsql
security definer
as $function$
declare
  seq_author_id uuid;
  seq_title text;
  actor_username text;
begin
  select author_id, title into seq_author_id, seq_title
  from sequences where id = new.sequence_id;

  if seq_author_id = new.user_id then
    return new;
  end if;

  select username into actor_username
  from profiles where id = new.user_id;

  insert into notifications (user_id, type, sequence_id, actor_id, message)
  values (
    seq_author_id,
    'rating',
    new.sequence_id,
    new.user_id,
    actor_username || ' rated "' || seq_title || '" ' || new.score || '/10'
  );

  return new;
end;
$function$;

create or replace function public.update_comment_count()
returns trigger
language plpgsql
security definer
as $function$
begin
  if TG_OP = 'INSERT' then
    update sequences set comment_count = comment_count + 1 where id = NEW.sequence_id;
  elsif TG_OP = 'UPDATE' and NEW.is_deleted = true and OLD.is_deleted = false then
    update sequences set comment_count = greatest(0, comment_count - 1) where id = NEW.sequence_id;
  elsif TG_OP = 'DELETE' then
    update sequences set comment_count = greatest(0, comment_count - 1) where id = OLD.sequence_id;
  end if;
  return null;
end;
$function$;

create or replace function public.update_sequence_rating()
returns trigger
language plpgsql
security definer
as $function$
begin
  update sequences set
    avg_score = (select round(avg(score)::numeric, 1) from ratings where sequence_id = coalesce(new.sequence_id, old.sequence_id)),
    rating_count = (select count(*) from ratings where sequence_id = coalesce(new.sequence_id, old.sequence_id))
  where id = coalesce(new.sequence_id, old.sequence_id);
  return coalesce(new, old);
end;
$function$;

create or replace function public.set_current_patch(new_patch text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is distinct from 'c2374192-e541-4636-9baf-84fc192cff52'::uuid then
    raise exception 'not authorized';
  end if;

  update public.site_config
  set current_patch = new_patch,
      current_patch_updated_at = now()
  where id = true;
end;
$function$;

create or replace function public.delete_sequence_version(p_version_id uuid, p_sequence_id uuid, p_author_id uuid)
returns void
language plpgsql
security definer
as $function$
declare
  v_current_version_id uuid;
begin
  if not exists (
    select 1 from public.sequences
    where id = p_sequence_id and author_id = p_author_id
  ) then
    raise exception 'Not authorised';
  end if;

  select current_version_id into v_current_version_id
  from public.sequences
  where id = p_sequence_id;

  if p_version_id = v_current_version_id then
    raise exception 'Cannot delete the current version';
  end if;

  delete from public.sequence_versions
  where id = p_version_id
  and sequence_id = p_sequence_id;
end;
$function$;

create or replace function public.update_sequence_metadata(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text DEFAULT NULL::text)
returns void
language plpgsql
security definer
as $function$
declare
  v_raw_steps jsonb;
  v_collection_sequences jsonb;
  v_current_version_id uuid;
begin
  if not exists (
    select 1 from public.sequences
    where id = p_sequence_id and author_id = p_author_id
  ) then
    raise exception 'Not authorised';
  end if;

  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;

  if p_collection_sequences is null then
    v_collection_sequences := null;
  else
    v_collection_sequences := p_collection_sequences::jsonb;
  end if;

  update public.sequences set
    title = p_title,
    description = p_description,
    class_id = p_class_id,
    class_name = p_class_name,
    spec_id = p_spec_id,
    spec_name = p_spec_name,
    content_type = p_content_type,
    hero_talent = p_hero_talent,
    patch_version = p_patch_version,
    grip_version = p_grip_version,
    step_function = p_step_function,
    step_count = p_step_count,
    grip_string = p_grip_string,
    raw_steps = v_raw_steps,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes,
    collection_sequences = coalesce(v_collection_sequences, collection_sequences),
    updated_at = now()
  where id = p_sequence_id
  returning current_version_id into v_current_version_id;

  if v_current_version_id is not null then
    update public.sequence_versions set
      hero_talent = p_hero_talent,
      content_type = p_content_type,
      step_function = p_step_function,
      grip_version = p_grip_version,
      talent_string = p_talent_string,
      warcraftlogs_url = p_warcraftlogs_url,
      performance_notes = p_performance_notes
    where id = v_current_version_id;
  end if;
end;
$function$;

create or replace function public.update_sequence_with_version(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text)
returns json
language plpgsql
security definer
as $function$
declare
  v_version_id uuid;
  v_raw_steps jsonb;
  v_next_version_number integer;
  v_version_label text;
begin
  if not exists (
    select 1 from public.sequences
    where id = p_sequence_id and author_id = p_author_id
  ) then
    raise exception 'Not authorised';
  end if;

  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_next_version_number
  from public.sequence_versions
  where sequence_id = p_sequence_id;

  v_version_label := '1.' || (v_next_version_number - 1)::text;

  update public.sequences set
    title = p_title,
    description = p_description,
    class_id = p_class_id,
    class_name = p_class_name,
    spec_id = p_spec_id,
    spec_name = p_spec_name,
    content_type = p_content_type,
    hero_talent = p_hero_talent,
    patch_version = p_patch_version,
    grip_version = p_grip_version,
    step_function = p_step_function,
    step_count = p_step_count,
    grip_string = p_grip_string,
    raw_steps = v_raw_steps,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes
  where id = p_sequence_id;

  insert into public.sequence_versions (
    sequence_id, author_id, version_number, version_label,
    grip_string, raw_steps, changelog,
    hero_talent, content_type, step_function, grip_version,
    talent_string, warcraftlogs_url, performance_notes
  ) values (
    p_sequence_id, p_author_id, v_next_version_number, v_version_label,
    p_grip_string, v_raw_steps, p_changelog,
    p_hero_talent, p_content_type, p_step_function, p_grip_version,
    p_talent_string, p_warcraftlogs_url, p_performance_notes
  )
  returning id into v_version_id;

  update public.sequences set
    current_version_id = v_version_id,
    current_version_label = v_version_label
  where id = p_sequence_id;

  return json_build_object(
    'sequence_id', p_sequence_id,
    'version_id', v_version_id,
    'version_number', v_next_version_number
  );
end;
$function$;

-- create_sequence_with_version and publish_sequence_version below already
-- include the auth.uid() ownership check added earlier this session
-- (previously missing -- see today's fix).

-- FIX (2026-07-20, found while building this migration): the live version of
-- this function inserted into a column called is_published, which does not
-- exist on public.sequences -- the table was migrated to the status enum
-- (draft/published/archived) at some point and this RPC was never updated
-- to match. It is a rare-but-reachable fallback path in post/page.tsx (fires
-- only when Publish is clicked before autosave has created a draft row), so
-- it wasn't dead code, just a live bug nobody had hit yet. Confirmed via
-- pg_get_functiondef against the real function and cross-checked against
-- the real call site in post/page.tsx before changing this.
create or replace function public.create_sequence_with_version(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false)
returns json
language plpgsql
security definer
as $function$
declare
  v_sequence_id uuid;
  v_version_id uuid;
  v_raw_steps jsonb;
  v_attribution_acknowledged_at timestamptz;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;

  v_attribution_acknowledged_at := case when p_attribution_acknowledged then now() else null end;

  insert into public.sequences (
    author_id, title, slug, description,
    class_id, class_name, spec_id, spec_name,
    content_type, hero_talent, patch_version, grip_version,
    step_function, step_count, grip_string, raw_steps,
    talent_string, warcraftlogs_url, performance_notes,
    original_author, attribution_acknowledged_at,
    status
  ) values (
    p_author_id, p_title, p_slug, p_description,
    p_class_id, p_class_name, p_spec_id, p_spec_name,
    p_content_type, p_hero_talent, p_patch_version, p_grip_version,
    p_step_function, p_step_count, p_grip_string, v_raw_steps,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_original_author, v_attribution_acknowledged_at,
    'published'
  )
  returning id into v_sequence_id;

  insert into public.sequence_versions (
    sequence_id, author_id, version_number, version_label,
    grip_string, raw_steps, changelog,
    hero_talent, content_type, step_function, grip_version,
    talent_string, warcraftlogs_url, performance_notes
  ) values (
    v_sequence_id, p_author_id, 1, '1.0',
    p_grip_string, v_raw_steps, p_changelog,
    p_hero_talent, p_content_type, p_step_function, p_grip_version,
    p_talent_string, p_warcraftlogs_url, p_performance_notes
  )
  returning id into v_version_id;

  update public.sequences
  set current_version_id = v_version_id,
      current_version_label = '1.0'
  where id = v_sequence_id;

  return json_build_object(
    'sequence_id', v_sequence_id,
    'version_id', v_version_id,
    'slug', p_slug
  );
end;
$function$;

create or replace function public.publish_sequence_version(p_sequence_id uuid, p_version_number integer, p_version_label text, p_grip_string text, p_raw_steps jsonb, p_changelog text, p_author_id uuid, p_hero_talent text, p_content_type text, p_step_function text, p_grip_version text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text)
returns uuid
language plpgsql
security definer
as $function$
declare
  v_new_version_id uuid;
  v_owner uuid;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  select author_id into v_owner
  from public.sequences
  where id = p_sequence_id;

  if v_owner is null then
    raise exception 'sequence not found';
  end if;

  if v_owner is distinct from auth.uid() then
    raise exception 'not the owner of this sequence';
  end if;

  insert into sequence_versions (
    sequence_id,
    version_number,
    version_label,
    grip_string,
    raw_steps,
    changelog,
    author_id,
    hero_talent,
    content_type,
    step_function,
    grip_version,
    talent_string,
    warcraftlogs_url,
    performance_notes
  )
  values (
    p_sequence_id,
    p_version_number,
    p_version_label,
    p_grip_string,
    p_raw_steps,
    p_changelog,
    p_author_id,
    p_hero_talent,
    p_content_type,
    p_step_function,
    p_grip_version,
    p_talent_string,
    p_warcraftlogs_url,
    p_performance_notes
  )
  returning id into v_new_version_id;

  update sequences
  set
    current_version_id = v_new_version_id,
    current_version_label = p_version_label,
    hero_talent = p_hero_talent,
    content_type = p_content_type,
    step_function = p_step_function,
    grip_version = p_grip_version,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes,
    updated_at = now()
  where id = p_sequence_id;

  return v_new_version_id;
end;
$function$;

create or replace function public.create_draft_sequence(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false, p_collection_sequences text DEFAULT NULL::text)
returns json
language plpgsql
security definer
as $function$
declare
  v_sequence_id uuid;
  v_raw_steps jsonb;
  v_collection_sequences jsonb;
  v_attribution_acknowledged_at timestamptz;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;
  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;
  if p_collection_sequences is null then
    v_collection_sequences := null;
  else
    v_collection_sequences := p_collection_sequences::jsonb;
  end if;
  v_attribution_acknowledged_at := case when p_attribution_acknowledged then now() else null end;
  insert into public.sequences (
    author_id, title, slug, description,
    class_id, class_name, spec_id, spec_name,
    content_type, hero_talent, patch_version, grip_version,
    step_function, step_count, grip_string, raw_steps,
    talent_string, warcraftlogs_url, performance_notes,
    original_author, attribution_acknowledged_at,
    collection_sequences,
    status
  ) values (
    p_author_id, p_title, p_slug, p_description,
    p_class_id, p_class_name, p_spec_id, p_spec_name,
    p_content_type, p_hero_talent, p_patch_version, p_grip_version,
    p_step_function, p_step_count, p_grip_string, v_raw_steps,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_original_author, v_attribution_acknowledged_at,
    v_collection_sequences,
    'draft'
  )
  returning id into v_sequence_id;
  return json_build_object(
    'sequence_id', v_sequence_id,
    'slug', p_slug
  );
end;
$function$;

create or replace function public.update_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text DEFAULT NULL::text)
returns json
language plpgsql
security definer
as $function$
declare
  v_raw_steps jsonb;
  v_collection_sequences jsonb;
  v_status sequence_status;
  v_owner uuid;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;
  select status, author_id into v_status, v_owner
  from public.sequences
  where id = p_sequence_id;
  if v_owner is null then
    raise exception 'sequence not found';
  end if;
  if v_owner is distinct from auth.uid() then
    raise exception 'not the owner of this sequence';
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'sequence is not a draft, cannot update through this function';
  end if;
  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;
  if p_collection_sequences is null then
    v_collection_sequences := null;
  else
    v_collection_sequences := p_collection_sequences::jsonb;
  end if;
  update public.sequences set
    title = p_title,
    description = p_description,
    class_id = p_class_id,
    class_name = p_class_name,
    spec_id = p_spec_id,
    spec_name = p_spec_name,
    content_type = p_content_type,
    hero_talent = p_hero_talent,
    patch_version = p_patch_version,
    grip_version = p_grip_version,
    step_function = p_step_function,
    step_count = p_step_count,
    grip_string = p_grip_string,
    raw_steps = v_raw_steps,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes,
    collection_sequences = coalesce(v_collection_sequences, collection_sequences),
    updated_at = now()
  where id = p_sequence_id;
  return json_build_object('sequence_id', p_sequence_id);
end;
$function$;

create or replace function public.publish_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_changelog text DEFAULT NULL::text)
returns json
language plpgsql
security definer
as $function$
declare
  v_version_id uuid;
  v_status sequence_status;
  v_owner uuid;
  v_grip_string text;
  v_raw_steps jsonb;
  v_hero_talent text;
  v_content_type text;
  v_step_function text;
  v_grip_version text;
  v_talent_string text;
  v_warcraftlogs_url text;
  v_performance_notes text;
  v_title text;
  v_class_id integer;
  v_collection_sequences jsonb;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;
  select status, author_id, grip_string, raw_steps, hero_talent,
         content_type, step_function, grip_version, talent_string,
         warcraftlogs_url, performance_notes, title, class_id,
         collection_sequences
  into v_status, v_owner, v_grip_string, v_raw_steps, v_hero_talent,
       v_content_type, v_step_function, v_grip_version, v_talent_string,
       v_warcraftlogs_url, v_performance_notes, v_title, v_class_id,
       v_collection_sequences
  from public.sequences
  where id = p_sequence_id;
  if v_owner is null then
    raise exception 'sequence not found';
  end if;
  if v_owner is distinct from auth.uid() then
    raise exception 'not the owner of this sequence';
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'sequence is not a draft, nothing to publish';
  end if;
  if v_title is null or trim(v_title) = '' then
    raise exception 'draft is missing a title, cannot publish';
  end if;
  if v_class_id is null then
    raise exception 'draft is missing a class, cannot publish';
  end if;

  if v_collection_sequences is not null then
    if jsonb_array_length(v_collection_sequences) = 0 then
      raise exception 'collection draft has no sequences, cannot publish';
    end if;

    update public.sequences
    set status = 'published'
    where id = p_sequence_id;

    return json_build_object(
      'sequence_id', p_sequence_id,
      'version_id', null
    );
  end if;

  if v_grip_string is null or trim(v_grip_string) = '' then
    raise exception 'draft is missing a GRIP export string, cannot publish';
  end if;
  insert into public.sequence_versions (
    sequence_id, author_id, version_number, version_label,
    grip_string, raw_steps, changelog,
    hero_talent, content_type, step_function, grip_version,
    talent_string, warcraftlogs_url, performance_notes
  ) values (
    p_sequence_id, p_author_id, 1, '1.0',
    v_grip_string, v_raw_steps, p_changelog,
    v_hero_talent, v_content_type, v_step_function, v_grip_version,
    v_talent_string, v_warcraftlogs_url, v_performance_notes
  )
  returning id into v_version_id;
  update public.sequences
  set current_version_id = v_version_id,
      current_version_label = '1.0',
      status = 'published'
  where id = p_sequence_id;
  return json_build_object(
    'sequence_id', p_sequence_id,
    'version_id', v_version_id
  );
end;
$function$;

create or replace function public.publish_draft_sequences_batch(p_sequence_ids uuid[], p_author_id uuid, p_changelog text DEFAULT NULL::text)
returns json
language plpgsql
security definer
as $function$
declare
  v_sequence_id uuid;
  v_version_id uuid;
  v_status sequence_status;
  v_owner uuid;
  v_grip_string text;
  v_raw_steps jsonb;
  v_hero_talent text;
  v_content_type text;
  v_step_function text;
  v_grip_version text;
  v_talent_string text;
  v_warcraftlogs_url text;
  v_performance_notes text;
  v_title text;
  v_class_id integer;
  v_collection_sequences jsonb;
  v_results json[] := array[]::json[];
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  if p_sequence_ids is null or array_length(p_sequence_ids, 1) is null then
    raise exception 'no sequence ids provided';
  end if;

  foreach v_sequence_id in array p_sequence_ids
  loop
    select status, author_id, title, class_id, grip_string, collection_sequences
    into v_status, v_owner, v_title, v_class_id, v_grip_string, v_collection_sequences
    from public.sequences
    where id = v_sequence_id;

    if v_owner is null then
      raise exception 'sequence % not found', v_sequence_id;
    end if;
    if v_owner is distinct from auth.uid() then
      raise exception 'not the owner of sequence %', v_sequence_id;
    end if;
    if v_status is distinct from 'draft' then
      raise exception 'sequence % is not a draft, nothing to publish', v_sequence_id;
    end if;
    if v_title is null or trim(v_title) = '' then
      raise exception 'draft % is missing a title, cannot publish', v_sequence_id;
    end if;
    if v_class_id is null then
      raise exception 'draft % is missing a class, cannot publish', v_sequence_id;
    end if;

    if v_collection_sequences is not null then
      if jsonb_array_length(v_collection_sequences) = 0 then
        raise exception 'collection draft % has no sequences, cannot publish', v_sequence_id;
      end if;
    else
      if v_grip_string is null or trim(v_grip_string) = '' then
        raise exception 'draft % is missing a GRIP export string, cannot publish', v_sequence_id;
      end if;
    end if;
  end loop;

  foreach v_sequence_id in array p_sequence_ids
  loop
    select grip_string, raw_steps, hero_talent, content_type, step_function,
           grip_version, talent_string, warcraftlogs_url, performance_notes,
           collection_sequences
    into v_grip_string, v_raw_steps, v_hero_talent, v_content_type, v_step_function,
         v_grip_version, v_talent_string, v_warcraftlogs_url, v_performance_notes,
         v_collection_sequences
    from public.sequences
    where id = v_sequence_id;

    if v_collection_sequences is not null then
      update public.sequences
      set status = 'published'
      where id = v_sequence_id;

      v_results := v_results || json_build_object(
        'sequence_id', v_sequence_id,
        'version_id', null
      );
    else
      insert into public.sequence_versions (
        sequence_id, author_id, version_number, version_label,
        grip_string, raw_steps, changelog,
        hero_talent, content_type, step_function, grip_version,
        talent_string, warcraftlogs_url, performance_notes
      ) values (
        v_sequence_id, p_author_id, 1, '1.0',
        v_grip_string, v_raw_steps, p_changelog,
        v_hero_talent, v_content_type, v_step_function, v_grip_version,
        v_talent_string, v_warcraftlogs_url, v_performance_notes
      )
      returning id into v_version_id;

      update public.sequences
      set current_version_id = v_version_id,
          current_version_label = '1.0',
          status = 'published'
      where id = v_sequence_id;

      v_results := v_results || json_build_object(
        'sequence_id', v_sequence_id,
        'version_id', v_version_id
      );
    end if;
  end loop;

  return json_build_object(
    'published_count', array_length(p_sequence_ids, 1),
    'results', array_to_json(v_results)
  );
end;
$function$;

-- ============================================================
-- NOTE: what this migration deliberately does NOT capture
-- ============================================================
-- This was built from information_schema.columns, pg_policies, and
-- pg_get_functiondef queries run manually this session, not from a real
-- `supabase db pull` diff (Docker unavailable). It has NOT been verified
-- against:
--   - foreign key constraints (e.g. sequences.author_id -> profiles.id)
--   - indexes
--   - trigger BINDINGS (this file defines the trigger FUNCTIONS above --
--     e.g. update_sequence_rating() -- but not the `create trigger ...`
--     statements that attach them to specific tables/events, since those
--     weren't queried this session)
--   - check constraints beyond what's visible in column defaults
--   - sequences.author_id / notifications.user_id etc. as actual FK
--     relationships vs. plain uuid columns (columns are typed uuid here,
--     matching information_schema exactly, but referential integrity
--     enforcement wasn't confirmed)
-- Treat this as a strong best-effort snapshot for reproducibility and
-- policy review, not a byte-perfect schema dump. Re-run `supabase db pull`
-- for a CLI-verified diff once Docker Desktop is available, and reconcile
-- any differences it surfaces against this file.
