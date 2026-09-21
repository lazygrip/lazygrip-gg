-- 042_publish_reslug_retry_on_collision.sql
--
-- WHAT THIS FIXES
--
-- 016_publish_reslug.sql added slug reminting on the draft-to-published
-- transition and made a deliberate choice in its collision handler: if the
-- title-derived slug collides with an existing row's slug, keep whatever
-- slug the row already had and let the publish through anyway, reasoning
-- "a publish must never fail because a URL was taken."
--
-- That reasoning is still right. The bug is in what "keep the existing slug"
-- means when it fires. It does not retry with a different tail, does not
-- log, and returns nothing telling the caller reminting did not happen. The
-- row ends up published under the CORRECT title and the WRONG title's URL,
-- silently, with the only signal anywhere being a human noticing the
-- mismatch by eye.
--
-- Observed 2026-09-21 in the grip-ems Discord: mfd00m published a
-- Retribution Paladin sequence that landed at
-- /sequences/1210-mfdoom-protection-paladin-msurfgpf -- title correct in the
-- embed, slug carrying a different spec's text. sirsataana had to ping
-- Slowdog asking for the right URL. mfd00m's own reaction, "oh that bug
-- happened again lol," reads as a repeat, not a first occurrence, though
-- this repo has no earlier record of it being diagnosed. Root cause is
-- reconstructed from the code rather than from a DB read of that specific
-- draft's history, so treat the general mechanism below as confirmed and the
-- claim that this exact mechanism is what produced mfd00m's two rows as the
-- best available explanation, not a verified one.
--
-- THE FIX. On a unique_violation, do not give up on the first try. Strip the
-- reused tail off the candidate slug and mint a fresh one, then retry, up to
-- a small bounded number of attempts. Reusing the SAME tail that just
-- collided (016's original code did not even do that -- it reused the tail
-- but never retried with it, so a collision meant zero further attempts)
-- would collide again identically forever; a fresh tail per attempt does
-- not. Only after every attempt collides does this fall back to 016's
-- original guarantee and let the publish through on the slug the row
-- already had -- which the birthday-paradox math on a random base36 tail
-- makes vanishingly unlikely to ever be reached.
--
-- Signature is unchanged (uuid, uuid, text, text), so this supersedes
-- 019_wow_build_and_export_backfill.sql's definition (the latest full body,
-- 016's own text having been superseded there) in place. No DROP needed,
-- same reasoning 019 gave: this function takes no version parameters, it
-- reads columns off the sequences row rather than accepting them as
-- arguments, so there is no second overload to strand.
--
-- SEARCH_PATH IS CARRIED FORWARD DELIBERATELY. 019's CREATE OR REPLACE did
-- not set one; 026_search_path_hardening_and_rate_limit_ownership.sql pinned
-- it afterward with a bare ALTER FUNCTION ... SET search_path, which does
-- not touch the function body. CREATE OR REPLACE replaces the ENTIRE
-- definition including config parameters, so omitting SET search_path here
-- would silently drop 026's hardening the moment this file applies. It is
-- included below for that reason, not because this function was written
-- with it from the start.

create or replace function public.publish_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_changelog text default null::text, p_slug text default null::text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
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
  v_wow_build text;
  v_talent_string text;
  v_warcraftlogs_url text;
  v_performance_notes text;
  v_title text;
  v_class_id integer;
  v_collection_sequences jsonb;
  v_base_slug text;
  v_stripped_slug text;
  v_candidate_slug text;
  v_attempt integer;
  v_max_attempts constant integer := 5;
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
         content_type, step_function, grip_version, wow_build, talent_string,
         warcraftlogs_url, performance_notes, title, class_id,
         collection_sequences
  into v_status, v_owner, v_grip_string, v_raw_steps, v_hero_talent,
       v_content_type, v_step_function, v_grip_version, v_wow_build, v_talent_string,
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

  -- WAS: one attempt, swallow unique_violation, keep whatever slug the row
  -- already had, unconditionally, even though that slug can belong to a
  -- completely different title. NOW: strip a trailing base36 tail (6-10
  -- chars, matching the pattern post/page.tsx mints client-side) so each
  -- retry can mint its own fresh one instead of colliding on the same tail
  -- again. If p_slug does not end in a recognisable tail, use it whole as
  -- the base rather than mangling it.
  if p_slug is not null and btrim(p_slug) <> '' then
    v_base_slug := btrim(p_slug);
    v_stripped_slug := regexp_replace(v_base_slug, '-[0-9a-z]{6,10}$', '');
    if v_stripped_slug <> '' and v_stripped_slug <> v_base_slug then
      v_base_slug := v_stripped_slug;
    end if;

    v_attempt := 0;
    loop
      v_attempt := v_attempt + 1;

      -- First attempt uses p_slug exactly as given (the common case: no
      -- collision, no need to touch the tail the client already minted).
      -- Only a retry after a real collision mints a new one.
      if v_attempt = 1 then
        v_candidate_slug := btrim(p_slug);
      else
        v_candidate_slug := v_base_slug || '-' ||
          lower(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)) ||
          lower(to_hex((random() * 1679616)::int));
      end if;

      begin
        update public.sequences
        set slug = v_candidate_slug
        where id = p_sequence_id and slug is distinct from v_candidate_slug;
        exit;
      exception when unique_violation then
        if v_attempt >= v_max_attempts then
          -- Every attempt collided. Fall back to 016's original guarantee --
          -- a publish must never fail over a URL -- and let it through on
          -- whatever slug the row already had.
          exit;
        end if;
        -- loop again with a freshly minted candidate
      end;
    end loop;
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
    talent_string, warcraftlogs_url, performance_notes,
    wow_build
  ) values (
    p_sequence_id, p_author_id, 1, '1.0',
    v_grip_string, v_raw_steps, p_changelog,
    v_hero_talent, v_content_type, v_step_function, v_grip_version,
    v_talent_string, v_warcraftlogs_url, v_performance_notes,
    v_wow_build
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

comment on function public.publish_draft_sequence(uuid, uuid, text, text) is
  'Moves a caller-owned draft sequence to published, creating its first sequence_versions row. Reslugs from the real title on this transition only (016), and now RETRIES with a freshly minted tail on a slug collision instead of silently keeping a stale slug from a different title (042) -- see 042''s header for the mfd00m/Protection-Paladin-URL/Retribution-Paladin-title case that exposed the original single-attempt swallow.';
