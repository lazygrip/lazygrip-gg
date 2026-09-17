-- 003_recover_objects_no_migration_creates.sql
--
-- PROVISIONAL. Every object here exists in production and is created by no
-- migration in this repo, so a from-scratch apply produces a database the app
-- cannot run against. This file is reconstructed from how the surrounding
-- migrations USE each object, not from the deployed definition, and it is to
-- be replaced or corrected against the pg_dump requested in issue #78 before
-- anyone treats it as authoritative. It is sufficient to make the migrations
-- apply; it is not evidence that the result matches production.
--
-- Numbered 003 because 024 and 025 need these objects and the slot is free --
-- the repo has always run 001, 002, 004. Everything is `if not exists`, so on
-- production, where all of it already exists, this file is a no-op.
--
-- Measured with scripts/schema-check/apply-from-scratch.sh: without this file
-- and 002's idempotency repair, 8 of 30 migrations fail.
--
-- ============================================================
-- 1. sequences.actions and sequence_versions.actions
-- ============================================================
-- 025_actions_tree_and_version_sync.sql says, in its own header:
--
--   "Columns were already added in migration 025_actions_tree_column.sql
--    (ALTER TABLE ... ADD COLUMN IF NOT EXISTS actions jsonb, both tables)."
--
-- There is no 025_actions_tree_column.sql in this repo. The file was renamed
-- or replaced and took the column additions with it. This restores exactly the
-- two statements that comment describes, including the jsonb type it names.
alter table public.sequences         add column if not exists actions jsonb;
alter table public.sequence_versions add column if not exists actions jsonb;

comment on column public.sequences.actions is
  'Structured action tree for the sequence. Nullable and additive: rows predating it keep raw_steps as their only representation and the display layer falls back to the flat renderer.';

-- ============================================================
-- 2. sequences.copy_count
-- ============================================================
-- 024 and 031 both do `update public.sequences set copy_count = copy_count + 1`.
-- That expression is null-propagating, so the column cannot be nullable without
-- the counter silently staying null forever. Modelled on view_count and
-- save_count, which 002 declares as `integer default 0`.
alter table public.sequences add column if not exists copy_count integer not null default 0;

-- ============================================================
-- 3. public.copy_count_throttle
-- ============================================================
-- 024 opens with `alter table public.copy_count_throttle add column if not
-- exists count_today integer not null default 1`, so it assumes a table that
-- nothing creates. The shape is taken from 011's view_count_throttle, which is
-- the same mechanism for views, plus the four columns 024 and 031 read and
-- write: sequence_id, copier_ip, last_counted_at, count_today.
--
-- count_today is NOT included here on purpose: 024's own first statement adds
-- it, and adding it here too would make that statement the no-op instead of
-- this one, which would hide it if 024 ever changed.
create table if not exists public.copy_count_throttle (
  sequence_id uuid not null,
  copier_ip text not null,
  last_counted_at timestamptz not null default now(),
  primary key (sequence_id, copier_ip)
);

-- 011 does the same for view_count_throttle: the table is written only by
-- SECURITY DEFINER functions, so RLS on with no policy denies every direct
-- client read and write.
alter table public.copy_count_throttle enable row level security;
