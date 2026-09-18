-- 039_drop_sequences_is_published.sql
--
-- `public.sequences.is_published` exists in this repo's migrations and does NOT
-- exist in production. 001 creates it; nothing since has ever dropped it. So a
-- database built from scratch out of this directory carries a column the live
-- one does not, and the schema-from-scratch check compares two shapes that were
-- never the same.
--
-- ABSENCE IN PRODUCTION IS MEASURED THREE INDEPENDENT WAYS, not inferred from
-- one read, because "not visible to anon" is a weaker claim than "not there"
-- and an earlier pass (10.6) correctly refused to drop the column while that
-- was the only evidence:
--
--   1. @slowdog-dev's own `information_schema.columns` read on the live
--      database, which is not subject to RLS or column grants.
--   2. `select=is_published` as anon returns
--      `42703 column sequences.is_published does not exist` -- the error for a
--      MISSING column, distinct from `42501` for one that exists and is not
--      granted.
--   3. `select=*` as anon returns 41 columns and none of them is it.
--
-- WHY ITS OWN MIGRATION. #81 ("make the migrations applicable from scratch")
-- merged 2026-09-17 22:37 WITHOUT dropping it, so there is no open PR to fold
-- this into. #84 is scoped to slug_aliases alone by Jesper's 2026-09-18
-- instruction and is deliberately not widened here. #85 and #86 merged
-- 2026-09-18 and touched neither the schema nor this column.
--
-- ============================================================================
-- Nothing depends on the column by the time this file runs
-- ============================================================================
--
-- 001 created the column AND one policy over it:
--
--     001:64  is_published boolean default true,
--     001:73  create policy "Published sequences are viewable by everyone"
--               on public.sequences for select using (is_published = true);
--
-- 002 replaced that policy with the status-based one that production actually
-- runs, dropping the old definition first:
--
--     002:248  drop policy if exists "Published sequences are viewable by everyone" ...
--     002:249  create policy "Published sequences are viewable by everyone"
--                on public.sequences for select using (status = 'published'::sequence_status);
--
-- So the only dependency 001 ever created was already gone 37 migrations ago,
-- and `sequence_status` is what every read path has used since. Measured
-- 2026-09-18 across the whole repo: `is_published` appears in exactly three
-- places -- 001:64, 001:73, and a comment in 002 explaining that a function
-- once inserted into it. There is no reference in src/, in any view, or in any
-- later migration.
--
-- ============================================================================
-- DROP ... RESTRICT, NEVER CASCADE
-- ============================================================================
--
-- The default is RESTRICT and it is being relied on deliberately rather than
-- inherited. If some object this analysis did not find still depends on the
-- column, CASCADE would silently drop that object too -- a policy, a view, an
-- index -- and the migration would report success while removing a read path
-- nobody asked it to touch. RESTRICT makes that case FAIL and name the
-- dependent object, which is the outcome worth having: a loud stop is
-- recoverable, a silently dropped SELECT policy on `sequences` is a public site
-- serving nothing.
--
-- `if exists` is what makes this file apply cleanly to BOTH databases: a no-op
-- against production, where the column is already absent, and a real drop
-- against a from-scratch build, where 001 just created it.
alter table public.sequences
drop column if exists is_published;

-- ============================================================================
-- The assertion, which is the half that makes the drop a fact
-- ============================================================================
--
-- `drop column if exists` cannot fail loudly on its own -- it is silent whether
-- it dropped something or found nothing -- so on its own it proves nothing about
-- the shape the file leaves behind. This block reads the catalog back and
-- raises if the column survived, which is the only way this migration reports a
-- problem rather than a notice.
--
-- It also states which of the two cases ran. The distinction matters to a human
-- reading an apply log: "dropped it" is the from-scratch build finally matching
-- production, and "already absent" is production confirming it was right all
-- along. A migration that printed the same line for both would be hiding the
-- one fact the reader came for.
do $$
declare
  v_still_there boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sequences'
      and column_name = 'is_published'
  ) into v_still_there;

  if v_still_there then
    raise exception
      '039: public.sequences.is_published still exists after drop column if exists -- the drop did not take, and the from-scratch schema still does not match production.';
  end if;

  raise notice '039: public.sequences.is_published is absent. The from-scratch schema now matches production on this column.';
end $$;
