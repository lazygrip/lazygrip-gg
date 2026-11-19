-- 053_close_direct_version_and_notification_writes.sql
--
-- Defense in depth, same family as 037, 040, 045, 046 and 048. Zero behavior
-- change on production for the site as it is built today: the browser never
-- writes to these paths directly, and every legitimate write goes through a
-- SECURITY DEFINER function or the service role, neither of which is touched
-- here. Nothing in this file changes data.
--
-- Found by the 2026-11-19 audit pass: a live read of pg_policies and
-- information_schema.column_privileges, cross-checked against a grep of every
-- .from(...) write in src/.
--
-- ============================================================================
-- 1. sequence_versions: a signed-in author could insert a version row directly
-- ============================================================================
--
-- The policy "Authors can insert versions for their own sequences" plus an
-- INSERT grant on every column let any signed-in author POST a version row for
-- one of their own sequences straight to /rest/v1/sequence_versions, which
-- skips everything publish_sequence_version and update_sequence_with_version
-- check: the onboarding and verified-poster gate, the rate limit, version
-- numbering, the jsonb shape of collection_sequences and the update of the
-- sequence's current version. The 2026-09-29 deploy outage was one version row
-- with a malformed collection_sequences, and the reader guard added since only
-- protects pages, not the table. This was listed as an open item in the
-- 2026-09-30 session log.
--
-- MEASURED 2026-11-19: no code under src/ inserts into or updates
-- sequence_versions from the browser (the only .from('sequence_versions') calls
-- are two select('*') reads in sequences/[slug]/update/page.tsx), and the four
-- functions that write it (publish_sequence_version, create_sequence_with_version,
-- update_sequence_with_version, publish_draft_sequence) are SECURITY DEFINER,
-- so they keep working with these grants gone. There was never an UPDATE policy,
-- so UPDATE was already refused by row level security; the grant goes too.
--
-- ============================================================================
-- 2. notifications: members held INSERT and an UPDATE on every column
-- ============================================================================
--
-- The only write the site makes is marking the member's own notifications read
-- (notifications/page.tsx, update({ is_read: true })). Notifications are
-- created by the notify_on_* trigger functions, which are SECURITY DEFINER.
-- There is no INSERT policy, so a direct insert was already refused, and the
-- UPDATE policy limits a member to their own rows, so this removes the INSERT
-- grant and narrows UPDATE to the one column the site uses, so a member can no
-- longer rewrite the text, type or sequence link of their own notification.
--
-- ROLLBACK, if a path turns out to need one of these back:
--   grant insert, update on public.sequence_versions to authenticated;
--   create policy "Authors can insert versions for their own sequences"
--     on public.sequence_versions for insert
--     with check ((select auth.uid()) = author_id
--       and exists (select 1 from public.sequences s
--                   where s.id = sequence_versions.sequence_id
--                     and s.author_id = (select auth.uid())));
--   grant insert on public.notifications to authenticated;
--   grant update on public.notifications to authenticated;
--
-- Idempotent: safe to run twice.

drop policy if exists "Authors can insert versions for their own sequences"
  on public.sequence_versions;

revoke insert, update on public.sequence_versions from public, anon, authenticated;

revoke insert, update on public.notifications from public, anon, authenticated;
grant update (is_read) on public.notifications to authenticated;

do $$
declare
  v_leftover text;
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sequence_versions' and cmd = 'INSERT'
  ) then
    raise exception '053: an INSERT policy is still present on sequence_versions.';
  end if;

  select string_agg(grantee || ' ' || privilege_type || ' on ' || table_name || '.' || column_name, ', ')
    into v_leftover
  from information_schema.column_privileges
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated', 'PUBLIC')
    and (
      (table_name = 'sequence_versions' and privilege_type in ('INSERT', 'UPDATE'))
      or (table_name = 'notifications' and privilege_type = 'INSERT')
      or (table_name = 'notifications' and privilege_type = 'UPDATE' and column_name <> 'is_read')
    );

  if v_leftover is not null then
    raise exception '053: grants that should be gone are still there: %', v_leftover;
  end if;

  if not has_column_privilege('authenticated', 'public.notifications', 'is_read', 'UPDATE') then
    raise exception '053: members can no longer mark their notifications read.';
  end if;
end;
$$;
