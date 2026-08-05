-- 005: security definer ownership checks + notifications insert policy
--
-- Captures fixes from Slowdog's 2026-07-21 live security pass that were never
-- committed to a migration.
--
-- delete_sequence_version and update_sequence_metadata both verified that the
-- target sequence belonged to the caller-supplied p_author_id, but never
-- verified the caller's own auth.uid() matched p_author_id -- so a caller
-- could pass someone else's real author_id (visible on any public sequence)
-- and pass the check. create_sequence_with_version, publish_sequence_version,
-- create_draft_sequence, update_draft_sequence, publish_draft_sequence and
-- publish_draft_sequences_batch already carry the auth.uid() ownership check
-- (see 002_schema_sync.sql); these two predate the draft/publish system and
-- never inherited it. Already fixed live; this migration captures that fix in
-- source control so a fresh environment matches production.
--
-- The notifications INSERT policy only checked auth.uid() is not null, no
-- ownership tie. Every real insert goes through SECURITY DEFINER trigger
-- functions (notify_on_comment, notify_on_rating), which bypass RLS, so the
-- policy was dropped outright rather than tightened.

create or replace function public.delete_sequence_version(p_version_id uuid, p_sequence_id uuid, p_author_id uuid)
returns void
language plpgsql
security definer
as $function$
declare
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

drop policy if exists "Users can insert notifications" on public.notifications;
