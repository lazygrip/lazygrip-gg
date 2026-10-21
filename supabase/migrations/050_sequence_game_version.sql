-- 050_sequence_game_version.sql
--
-- Adds the dimension the site needs before WoW: Forever launches (2026-11-04):
-- which version of the game a sequence is for. Until now every sequence was
-- implicitly retail, there is no column that says so, and the one signal the
-- addon exposes cannot tell the two Classic-style clients apart, because
-- Forever declares the same .toc interface number as Classic Era (16001, per
-- the WoW: Forever guide page). The version therefore has to be declared by
-- the author, not inferred from the string.
--
-- WHAT THIS ADDS
--   public.sequences.game_version   text, not null, default 'retail', limited
--                                   to 'retail' and 'forever' by a check.
--   public.set_sequence_game_version(uuid, text)
--                                   how an author sets it on their own row.
--
-- WHY A NEW RPC AND NOT A NEW PARAMETER ON THE EXISTING ONES. create_draft_
-- sequence, create_sequence_with_version, update_draft_sequence, update_
-- sequence_metadata and update_sequence_with_version each take a long
-- positional parameter list and have been redefined in 002, 005, 007, 009 and
-- later. Adding a parameter to each would mean re-issuing five hardened
-- SECURITY DEFINER bodies with every gate and search_path pin copied by hand,
-- on the one table whose column grants (031) are the main write control. A
-- separate function that touches exactly one column leaves every one of them
-- as it is.
--
-- WHY NO COLUMN GRANT. 031 revoked INSERT and UPDATE on public.sequences from
-- authenticated and re-granted them per listed column. A column added after
-- that is therefore NOT writable by authenticated, which is what is wanted: the
-- raw browser insert at post/page.tsx can never name it, so a forged row cannot
-- carry a game version it did not get through the function below. service_role
-- holds table-level INSERT and UPDATE, so admin-client writes still reach it.
-- SELECT is unrestricted on this table (only profiles has column-level SELECT),
-- so anon can read it and Browse can filter on it with no further grant. The
-- DO block at the end asserts all three instead of assuming them.
--
-- WHAT EXISTING ROWS BECOME. Every one of them is 'retail', through the column
-- default. That is true of the corpus today: nothing on the site has been for
-- any other client. Adding a column with a constant default is a metadata-only
-- change in PostgreSQL 11 and later, so there is no table rewrite and no long
-- lock. The check constraint is validated against the existing rows when it is
-- added, which is instant because the default already satisfies it.
--
-- WHAT THIS DOES NOT DO, stated because it is the open question. The published-
-- sequences-need-a-spec constraint from 033 is unchanged. Forever's spec model
-- is not known to this repo (the v2.4.21 changelog says two spec functions are
-- missing from that client), so a Forever sequence that has no spec cannot be
-- published yet. If Forever has no specs, 033 needs a game-version exception in
-- its own migration, written when that is measured and not guessed here.
--
-- ORDER OF OPERATIONS. Apply this BEFORE deploying the code that reads the
-- column: Browse selects it, and a deploy that lands first would ask PostgREST
-- for a column that does not exist and return an error for every listing. The
-- reverse order is safe, because nothing in the previous deploy references it.
--
-- Idempotent: safe to run twice.

alter table public.sequences
  add column if not exists game_version text not null default 'retail';

alter table public.sequences
  drop constraint if exists sequences_game_version_known;

alter table public.sequences
  add constraint sequences_game_version_known
  check (game_version in ('retail', 'forever'));

comment on column public.sequences.game_version is
  'Which client the sequence is for: retail or forever. Declared by the author through set_sequence_game_version, never inferred from the string, because Forever and Classic Era share interface 16001. Defaults to retail.';

create or replace function public.set_sequence_game_version(p_sequence_id uuid, p_game_version text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_author uuid;
  v_current text;
begin
  if v_caller is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_game_version is null or p_game_version not in ('retail', 'forever') then
    raise exception 'Unknown game version (got %). Expected retail or forever.', coalesce(p_game_version, 'null')
      using errcode = '22023';
  end if;

  -- Ownership is read from the row, never taken from an argument. The row is
  -- read inside a definer function, so RLS does not apply and the comparison
  -- below has to be explicit (the same reasoning as set_sequence_status in 031).
  select author_id, game_version into v_author, v_current
  from public.sequences
  where id = p_sequence_id;

  if v_author is null then
    raise exception 'No such sequence.' using errcode = 'P0002';
  end if;

  if v_author is distinct from v_caller then
    raise exception 'That is not your sequence.' using errcode = '42501';
  end if;

  if v_current = p_game_version then
    return v_current;
  end if;

  -- updated_at is deliberately left alone, as in set_sequence_status: this
  -- relabels a row, it is not an edit to the sequence, and bumping it would
  -- float a relabelled sequence to the top of Most recent. No rate limit is
  -- spent either, since nothing new is being published.
  update public.sequences
  set game_version = p_game_version
  where id = p_sequence_id;

  return p_game_version;
end;
$$;

comment on function public.set_sequence_game_version(uuid, text) is
  'Sets game_version on one of the caller''s own sequences, in any status. Refuses values other than retail and forever, and rows that are not the caller''s. Does not touch updated_at.';

revoke all on function public.set_sequence_game_version(uuid, text) from public, anon;
grant execute on function public.set_sequence_game_version(uuid, text) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sequences' and column_name = 'game_version'
      and is_nullable = 'NO' and column_default like '%retail%'
  ) then
    raise exception '050: sequences.game_version is missing, nullable, or has no retail default.';
  end if;

  if exists (select 1 from public.sequences where game_version is distinct from 'retail') then
    raise exception '050: a row is not retail straight after the migration; the default did not apply.';
  end if;

  if has_column_privilege('authenticated', 'public.sequences', 'game_version', 'UPDATE')
     or has_column_privilege('authenticated', 'public.sequences', 'game_version', 'INSERT') then
    raise exception '050: authenticated can write sequences.game_version directly. The function is meant to be the only way.';
  end if;

  if has_column_privilege('anon', 'public.sequences', 'game_version', 'UPDATE')
     or has_column_privilege('anon', 'public.sequences', 'game_version', 'INSERT') then
    raise exception '050: anon can write sequences.game_version.';
  end if;

  if not has_column_privilege('anon', 'public.sequences', 'game_version', 'SELECT') then
    raise exception '050: anon cannot read sequences.game_version, so Browse could not filter on it.';
  end if;

  if has_function_privilege('anon', 'public.set_sequence_game_version(uuid, text)', 'EXECUTE') then
    raise exception '050: anon can execute set_sequence_game_version.';
  end if;

  if not has_function_privilege('authenticated', 'public.set_sequence_game_version(uuid, text)', 'EXECUTE') then
    raise exception '050: authenticated cannot execute set_sequence_game_version.';
  end if;
end;
$$;
