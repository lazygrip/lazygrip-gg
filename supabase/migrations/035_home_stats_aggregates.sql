-- 035_home_stats_aggregates.sql
--
-- Audit F7.5: three unbounded aggregate reads that truncate SILENTLY.
--
-- home-stats.ts:31-38 fetches view_count for EVERY published sequence and
-- class_name for EVERY published sequence, with no .limit(), and sums and
-- de-dupes them in JS. :104-108 does the same with (author_id, view_count) for
-- the creator ranking -- and note that fetchTopCreators' `limit` argument
-- bounds the RANKED OUTPUT, not the source query, so /creators passing 500 does
-- not bound the fetch at all.
--
-- PostgREST applies a server-side maximum row count. When the corpus crosses
-- it the source rows are truncated and NO ERROR IS RETURNED, so every one of
-- these functions -- each of which only tests `error` -- returns a confidently
-- wrong number.
--
-- THE TELL IS ALREADY BUILT IN AND NOBODY IS READING IT. sequenceCount comes
-- from `{ count: 'exact' }`, which is a real count and immune to truncation,
-- while viewCount is summed from the truncated rows. The homepage would show a
-- correct sequence count beside a wrong view total: two numbers from one query
-- disagreeing, which is the same detector that caught F6 and the BattleTag
-- miscount in that document.
--
-- Latent, not live, at 87 published sequences. Fixed before the corpus grows
-- into it rather than after someone notices a wrong number, because the failure
-- leaves no trace to find afterwards -- the numbers just quietly stop being
-- right, and there is no log line, no error and no threshold event to point at.
--
-- SECURITY INVOKER, NOT DEFINER, and that is a decision rather than a default.
-- These read only rows the caller can already see: sequences has a
-- published-is-public SELECT policy and profiles has `using (true)`, so definer
-- rights would buy nothing. 031 wrote up the failure mode that definer brings
-- with it -- `create or replace function` does not change an existing
-- function's owner, so a later replace by a different role silently changes who
-- the body runs as -- and there is no reason to accept that here. As an invoker
-- function the aggregate is computed under the caller's own RLS, which is also
-- what keeps the numbers honest if the policies ever tighten.
--
-- The aggregation moves into SQL, which is the actual fix: it is not "the same
-- thing but faster", it is the difference between a bounded transfer of one row
-- and an unbounded transfer of one row per sequence that the server is free to
-- cut short without telling anyone.

create or replace function public.home_stats()
returns table (
  sequence_count bigint,
  class_count bigint,
  member_count bigint,
  view_count bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.sequences where status = 'published'),
    (select count(distinct class_name) from public.sequences
      where status = 'published' and class_name is not null),
    (select count(*) from public.profiles),
    -- coalesce because sum() over zero rows is NULL, not 0, and the homepage
    -- would render an empty stat rather than "0 views" on a fresh database.
    (select coalesce(sum(view_count), 0) from public.sequences where status = 'published');
$$;

comment on function public.home_stats() is
  'The four homepage stat-block numbers, aggregated in SQL. Replaces fetching one row per published sequence and summing in JS, which truncated silently at the PostgREST row cap and returned a confidently wrong view total (audit F7.5). SECURITY INVOKER: every row it reads is already readable by the caller, so the aggregate is computed under the caller''s own RLS.';

grant execute on function public.home_stats() to anon, authenticated, service_role;

-- The creator ranking. Semantics are deliberately IDENTICAL to the JS this
-- replaces, so the leaderboard does not silently reorder on deploy:
--
--   * only status = 'published' rows are counted, so a private or draft-only
--     account has nothing to rank on and never appears;
--   * rank by summed view_count descending;
--   * a creator with no username is dropped -- the JS did this after the fact,
--     when profileById lookup produced a row with a null username, and doing it
--     in the WHERE means the limit now returns `limit` usable creators rather
--     than `limit` minus however many were unusable;
--   * ties are broken by sequence_count then username, which the JS did NOT do
--     -- Array.prototype.sort is stable but the input order came from a Map's
--     insertion order, which came from whatever order PostgREST returned rows
--     in. So the OLD behaviour on a tie was arbitrary-but-usually-consistent;
--     this makes it defined. That is a change, and it is called out rather than
--     buried: two creators on equal views can swap places once, on the deploy
--     that applies this.
create or replace function public.top_creators(p_limit integer default 15)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_color text,
  sequence_count bigint,
  total_views bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.avatar_color,
    agg.sequence_count,
    agg.total_views
  from (
    select
      s.author_id,
      count(*) as sequence_count,
      coalesce(sum(s.view_count), 0) as total_views
    from public.sequences s
    where s.status = 'published' and s.author_id is not null
    group by s.author_id
  ) agg
  join public.profiles p on p.id = agg.author_id
  where p.username is not null and p.username <> ''
  order by agg.total_views desc, agg.sequence_count desc, p.username asc
  -- greatest(...,0) so a negative argument cannot become an unbounded scan, and
  -- least(...,500) so a caller cannot ask for the whole table through a public
  -- RPC. 500 is what /creators already passes, so it is the real ceiling rather
  -- than an invented one.
  limit least(greatest(coalesce(p_limit, 15), 0), 500);
$$;

comment on function public.top_creators(integer) is
  'Creator leaderboard ranked by summed view_count across published sequences, aggregated in SQL. Replaces fetching (author_id, view_count) for every published sequence and grouping in JS, where the limit argument bounded the ranked OUTPUT and not the source query (audit F7.5). Tie-break is sequence_count then username, which the JS version left undefined. SECURITY INVOKER.';

grant execute on function public.top_creators(integer) to anon, authenticated, service_role;
