-- 026_search_path_hardening_and_rate_limit_ownership.sql
--
-- Two small fixes from the 2026-09-09 audit (SECURITY_AUDIT_2026-09-09.md),
-- both flagged there as cheap and worth doing rather than left open.
--
-- ============================================================
-- PART 1: search_path hardening
-- ============================================================
-- Migration 025's DROP+CREATE (required because adding p_actions as a new
-- parameter would otherwise define a second overload instead of replacing
-- the first) recreated six functions without carrying forward a `SET
-- search_path` pin, and create_draft_sequence never had one. The Supabase
-- advisor flags all 7 as function_search_path_mutable. Not exploitable
-- today -- nobody but the postgres role can create objects in the public
-- schema on this project, so there's no attacker-controlled object for a
-- mutable search_path to resolve to -- but it's the standard hardening for
-- any SECURITY DEFINER function and costs nothing to apply.
alter function public.create_draft_sequence(uuid, text, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, boolean, text, text, text) set search_path = public, pg_temp;
alter function public.create_sequence_with_version(uuid, text, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, text, boolean, text, text) set search_path = public, pg_temp;
alter function public.update_sequence_with_version(uuid, uuid, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, text, text) set search_path = public, pg_temp;
-- CORRECTED 2026-09-19. These two alters carried the FAILED FIRST DRAFT of this
-- migration, not the version that ran. Per @slowdog-dev reading the Postgres logs for
-- 2026-09-09: a first attempt at 17:48:06 used these 23-argument signatures and errored
-- 12ms later with "function ... does not exist", because production was at 22 arguments,
-- matching what 025 created eight days earlier. The statement was inside one
-- begin/commit, so the whole transaction aborted and nothing was written to
-- schema_migrations. A second attempt at 17:48:25 used named parameters at the correct
-- 22 arguments, succeeded, and is the one recorded as version 20260909174825. The text
-- below is that recorded version. The logs are not readable from this side, so the
-- account is his; what IS verifiable here is that 025 creates both at 22 and that all
-- seven alters in this file now match the arity of the last CREATE before them.
alter function public.update_sequence_metadata(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text, p_wow_build text, p_actions text) set search_path = public, pg_temp;
alter function public.update_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text, p_wow_build text, p_actions text) set search_path = public, pg_temp;
alter function public.publish_draft_sequence(uuid, uuid, text, text) set search_path = public, pg_temp;
alter function public.publish_draft_sequences_batch(uuid[], uuid, text) set search_path = public, pg_temp;

-- ============================================================
-- PART 2: check_post_rate_limit ownership check
-- ============================================================
-- Migration 022 (2026-08-19) closed the live, exploitable half of this --
-- unauthenticated callers could invoke this against any UUID -- but left an
-- explicit, documented residual: any AUTHENTICATED account could still call
-- check_post_rate_limit(<someone else's uuid>) directly, which unconditionally
-- inserts a post_rate_throttle row and can push another account toward its
-- rate limit. Every legitimate caller already checks p_author_id = auth.uid()
-- before calling this, so the added check below changes nothing for them --
-- it only stops a caller from ever invoking it against an id that isn't
-- their own. A mismatched call becomes a no-op (returns true, same as "not
-- rate limited yet") rather than an insert against someone else's row.
create or replace function public.check_post_rate_limit(check_author_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_age interval;
  v_recent_count integer;
  v_daily_count integer;
begin
  -- Added 2026-09-09: refuse to act on any id that isn't the caller's own,
  -- rather than throttling/inserting against a row the caller doesn't
  -- control. Every real caller (create_sequence_with_version,
  -- publish_draft_sequence, publish_draft_sequences_batch) already verifies
  -- p_author_id = auth.uid() before reaching this function, so this can
  -- only ever refuse a call that had no business happening.
  if check_author_id is distinct from auth.uid() then
    return true;
  end if;

  select now() - created_at into v_account_age
  from auth.users
  where id = check_author_id;

  -- Accounts 7+ days old are not throttled by this function.
  if v_account_age is null or v_account_age >= interval '7 days' then
    return true;
  end if;

  select count(*) into v_recent_count
  from public.post_rate_throttle
  where author_id = check_author_id
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 1 then
    return false;
  end if;

  select count(*) into v_daily_count
  from public.post_rate_throttle
  where author_id = check_author_id
    and created_at > now() - interval '1 day';

  if v_daily_count >= 3 then
    return false;
  end if;

  insert into public.post_rate_throttle (author_id, created_at)
  values (check_author_id, now());

  return true;
end;
$$;

revoke all on function public.check_post_rate_limit(uuid) from public, anon;
grant execute on function public.check_post_rate_limit(uuid) to authenticated;
