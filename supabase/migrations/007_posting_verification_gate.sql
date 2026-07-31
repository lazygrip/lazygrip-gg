-- 007: Posting verification gate
--
-- Trigger: an unverified Battle.net account (auth never completed, no
-- confirmed email, no display_name) published a low-effort, taunting
-- sequence through the normal posting flow. The existing RLS/RPC layer only
-- checked "are you signed in as yourself" (auth.uid() = author_id) -- correct
-- and sufficient for the spoofed-ownership bug class covered by
-- SECURITY_AUDIT_2026-07-22.md, but not for an authenticated-but-illegitimate
-- account posting at all.
--
-- Everything in this file was run directly against the live database on
-- 2026-07-31 via the Supabase SQL Editor. This migration exists to make that
-- reproducible from a fresh clone -- it was not previously captured as a
-- migration file, only applied live. See SECURITY_AUDIT_2026-07-31.md for
-- the full writeup, including the publish_draft_sequences_batch gap found
-- and closed the same session.

-- ============================================================
-- is_verified_poster
-- Checks ELIGIBILITY of a target account to post at all: display_name is
-- set, auth is fully completed (confirmed email OR completed OAuth
-- sign-in), and the account is older than 60 minutes. Side-effect-free.
-- Different pattern from the ownership check (auth.uid() = p_author_id)
-- already present in every function below -- this checks whether that
-- already-authenticated caller is *eligible*, not whether they're lying
-- about who they are.
-- ============================================================
create or replace function public.is_verified_poster(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    -- display name must be set and non-empty
    exists (
      select 1 from public.profiles p
      where p.id = check_user_id
        and p.display_name is not null
        and length(trim(p.display_name)) > 0
    )
    and
    -- auth must be fully completed: confirmed email OR a completed OAuth sign-in
    exists (
      select 1 from auth.users u
      where u.id = check_user_id
        and (u.email_confirmed_at is not null or u.last_sign_in_at is not null)
    )
    and
    -- account must be at least 60 minutes old
    exists (
      select 1 from auth.users u
      where u.id = check_user_id
        and u.created_at < now() - interval '60 minutes'
    );
$$;

-- ============================================================
-- post_rate_throttle + check_post_rate_limit
-- Same shape as the existing view_count_throttle pattern (migration
-- 006_view_count_anon_rate_limit.sql): a dedicated RLS-locked table, a
-- SECURITY DEFINER function does the counting/checking, self-prunes old
-- rows probabilistically. Keys on author_id rather than IP, since posting
-- requires auth anyway. 1 post/hour and 3/day for accounts under 7 days
-- old; no limit once an account clears a week.
-- ============================================================
create table if not exists public.post_rate_throttle (
  author_id uuid not null,
  posted_at timestamptz not null default now()
);

create index if not exists post_rate_throttle_author_idx
  on public.post_rate_throttle (author_id, posted_at);

alter table public.post_rate_throttle enable row level security;
-- No policies defined -- same pattern as view_count_throttle: reachable
-- only from inside this SECURITY DEFINER function, never directly by
-- anon/authenticated PostgREST clients.

create or replace function public.check_post_rate_limit(check_author_id uuid)
returns boolean
language plpgsql
security definer
as $function$
declare
  v_account_age interval;
  v_recent_count integer;
  v_daily_count integer;
  v_limit_hourly integer := 1;
  v_limit_daily integer := 3;
begin
  select now() - u.created_at into v_account_age
  from auth.users u where u.id = check_author_id;

  -- accounts under 7 days old get tighter limits
  if v_account_age is not null and v_account_age < interval '7 days' then
    select count(*) into v_recent_count
    from public.post_rate_throttle
    where author_id = check_author_id
      and posted_at > now() - interval '1 hour';

    if v_recent_count >= v_limit_hourly then
      return false;
    end if;

    select count(*) into v_daily_count
    from public.post_rate_throttle
    where author_id = check_author_id
      and posted_at > now() - interval '1 day';

    if v_daily_count >= v_limit_daily then
      return false;
    end if;
  end if;

  insert into public.post_rate_throttle (author_id, posted_at)
  values (check_author_id, now());

  if random() < 0.01 then
    delete from public.post_rate_throttle where posted_at < now() - interval '30 days';
  end if;

  return true;
end;
$function$;

-- ============================================================
-- Wire the gate into every real posting path.
--
-- create_draft_sequence: verification only (drafts aren't public yet, no
-- rate-limit needed until something actually publishes).
--
-- create_sequence_with_version, publish_draft_sequence,
-- publish_draft_sequences_batch: verification + rate limit, since these
-- publish immediately or flip a draft to published.
--
-- Deliberately NOT touched: publish_sequence_version (publishes a new
-- version of already-published content -- already passed the gate once),
-- update_draft_sequence, update_sequence_metadata,
-- update_sequence_with_version, delete_sequence_version (only ever touch
-- content the caller already owns -- gating these would retroactively lock
-- out existing users who are missing a display_name from editing their own
-- work, which is exactly the breakage the grandfathering decision in
-- SECURITY_AUDIT_2026-07-31.md was meant to avoid).
-- ============================================================

create or replace function public.create_draft_sequence(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false, p_collection_sequences text DEFAULT NULL::text)
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

create or replace function public.create_sequence_with_version(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false)
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

create or replace function public.publish_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_changelog text DEFAULT NULL::text)
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

  -- Collection drafts: at least one sequence in the collection is required
  -- instead of a single grip_string. Matches the existing collection
  -- publish path's own check (collectionSequences.filter(checked).length === 0).
  if v_collection_sequences is not null then
    if jsonb_array_length(v_collection_sequences) = 0 then
      raise exception 'collection draft has no sequences, cannot publish';
    end if;

    -- Collections have never used sequence_versions -- the existing direct
    -- publish path (raw insert) doesn't create one either. Publishing a
    -- collection draft just flips status, nothing more.
    update public.sequences
    set status = 'published'
    where id = p_sequence_id;

    return json_build_object(
      'sequence_id', p_sequence_id,
      'version_id', null
    );
  end if;

  -- Single-sequence drafts: existing behavior, unchanged.
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

  if not public.check_post_rate_limit(p_author_id) then
    raise exception 'posting rate limit reached, please try again later';
  end if;

  if p_sequence_ids is null or array_length(p_sequence_ids, 1) is null then
    raise exception 'no sequence ids provided';
  end if;

  -- Validate every row up front, before writing anything. Same per-row
  -- branch as publish_draft_sequence: collections need at least one
  -- sequence, single-sequence drafts need title/class/grip_string.
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

  -- Validation passed for every row. Now actually publish them all.
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
      -- Collections never create a sequence_versions row, matching the
      -- existing direct-publish path.
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
-- RLS policy: defense-in-depth for the one raw .insert() path
-- (the collection-publish fallback in post/page.tsx). Every other posting
-- path above is SECURITY DEFINER and bypasses RLS on write by design --
-- Postgres does not re-check RLS inside a SECURITY DEFINER function body.
-- The real enforcement is the function bodies above; this covers the one
-- path that isn't SECURITY DEFINER.
-- ============================================================
drop policy if exists "Authors can insert their own sequences" on public.sequences;
drop policy if exists "Verified authors can insert their own sequences" on public.sequences;

create policy "Verified authors can insert their own sequences"
  on public.sequences for insert
  with check (
    auth.uid() = author_id
    and public.is_verified_poster(author_id)
    and public.check_post_rate_limit(author_id)
  );
