-- 045_revoke_anon_write_grants_and_lock_throttle_tables.sql
--
-- Defense in depth found by the 2026-10-11 outside probe and a live read of
-- pg_proc and relacl. Zero behavior change on production: every path below
-- is already refused today by a function body check or by row level security,
-- this migration removes the grant underneath so a future mistake cannot
-- expose it. Nothing here touches data.
--
-- ============================================================================
-- 1. Nine write functions were executable by anon (and by PUBLIC)
-- ============================================================================
--
-- create_draft_sequence, create_sequence_with_version, delete_sequence_version,
-- publish_draft_sequence, publish_draft_sequences_batch, publish_sequence_version,
-- update_draft_sequence, update_sequence_metadata, update_sequence_with_version
-- and set_current_patch all start by checking auth.uid() and refuse a stranger
-- (the outside probe on 2026-10-11 got "author_id does not match authenticated
-- user" from delete_sequence_version). They still sat behind an EXECUTE grant
-- to anon, and six of them to PUBLIC as well. A logged out visitor has no
-- legitimate reason to call any of them, because each one requires a signed in
-- caller to pass its own check. Revoke from PUBLIC and anon, keep authenticated
-- and service_role.
--
-- NOT TOUCHED ON PURPOSE: increment_view_count, increment_copy_count and
-- bump_sequence_view_daily, which logged out visitors really do call; and the
-- trigger functions (handle_new_user, notify_on_*, update_*_count,
-- record_profile_username_alias), whose revoke should be tested on a branch
-- first because handle_new_user sits behind signups.
--
-- ============================================================================
-- 2. Three throttle tables were fully granted to anon and authenticated
-- ============================================================================
--
-- comment_rate_throttle was locked down in 037 (revoke all from public, anon,
-- authenticated). copy_count_throttle, post_rate_throttle and view_count_throttle
-- were not, so anon held SELECT, INSERT, UPDATE and DELETE on them, held back
-- only by row level security with no policies. The only code that touches them
-- is the four SECURITY DEFINER functions that already own the access
-- (check_comment_rate_limit, check_post_rate_limit, increment_copy_count and
-- increment_view_count), so this mirrors 037 exactly.
--
-- ============================================================================
-- 3. Direct write grants on four readable tables
-- ============================================================================
--
-- notifications, site_config, slug_aliases and sequence_view_daily keep their
-- SELECT for anon (the site reads them), but anon also held INSERT, UPDATE,
-- DELETE and TRUNCATE. No client code writes any of them as anon. The app code
-- only ever reads site_config, slug_aliases and sequence_view_daily, so their
-- write grants come off authenticated too; notifications keeps authenticated
-- UPDATE because the notifications page marks rows read.
--
-- ROLLBACK, if anything unexpected shows up:
--   grant execute on function <name>(<args>) to public, anon;   -- per function in section 1
--   grant all on public.copy_count_throttle, public.post_rate_throttle,
--     public.view_count_throttle to anon, authenticated;
--   grant insert, update, delete, truncate, references, trigger
--     on public.notifications, public.site_config, public.slug_aliases,
--        public.sequence_view_daily to anon;
--   grant insert, update, delete, truncate, references, trigger
--     on public.site_config, public.slug_aliases, public.sequence_view_daily
--     to authenticated;
--
-- CAVEAT FOR THE NEXT MIGRATION THAT DROPS AND RECREATES one of the section 1
-- functions: CREATE OR REPLACE keeps these grants, DROP FUNCTION followed by
-- CREATE FUNCTION hands PUBLIC execute back. 019 and 025 did exactly that to
-- two of them. Re-run the revoke below after any such change.

do $$
declare
  fn record;
  tbl text;
begin
  -- 1. write functions
  for fn in
    select p.oid as fn_oid, p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_draft_sequence', 'create_sequence_with_version', 'delete_sequence_version',
        'publish_draft_sequence', 'publish_draft_sequences_batch', 'publish_sequence_version',
        'update_draft_sequence', 'update_sequence_metadata', 'update_sequence_with_version',
        'set_current_patch'
      )
  loop
    execute format('revoke execute on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;

  -- 2. throttle tables, same shape as comment_rate_throttle after 037
  foreach tbl in array array['copy_count_throttle', 'post_rate_throttle', 'view_count_throttle']
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('revoke all on public.%I from public, anon, authenticated', tbl);
    end if;
  end loop;

  -- 3. direct write grants on readable tables
  foreach tbl in array array['notifications', 'site_config', 'slug_aliases', 'sequence_view_daily']
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon', tbl);
    end if;
  end loop;

  foreach tbl in array array['site_config', 'slug_aliases', 'sequence_view_daily']
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', tbl);
    end if;
  end loop;

  -- self check: fail loudly instead of leaving a half applied state
  for fn in
    select p.oid as fn_oid, p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_draft_sequence', 'create_sequence_with_version', 'delete_sequence_version',
        'publish_draft_sequence', 'publish_draft_sequences_batch', 'publish_sequence_version',
        'update_draft_sequence', 'update_sequence_metadata', 'update_sequence_with_version',
        'set_current_patch'
      )
  loop
    if has_function_privilege('anon', fn.fn_oid, 'execute') then
      raise exception '045: anon can still execute %', fn.sig;
    end if;
    if not has_function_privilege('authenticated', fn.fn_oid, 'execute') then
      raise exception '045: authenticated lost execute on %', fn.sig;
    end if;
  end loop;

  foreach tbl in array array['copy_count_throttle', 'post_rate_throttle', 'view_count_throttle']
  loop
    if to_regclass('public.' || tbl) is not null
       and (has_table_privilege('anon', 'public.' || tbl, 'select')
         or has_table_privilege('authenticated', 'public.' || tbl, 'select')
         or has_table_privilege('anon', 'public.' || tbl, 'insert')) then
      raise exception '045: % is still reachable by anon or authenticated', tbl;
    end if;
  end loop;

  foreach tbl in array array['notifications', 'site_config', 'slug_aliases', 'sequence_view_daily']
  loop
    if to_regclass('public.' || tbl) is not null
       and (has_table_privilege('anon', 'public.' || tbl, 'insert')
         or has_table_privilege('anon', 'public.' || tbl, 'update')
         or has_table_privilege('anon', 'public.' || tbl, 'delete')) then
      raise exception '045: anon can still write %', tbl;
    end if;
  end loop;

  raise notice '045: anon write grants and throttle table access removed, authenticated and service_role execute kept.';
end $$;
