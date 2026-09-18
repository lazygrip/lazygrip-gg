-- 038_recover_slug_aliases.sql
--
-- Recovers public.slug_aliases, which exists in production and is created by no
-- migration in this repo. sequence-server.ts:64 and sequences/[slug]/page.tsx:41
-- both read it, so a from-scratch apply produces a database those two queries
-- fail against.
--
-- 036 surfaced this and deliberately did not fix it, on the grounds that writing
-- a create-table for a live table from a three-column REST sample is a guess
-- about defaults, constraints, indexes and policies that would then read as
-- authoritative. That objection is answered rather than overruled. This is NOT a
-- reconstruction: @slowdog-dev pulled the original SQL out of
-- supabase_migrations.schema_migrations in issue #78, which stores the exact
-- statements Supabase ran, keyed by version.
--
--     production version   20260808194907
--     production name      017_slug_aliases_and_backfill
--
-- The repo's 017 is 017_discord_bridge_opt_out.sql, so that number is already
-- taken and this file is 038. The version string above is the identity the CLI
-- tracks; the filename is not.
--
-- CORROBORATED INDEPENDENTLY before writing it, publishable key and no session,
-- 2026-09-18:
--
--     GET /rest/v1/slug_aliases?select=*&limit=1
--       200  [{"old_slug":"untitled-draft-mrpuldfm",
--              "sequence_id":"a0cea2fc-8289-4fbe-91a9-0fc2bc7491d8",
--              "created_at":"2026-08-08T19:49:07.359779+00:00"}]
--
-- Three columns and no others, matching the DDL below. The oldest row's
-- created_at is the production version string to the second, which ties the
-- posted SQL to this table rather than to something else with the same name. The
-- public select policy is confirmed by that read succeeding as anon at all.
-- sequence-server.ts:25 independently dates the same event: "'redirect' is new
-- (2026-08-08, slug_aliases backfill)".
--
-- THE ONLY DEPARTURES FROM THE POSTED SQL are the idempotency guards: `if not
-- exists` on the table and the index, and the drop-guard on the policy, which is
-- the pattern 036 already uses. On production, where every object here already
-- exists, this file is a no-op.
--
-- NOT INCLUDED: the same production migration also backfilled nine
-- untitled-draft-* rows with hardcoded ids and slugs. Those are data for rows
-- that exist only in production, where the aliases are already present. On an
-- empty database there is nothing to backfill and replaying it would insert nine
-- aliases pointing at sequence ids that do not exist, which the foreign key
-- below would then reject.

create table if not exists public.slug_aliases (
  old_slug text primary key,
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.slug_aliases is
  'Old sequence slugs, so a bookmarked or linked /sequences/<old-slug> keeps resolving after a reslug. Read by sequence-server.ts and sequences/[slug]/page.tsx. There is no insert, update or delete policy and no client role holds those grants, by design: writes only ever come from the service-role admin client.';

alter table public.slug_aliases enable row level security;

drop policy if exists "slug_aliases are publicly readable" on public.slug_aliases;
create policy "slug_aliases are publicly readable"
  on public.slug_aliases for select
  to anon, authenticated
  using (true);

create index if not exists slug_aliases_sequence_id_idx
  on public.slug_aliases (sequence_id);
