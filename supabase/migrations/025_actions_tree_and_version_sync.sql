-- 025_actions_tree_and_version_sync.sql
--
-- Two independent fixes shipped together because both required editing the
-- same six RPCs, and reasoning about them separately would have meant two
-- read-throughs of the same function bodies for no benefit.
--
-- ============================================================
-- PART 1: actions jsonb column (Beard3d's loop-flattening report)
-- ============================================================
--
-- raw_steps (on both public.sequences and public.sequence_versions) is a flat
-- jsonb array of {index, text, char_count}. It has never carried loop/repeat
-- structure. The decoder (src/lib/workshop/emsDecoder.ts) already produces a
-- proper hierarchical tree -- normalizeGripActions() returns nodes with
-- kind: 'Loop' | 'Action' | 'If' | ..., a real `repeat` count, and nested
-- `children` -- and that tree already reaches the browser on every decode via
-- /api/decode-grip. It was never written to the database: src/app/post/page.tsx
-- only read the flat `.steps` output and mapped it down to
-- {index, text, char_count} before insert, dropping the tree on the floor.
--
-- Net effect, confirmed against live rows on 2026-09-01: a sequence built
-- from a Loop with Repeat=3 displays on the public sequence page as one flat,
-- unlabeled pass through the loop's steps. Reported by Beard3d.
--
-- Columns were already added in migration 025_actions_tree_column.sql
-- (ALTER TABLE ... ADD COLUMN IF NOT EXISTS actions jsonb, both tables). This
-- migration adds p_actions to every RPC that writes raw_steps, so newly
-- published or edited sequences populate it. Nullable and additive throughout
-- -- old rows keep raw_steps as their only representation, the display layer
-- falls back to the flat renderer for them, no backfill is attempted because
-- the tree can't be reconstructed from raw_steps alone.
--
-- ============================================================
-- PART 2: sequences <-> sequence_versions drift (021, never applied + a
-- second drift source found in publish_sequence_version)
-- ============================================================
--
-- supabase/migrations/021_version_row_macro_parity.sql documents a real drift
-- between public.sequences and its current_version_id row: update_sequence_metadata
-- wrote grip_string/raw_steps to the sequences row but not to the matching
-- sequence_versions row, so a "minor edit" changing the macro left the version
-- row (which the sequence page reads when that version is selected) holding
-- the PREVIOUS export. That file's own header measured 19 published rows
-- affected as of 2026-08-14 and proposed a fix + backfill.
--
-- CONFIRMED ON 2026-09-01: 021 was never actually applied. It exists as a
-- file in supabase/migrations/ but supabase_migrations.schema_migrations has
-- no record of it running, and the live update_sequence_metadata function
-- still lacks the mirror lines the file describes adding. The drift has
-- continued to grow since the file was written: 16 grip_string / 21 raw_steps
-- disagreements now (vs 10 / 18 measured in the file), because every edit
-- since then has continued drifting.
--
-- A SECOND, separate drift source was found in this same audit:
-- publish_sequence_version (the "add a new version" RPC, called from
-- src/app/sequences/[slug]/update/page.tsx) inserts the new grip_string/
-- raw_steps into sequence_versions correctly, then updates sequences to
-- point current_version_id at the new row, but never copies grip_string/
-- raw_steps onto the sequences row itself. So publishing a brand new version
-- leaves the PARENT row's raw_steps stuck on whatever the previous version
-- had, immediately upon creation, not just after a later edit. This explains
-- why src/app/sequences/[slug]/SequencePageClient.tsx line 729
-- (`sequence.raw_steps`, read regardless of which version tab is selected --
-- a separate app-layer bug fixed alongside this migration) was showing wrong
-- step data for older versions of a real published sequence with 8 versions
-- (checked directly: v1-v6 genuinely differ in step content and count from
-- v8/current, 4 to 10 steps across versions).
--
-- Both are fixed the same way 021 proposed: the sequences row and its current
-- version row must always agree, so every function that writes one now
-- writes both. update_draft_sequence is NOT touched for this half -- drafts
-- have no version row yet, nothing to mirror.
--
-- WHY DROP FUNCTION IS REQUIRED HERE, not just CREATE OR REPLACE: p_actions
-- is a new parameter on every function below. CREATE OR REPLACE matches on
-- the argument list, so a new parameter defines a SECOND overload rather than
-- replacing the first -- both go live, and callers then fail to resolve with
-- "function is not unique" from Postgres and PGRST203 from PostgREST. This
-- exact failure mode is already documented in this repo's own migration
-- history (021's header, referencing 019). Every function below is dropped
-- by its current signature before being recreated.

-- ============================================================
-- 1. create_sequence_with_version
-- ============================================================

DROP FUNCTION IF EXISTS public.create_sequence_with_version(uuid, text, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, text, boolean, text);

CREATE OR REPLACE FUNCTION public.create_sequence_with_version(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false, p_wow_build text DEFAULT NULL::text, p_actions text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_sequence_id uuid;
  v_version_id uuid;
  v_raw_steps jsonb;
  v_actions jsonb;
  v_attribution_acknowledged_at timestamptz;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;

  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;

  if not public.check_post_rate_limit(p_author_id) then
    raise exception 'posting rate limit reached, please try again later';
  end if;

  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;

  if p_actions is null then
    v_actions := null;
  else
    v_actions := p_actions::jsonb;
  end if;

  v_attribution_acknowledged_at := case when p_attribution_acknowledged then now() else null end;

  insert into public.sequences (
    author_id, title, slug, description,
    class_id, class_name, spec_id, spec_name,
    content_type, hero_talent, patch_version, grip_version,
    step_function, step_count, grip_string, raw_steps, actions,
    talent_string, warcraftlogs_url, performance_notes,
    original_author, attribution_acknowledged_at,
    wow_build,
    status
  ) values (
    p_author_id, p_title, p_slug, p_description,
    p_class_id, p_class_name, p_spec_id, p_spec_name,
    p_content_type, p_hero_talent, p_patch_version, p_grip_version,
    p_step_function, p_step_count, p_grip_string, v_raw_steps, v_actions,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_original_author, v_attribution_acknowledged_at,
    p_wow_build,
    'published'
  )
  returning id into v_sequence_id;

  insert into public.sequence_versions (
    sequence_id, author_id, version_number, version_label,
    grip_string, raw_steps, actions, changelog,
    hero_talent, content_type, step_function, grip_version,
    talent_string, warcraftlogs_url, performance_notes,
    wow_build
  ) values (
    v_sequence_id, p_author_id, 1, '1.0',
    p_grip_string, v_raw_steps, v_actions, p_changelog,
    p_hero_talent, p_content_type, p_step_function, p_grip_version,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_wow_build
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

-- ============================================================
-- 2. update_sequence_with_version ("Major edit" -- creates a new version row)
-- ============================================================

DROP FUNCTION IF EXISTS public.update_sequence_with_version(uuid, uuid, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_sequence_with_version(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text, p_wow_build text DEFAULT NULL::text, p_actions text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_version_id uuid;
  v_raw_steps jsonb;
  v_actions jsonb;
  v_next_version_number integer;
  v_version_label text;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  if not exists (
    select 1 from public.sequences
    where id = p_sequence_id and author_id = p_author_id
  ) then
    raise exception 'Not authorised';
  end if;

  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;

  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;

  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;

  if p_actions is null then
    v_actions := null;
  else
    v_actions := p_actions::jsonb;
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
    wow_build = p_wow_build,
    step_function = p_step_function,
    step_count = p_step_count,
    grip_string = p_grip_string,
    raw_steps = v_raw_steps,
    actions = v_actions,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes
  where id = p_sequence_id;

  insert into public.sequence_versions (
    sequence_id, author_id, version_number, version_label,
    grip_string, raw_steps, actions, changelog,
    hero_talent, content_type, step_function, grip_version,
    talent_string, warcraftlogs_url, performance_notes,
    wow_build
  ) values (
    p_sequence_id, p_author_id, v_next_version_number, v_version_label,
    p_grip_string, v_raw_steps, v_actions, p_changelog,
    p_hero_talent, p_content_type, p_step_function, p_grip_version,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_wow_build
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

-- ============================================================
-- 3. update_sequence_metadata ("Minor edit" -- updates in place, no new version row)
--
-- THIS IS THE FUNCTION 021 DOCUMENTED FIXING BUT NEVER ACTUALLY SHIPPED.
-- The two mirror lines (raw_steps, grip_string onto the current version row)
-- are applied here for real, alongside actions and the same mirror.
-- ============================================================

DROP FUNCTION IF EXISTS public.update_sequence_metadata(uuid, uuid, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_sequence_metadata(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text DEFAULT NULL::text, p_wow_build text DEFAULT NULL::text, p_actions text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_raw_steps jsonb;
  v_actions jsonb;
  v_collection_sequences jsonb;
  v_current_version_id uuid;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

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

  if p_actions is null then
    v_actions := null;
  else
    v_actions := p_actions::jsonb;
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
    wow_build = p_wow_build,
    step_function = p_step_function,
    step_count = p_step_count,
    grip_string = p_grip_string,
    raw_steps = v_raw_steps,
    actions = v_actions,
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
      wow_build = p_wow_build,
      talent_string = p_talent_string,
      warcraftlogs_url = p_warcraftlogs_url,
      performance_notes = p_performance_notes,
      -- THE TWO LINES 021 DOCUMENTED AND NEVER SHIPPED, now actually applied,
      -- plus actions. Unconditional, not coalesced -- see 021's own comment
      -- for why: a null reaching sequences must reach the version row too, or
      -- the two agree on every value except the absence of one.
      grip_string = p_grip_string,
      raw_steps = v_raw_steps,
      actions = v_actions
    where id = v_current_version_id;
  end if;
end;
$function$;

-- ============================================================
-- 4. create_draft_sequence -- p_actions only, no version-row mirror (drafts
-- have no version row yet)
-- ============================================================

DROP FUNCTION IF EXISTS public.create_draft_sequence(uuid, text, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, boolean, text, text);

CREATE OR REPLACE FUNCTION public.create_draft_sequence(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false, p_collection_sequences text DEFAULT NULL::text, p_wow_build text DEFAULT NULL::text, p_actions text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_sequence_id uuid;
  v_raw_steps jsonb;
  v_actions jsonb;
  v_collection_sequences jsonb;
  v_attribution_acknowledged_at timestamptz;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;
  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;
  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;
  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;
  if p_actions is null then
    v_actions := null;
  else
    v_actions := p_actions::jsonb;
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
    step_function, step_count, grip_string, raw_steps, actions,
    talent_string, warcraftlogs_url, performance_notes,
    original_author, attribution_acknowledged_at,
    collection_sequences,
    wow_build,
    status
  ) values (
    p_author_id, p_title, p_slug, p_description,
    p_class_id, p_class_name, p_spec_id, p_spec_name,
    p_content_type, p_hero_talent, p_patch_version, p_grip_version,
    p_step_function, p_step_count, p_grip_string, v_raw_steps, v_actions,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_original_author, v_attribution_acknowledged_at,
    v_collection_sequences,
    p_wow_build,
    'draft'
  )
  returning id into v_sequence_id;
  return json_build_object(
    'sequence_id', v_sequence_id,
    'slug', p_slug
  );
end;
$function$;

-- ============================================================
-- 5. update_draft_sequence -- p_actions only, same reasoning as 4
-- ============================================================

DROP FUNCTION IF EXISTS public.update_draft_sequence(uuid, uuid, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text DEFAULT NULL::text, p_wow_build text DEFAULT NULL::text, p_actions text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_raw_steps jsonb;
  v_actions jsonb;
  v_collection_sequences jsonb;
  v_status sequence_status;
  v_owner uuid;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;
  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
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
  if p_actions is null then
    v_actions := null;
  else
    v_actions := p_actions::jsonb;
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
    wow_build = p_wow_build,
    step_function = p_step_function,
    step_count = p_step_count,
    grip_string = p_grip_string,
    raw_steps = v_raw_steps,
    actions = v_actions,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes,
    collection_sequences = coalesce(v_collection_sequences, collection_sequences),
    updated_at = now()
  where id = p_sequence_id;
  return json_build_object('sequence_id', p_sequence_id);
end;
$function$;

-- ============================================================
-- 6. publish_sequence_version -- the SECOND drift source found in this audit.
-- Adds p_actions AND fixes the sequences-row mirror that was never there:
-- previously this function updated sequences' metadata columns on publish
-- but never grip_string/raw_steps/actions, leaving the parent row stuck on
-- the PREVIOUS version's export/steps the moment a new version was created,
-- not just after a later edit.
-- ============================================================

DROP FUNCTION IF EXISTS public.publish_sequence_version(uuid, integer, text, text, jsonb, text, uuid, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.publish_sequence_version(p_sequence_id uuid, p_version_number integer, p_version_label text, p_grip_string text, p_raw_steps jsonb, p_changelog text, p_author_id uuid, p_hero_talent text, p_content_type text, p_step_function text, p_grip_version text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_actions jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new_version_id uuid;
  v_owner uuid;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;

  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
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
    actions,
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
    p_actions,
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
    -- THE MIRROR THAT WAS MISSING. Without these three, the parent row's
    -- export/steps stayed on the OLD version from the moment this insert
    -- ran, and any reader of the parent row (rather than the version row
    -- directly) saw stale data immediately, before any later edit.
    grip_string = p_grip_string,
    raw_steps = p_raw_steps,
    actions = p_actions,
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

-- ============================================================
-- 7. Backfill: sync every published row's current version to match its
-- sequences row, for the drift that already exists. Same shape as 021's
-- proposed backfill (which never ran), extended to cover actions too
-- (null-safe: rows with no actions data simply copy null onto null).
--
-- IDEMPOTENT: a second run finds every current version row already equal to
-- its sequence and writes the same values again.
--
-- SCOPE: touches only the row named by sequences.current_version_id. Every
-- earlier version row is untouched. Published sequences only -- a draft has
-- no version row to disagree with.
-- ============================================================

update public.sequence_versions sv set
  grip_string = s.grip_string,
  raw_steps = s.raw_steps,
  actions = s.actions
from public.sequences s
where sv.id = s.current_version_id
  and s.status = 'published'
  and (sv.grip_string is distinct from s.grip_string
       or sv.raw_steps is distinct from s.raw_steps
       or sv.actions is distinct from s.actions);
