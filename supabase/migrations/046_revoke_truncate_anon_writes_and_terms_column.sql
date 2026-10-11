-- 046_revoke_truncate_anon_writes_and_terms_column.sql
--
-- Defense in depth, same family as 037, 040 and 045. Zero behavior change on
-- production: every path below is already refused by row level security or by
-- a function body check, so nothing the site does today depends on these
-- grants. This migration removes the grant underneath so that one future
-- mistake (a table created without RLS, a policy loosened by accident) does not
-- turn straight into a write by a stranger. Nothing here touches data.
--
-- Found by a live read of information_schema.role_table_grants on 2026-10-11
-- after 045 was applied.
--
-- ============================================================================
-- 1. TRUNCATE, REFERENCES and TRIGGER were granted to anon and authenticated
-- ============================================================================
--
-- Every public table carried them (comments, ratings, saves, sequences,
-- sequence_versions, relay_failures, profiles and the rest). TRUNCATE is the one
-- that matters: it ignores row level security entirely, so a role holding it
-- can empty a table no matter what the policies say. PostgREST does not expose
-- TRUNCATE, so this is not reachable through the API today, which is exactly why
-- it is worth closing before something does. REFERENCES and TRIGGER are only
-- ever used by whoever creates foreign keys and triggers, and that is the
-- migration role, never a site visitor. Triggers fire regardless of the
-- invoking role's TRIGGER privilege, so no existing trigger changes.
--
-- ============================================================================
-- 2. anon held INSERT, UPDATE and DELETE on tables the site never writes as anon
-- ============================================================================
--
-- comments, ratings, saves, sequence_versions, relay_failures and sequences
-- (DELETE) all still granted writes to anon, held back only by row level
-- security. Every write in src/ runs as a signed in user (the comment, rating
-- and save writes), through a SECURITY DEFINER function, or through the service
-- role (the relay routes and src/lib/relay.ts). The logged out visitor writes
-- only through increment_view_count, increment_copy_count and
-- bump_sequence_view_daily, which are functions and are not touched here.
--
-- ============================================================================
-- 3. relay_failures is a service role table
-- ============================================================================
--
-- The only code that touches it is admin.from('relay_failures').insert in
-- src/lib/relay.ts, which uses the service role key. Neither anon nor
-- authenticated has any reason to hold even SELECT, so all of it comes off.
--
-- ============================================================================
-- 4. sequence_ratings is a grouped aggregate view
-- ============================================================================
--
-- It is "select sequence_id, avg(score), count(*) from ratings group by
-- sequence_id" with security_invoker on, so it is not writable and the write
-- grants on it were inert. They are removed so the grant list says what is true.
-- SELECT stays.
--
-- ============================================================================
-- 5. authenticated could SELECT profiles.terms_accepted_at
-- ============================================================================
--
-- 032 and 034 took terms_accepted_at away from anon and off the authenticated
-- UPDATE list, but the column SELECT for authenticated survived. Every reader
-- of it is already SECURITY DEFINER (has_completed_onboarding, accept_terms,
-- get_posting_eligibility), no policy expression mentions it (checked against
-- pg_policies), and nothing in src/ selects it. Revoking it stops any signed in
-- user from reading another user's consent timestamp through the API.
--
-- ============================================================================
-- 6. Future tables
-- ============================================================================
--
-- Default privileges for the migration role no longer hand TRUNCATE, REFERENCES
-- and TRIGGER to anon and authenticated on tables created from here on. The
-- ordinary SELECT, INSERT, UPDATE and DELETE defaults are left alone on purpose
-- so a later migration that creates a table does not silently lose its normal
-- grants.
--
-- ROLLBACK, if anything unexpected shows up:
--   grant truncate, references, trigger on all tables in schema public to anon, authenticated;
--   grant insert, update, delete on public.comments, public.ratings, public.saves,
--     public.sequence_versions, public.relay_failures to anon;
--   grant delete on public.sequences to anon;
--   grant all on public.relay_failures to authenticated;
--   grant insert, update, delete on public.sequence_ratings to anon, authenticated;
--   grant select (terms_accepted_at) on public.profiles to authenticated;

do $$
declare
  rel record;
  bad text;
  needed text[] := array[
    'comments:insert', 'comments:update', 'ratings:insert', 'ratings:update',
    'saves:insert', 'saves:delete', 'sequences:delete', 'notifications:update'
  ];
  item text;
  had_before text[] := '{}';
begin
  -- Remember which of the grants the site needs were present BEFORE any revoke,
  -- so the self check at the bottom only fails on a grant THIS migration took
  -- away. A from-scratch database (scripts/schema-check) never had some of them,
  -- and must not fail here for that reason.
  foreach item in array needed
  loop
    if to_regclass('public.' || split_part(item, ':', 1)) is not null
       and has_table_privilege('authenticated', 'public.' || split_part(item, ':', 1), split_part(item, ':', 2)) then
      had_before := had_before || item;
    end if;
  end loop;

  -- 1. TRUNCATE, REFERENCES, TRIGGER off every public table and view
  for rel in
    select c.oid, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke truncate, references, trigger on public.%I from public, anon, authenticated', rel.relname);
  end loop;

  -- 2. anon never writes a table directly
  for rel in
    select c.oid, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke insert, update, delete on public.%I from public, anon', rel.relname);
  end loop;

  -- 3. relay_failures is service role only
  if to_regclass('public.relay_failures') is not null then
    revoke all on public.relay_failures from public, anon, authenticated;
  end if;

  -- 4. the ratings aggregate view is read only
  if to_regclass('public.sequence_ratings') is not null then
    revoke insert, update, delete on public.sequence_ratings from public, anon, authenticated;
  end if;

  -- 5. consent timestamp is not readable through the API
  revoke select (terms_accepted_at) on public.profiles from public, anon, authenticated;

  -- 6. future tables
  alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;

  -- self check: fail loudly and roll the whole block back instead of leaving a half applied state
  select string_agg(g.table_name || ':' || g.grantee || ':' || g.privilege_type, ', ')
    into bad
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.grantee in ('anon', 'authenticated')
    and g.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER');
  if bad is not null then
    raise exception '046: truncate/references/trigger still granted: %', bad;
  end if;

  select string_agg(g.table_name || ':' || g.privilege_type, ', ')
    into bad
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.grantee = 'anon'
    and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  if bad is not null then
    raise exception '046: anon can still write: %', bad;
  end if;

  if to_regclass('public.relay_failures') is not null
     and (has_table_privilege('authenticated', 'public.relay_failures', 'select')
       or has_table_privilege('anon', 'public.relay_failures', 'select')) then
    raise exception '046: relay_failures is still reachable by anon or authenticated';
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'select') then
    raise exception '046: authenticated can still select profiles.terms_accepted_at';
  end if;

  -- the things the site really does as a signed in user must have survived
  foreach item in array had_before
  loop
    if not has_table_privilege('authenticated', 'public.' || split_part(item, ':', 1), split_part(item, ':', 2)) then
      raise exception '046: a grant the site needs was removed: %', item;
    end if;
  end loop;

  raise notice '046: truncate, anon writes, relay_failures access and terms_accepted_at select removed.';
end $$;
