-- 009_username_onboarding_gate_wiring.sql
--
-- Wires has_completed_onboarding() (see 008_username_onboarding_infrastructure.sql)
-- into every content-write path: comments, ratings, sequence inserts, and
-- all sequence-related RPC functions. Applied live via Supabase MCP on
-- 2026-08-05; this brings local migrations back in sync with that session
-- (versions 20260805175606 through 20260805181547 in the live migration
-- history).
--
-- Audited via a query against pg_proc for every SECURITY DEFINER function
-- touching sequences/comments/ratings, to confirm no write path was missed.
-- Internal bookkeeping functions (increment_view_count, notify_on_comment,
-- notify_on_rating, update_comment_count, update_sequence_rating) are
-- deliberately NOT gated -- they aren't user-initiated posting actions.

-- ============================================================
-- RLS policies
-- ============================================================

drop policy if exists "Authenticated users can comment" on public.comments;
drop policy if exists "Verified authors with custom username can comment" on public.comments;
create policy "Onboarded verified authors can comment"
on public.comments
for insert
with check (
  auth.uid() = author_id
  and public.is_verified_poster(author_id)
  and public.has_completed_onboarding(author_id)
);

drop policy if exists "Authenticated users can rate" on public.ratings;
drop policy if exists "Verified authors with custom username can rate" on public.ratings;
create policy "Onboarded verified authors can rate"
on public.ratings
for insert
with check (
  auth.uid() = user_id
  and public.is_verified_poster(user_id)
  and public.has_completed_onboarding(user_id)
);

drop policy if exists "Verified authors can insert their own sequences" on public.sequences;
drop policy if exists "Verified authors with custom username can insert sequences" on public.sequences;
create policy "Onboarded verified authors can insert sequences"
on public.sequences
for insert
with check (
  auth.uid() = author_id
  and is_verified_poster(author_id)
  and public.has_completed_onboarding(author_id)
  and check_post_rate_limit(author_id)
);

-- ============================================================
-- RPC functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_draft_sequence(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false, p_collection_sequences text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_sequence_id uuid;
  v_raw_steps jsonb;
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

CREATE OR REPLACE FUNCTION public.create_sequence_with_version(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_sequence_id uuid;
  v_version_id uuid;
  v_raw_steps jsonb;
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

CREATE OR REPLACE FUNCTION public.publish_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_changelog text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;
  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;
  if not public.check_post_rate_limit(p_author_id) then
    raise exception 'posting rate limit reached, please try again later';
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

CREATE OR REPLACE FUNCTION public.publish_draft_sequences_batch(p_sequence_ids uuid[], p_author_id uuid, p_changelog text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;

  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;

  if not public.check_post_rate_limit(p_author_id) then
    raise exception 'posting rate limit reached, please try again later';
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

CREATE OR REPLACE FUNCTION public.publish_sequence_version(p_sequence_id uuid, p_version_number integer, p_version_label text, p_grip_string text, p_raw_steps jsonb, p_changelog text, p_author_id uuid, p_hero_talent text, p_content_type text, p_step_function text, p_grip_version text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.update_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_raw_steps jsonb;
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

CREATE OR REPLACE FUNCTION public.update_sequence_metadata(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
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

CREATE OR REPLACE FUNCTION public.update_sequence_with_version(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
