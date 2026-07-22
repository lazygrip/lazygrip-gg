-- Migration 005: Add missing ownership check to update_sequence_with_version
--
-- Context: update_sequence_with_version checked that p_sequence_id belonged
-- to p_author_id, but never checked that the authenticated caller's
-- auth.uid() actually matched p_author_id. Since both sequence_id and
-- author_id are visible on any public sequence page, any logged-in user
-- could call this RPC with someone else's sequence_id + real author_id and
-- overwrite that sequence's live content, attributed to the real author,
-- as the new current version. Full defacement of another user's published
-- sequence.
--
-- This mirrors the same fix already applied to delete_sequence_version and
-- update_sequence_metadata. Reported by Sataana (private disclosure,
-- 2026-07-22), applied live same day, captured here to bring the repo back
-- in sync with the live database. No other behavior of the function
-- changes.

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
