-- 016_publish_reslug.sql
--
-- WHY THIS EXISTS
--
-- A sequence's slug is minted once, at draft creation, by the post page's
-- autosave. That autosave fires on an 800ms debounce gated only on class and
-- content type, so it routinely runs before the author has typed a title. When
-- it does, the row is created with the title 'Untitled draft' and a slug to
-- match. The title is corrected on a later save; the slug never was. The result
-- is published pages living at /sequences/untitled-draft-<base36> with a
-- perfectly correct meta title and description above them.
--
-- This migration adds an optional p_slug to publish_draft_sequence so the
-- client can remint the slug from the real title. The remint happens ONLY on
-- the draft-to-published transition, which is the last moment the URL is still
-- nobody's bookmark. A published sequence whose title is later edited must KEEP
-- its slug -- reslugging on every title edit would break every inbound link,
-- every Discord announcement and whatever search ranking the page has earned.
--
-- The parameter is added LAST so every existing three-argument caller keeps
-- resolving to this same function with p_slug defaulting to null, which is a
-- no-op. The body is otherwise identical to the definition in
-- 009_username_onboarding_gate_wiring.sql.
--
-- No existing slug is backfilled here. The rows already published under an
-- untitled-draft URL need 301 redirects and an alias column before they can be
-- moved, and that is deliberately a separate change.
--
-- The DROP below is required, not tidying. In PostgreSQL, CREATE OR REPLACE
-- matches on the argument type list, so adding a fourth parameter defines a
-- SECOND function rather than replacing the first. Both would then be live, and
-- the existing three-argument callers (the collection publish path) would match
-- both candidates and fail to resolve -- 'function is not unique' from Postgres,
-- PGRST203 from PostgREST. Dropping the superseded three-argument signature
-- leaves exactly one function; three-argument callers keep working because
-- p_slug defaults to null, which is a no-op.

DROP FUNCTION IF EXISTS public.publish_draft_sequence(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.publish_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_changelog text DEFAULT NULL::text, p_slug text DEFAULT NULL::text)
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

  if p_slug is not null and btrim(p_slug) <> '' then
    begin
      update public.sequences
      set slug = p_slug
      where id = p_sequence_id and slug is distinct from p_slug;
    exception when unique_violation then
      -- A publish must NEVER fail because a URL was taken. Keep the
      -- existing slug and let the publish through; a stale slug is a
      -- cosmetic problem and a failed publish is not.
      null;
    end;
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
