-- 040_tighten_leftover_grants_and_view_daily_rls.sql
--
-- Two leftovers found doing our own audit pass rather than waiting on Jesper
-- to find them, both zero behavior change on production, verified against
-- the live database before writing this file.
--
-- ============================================================================
-- 1. public.profiles still holds a DELETE grant nobody uses
-- ============================================================================
--
-- 032_profiles_column_grants.sql revoked UPDATE and INSERT from public, anon
-- and authenticated on profiles, and said explicitly in its own text why it
-- was leaving SELECT alone (034 closed that half later). DELETE was never
-- mentioned in either migration. Measured directly against production:
-- anon and authenticated both still hold table-level DELETE on profiles, a
-- leftover from the original scaffolding grant, and pg_policies has no
-- DELETE policy on profiles at all -- so nothing can act on it today, but
-- it is unused attack surface sitting on the one table this whole audit has
-- been about, and every other cleanup pass on this table has walked past it.
--
-- ============================================================================
-- 2. sequence_view_daily's only policy re-checks auth.uid() per row
-- ============================================================================
--
-- optimize_rls_policies_sequences_comments and optimize_rls_policies_remaining_tables
-- (both 2026-08-09) rewrote every auth.uid() call in every policy in this schema
-- to (select auth.uid()), which lets Postgres cache it once per statement instead
-- of re-evaluating it per row. sequence_view_daily did not exist yet -- it was
-- added over a month later in 030_creator_dashboard.sql -- so it was never in
-- scope for that pass, not a regression, just a table that arrived after the
-- sweep and was never carried forward into it. Every other policy in the
-- schema uses the optimized form; this is the one exception, confirmed by
-- reading pg_policies directly rather than assuming.
do $$
begin
  -- DELETE has no per-column grain in Postgres, so it never shows up in
  -- information_schema.column_privileges -- that view only covers
  -- SELECT/INSERT/UPDATE/REFERENCES. Checking it here would always read as
  -- "nothing to revoke" and skip the revoke silently. has_table_privilege
  -- is the correct check for a table-level privilege like this one.
  if has_table_privilege('anon', 'public.profiles', 'DELETE') then
    execute 'revoke delete on public.profiles from anon';
  end if;

  if has_table_privilege('authenticated', 'public.profiles', 'DELETE') then
    execute 'revoke delete on public.profiles from authenticated';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'DELETE')
     or has_table_privilege('authenticated', 'public.profiles', 'DELETE') then
    raise exception '040: anon or authenticated still holds DELETE on public.profiles after the revoke.';
  end if;
end $$;

drop policy if exists "Sequence view history viewable by the sequence's author" on public.sequence_view_daily;
create policy "Sequence view history viewable by the sequence's author"
  on public.sequence_view_daily for select
  using (exists (
    select 1 from public.sequences
    where sequences.id = sequence_view_daily.sequence_id
      and sequences.author_id = (select auth.uid())
  ));

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sequence_view_daily'
      and policyname = 'Sequence view history viewable by the sequence''s author'
      and qual like '%( SELECT auth.uid() AS uid)%'
  ) then
    raise exception '040: sequence_view_daily policy did not pick up the (select auth.uid()) form.';
  end if;

  raise notice '040: profiles DELETE revoked from anon/authenticated (already unreachable via RLS, now unreachable via grant too); sequence_view_daily policy now uses the cached auth.uid() form matching every other policy in the schema.';
end $$;
