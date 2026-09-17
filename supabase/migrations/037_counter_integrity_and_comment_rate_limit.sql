-- 037_counter_integrity_and_comment_rate_limit.sql
--
-- The four MEDIUM findings from the 2026-09-15 audit that are database work:
--
--   M3  comment_count can be drained to zero on any published sequence.
--   M4  A rating can be moved off a sequence, stranding a forged score.
--   M5  Self-rating is permitted and unconstrained.
--   M8  No rate limit on any comment write path, at either layer.
--
-- ============================================================================
-- STATIC. NOT VERIFIED AGAINST A RUNNING DATABASE.
-- ============================================================================
--
-- Everything below is shape-checked (probe_plpgsql_structure.py) and reasoned
-- from the migration history, and NONE of it has been executed. The four
-- findings all live in triggers and policies, and the only honest way to
-- confirm a trigger recounts correctly or a policy refuses the right insert is
-- to run it. There is no staging database reachable from where this was
-- written, and production is read-only here by rule.
--
-- So: @slowdog-dev, this needs applying to staging and exercising before it goes
-- near production. The specific things to exercise are listed against each part,
-- because "test it" is not a handover.
--
-- The three earlier column-grant migrations (031, 032, 034) could be
-- live-verified through the REST API because a grant's effect is observable
-- from outside with an unprivileged key. A trigger's effect is not. That is the
-- whole difference, and it is why those said LIVE-VERIFIED and this one does
-- not.

-- ============================================================================
-- PART 1 (M3): comment_count recounts instead of stepping
-- ============================================================================
--
-- 002:402-417 decrements on the false-to-true is_deleted transition and has NO
-- INCREMENT ON THE REVERSE. The comments UPDATE policy lets an author toggle
-- is_deleted on their own comment freely. So: post one comment on a victim's
-- sequence, then loop true/false. Each cycle costs the victim one, floored at
-- zero by the greatest(0, ...) that makes it look safe.
--
-- The fix is the one the audit named, and it is the one THIS SCHEMA ALREADY
-- USES ELSEWHERE: recount, the way update_sequence_rating does, rather than
-- step. A recount has no state to get out of step with, so no sequence of
-- operations can drift it -- which is a stronger property than "handle the
-- reverse transition too", the narrower fix that would have closed this exact
-- loop and left the next one.
--
-- TWO THINGS THE ORIGINAL DID NOT DO, both fixed here rather than noted:
--
--   It read `is_deleted` nowhere in its count. A recount must exclude
--   soft-deleted rows or the number means something different from what the
--   page shows.
--
--   It carried no `set search_path`. 026 was the migration that pinned
--   search_path on seven functions and, per M6, may have rolled back entirely
--   on an ALTER FUNCTION against a signature that does not exist -- so whether
--   this function is pinned live is unknown. Pinning it here is unconditional
--   and costs nothing if 026 did apply.
--
-- ALSO HANDLES A MOVED COMMENT. If comments.sequence_id is ever writable the
-- same stranding M4 describes applies here, so an UPDATE that changes it
-- recounts BOTH sequences. That is not speculative defence: it is the identical
-- bug on the identical shape, and writing the loop once is cheaper than
-- discovering it twice.
--
-- EXERCISE ON STAGING: insert a comment, toggle is_deleted true/false ten
-- times, and assert comment_count returns to 1 rather than 0. Then hard-delete
-- it and assert 0.
create or replace function public.update_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new uuid;
  v_old uuid;
begin
  if tg_op = 'INSERT' then
    v_new := new.sequence_id;
  elsif tg_op = 'DELETE' then
    v_old := old.sequence_id;
  else
    v_new := new.sequence_id;
    v_old := old.sequence_id;
  end if;

  if v_new is not null then
    update public.sequences
    set comment_count = (
      select count(*) from public.comments
      where sequence_id = v_new and is_deleted = false
    )
    where id = v_new;
  end if;

  if v_old is not null and v_old is distinct from v_new then
    update public.sequences
    set comment_count = (
      select count(*) from public.comments
      where sequence_id = v_old and is_deleted = false
    )
    where id = v_old;
  end if;

  return null;
end;
$$;

comment on function public.update_comment_count() is
  'Recounts comment_count from the comments table rather than stepping it. The stepping version (002:402) decremented on is_deleted false-to-true and never incremented on the reverse, so toggling one comment drained a victim sequence to zero (audit M3). A recount has no state to drift.';

-- ============================================================================
-- PART 2 (M4): a rating recomputes BOTH sequences it touched
-- ============================================================================
--
-- 002:237-239 leaves ratings.sequence_id writable, and the trigger recomputes
-- using `coalesce(new.sequence_id, old.sequence_id)`, which on an UPDATE
-- resolves to NEW. So: rate a victim 1/10, then PATCH the rating's sequence_id
-- somewhere else. The source sequence is never recomputed and keeps
-- avg_score = 1.0, rating_count = 1 with NO RATING ROW BEHIND IT -- a forged
-- score with nothing left to recompute it, because the only thing that would
-- have is the trigger that just declined to.
--
-- The audit offered "recompute both sides, OR revoke update on sequence_id".
-- This does the first. It does not do the second, and the reason is worth
-- stating: a column revoke on ratings would be a fourth grants migration on a
-- table whose column set has not been measured here the way profiles' was, and
-- a grant list written from migration files rather than from pg_attribute is
-- exactly what 031's PART 0 argues against. Recomputing both sides is complete
-- on its own -- it makes the DATA correct however the row moved -- where the
-- revoke only makes one route to moving it unavailable.
--
-- Also pins search_path, for the same 026 reason as part 1.
--
-- EXERCISE ON STAGING: rate sequence A, PATCH the rating's sequence_id to B,
-- and assert A goes back to avg_score null / rating_count 0 rather than keeping
-- the score.
create or replace function public.update_sequence_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new uuid;
  v_old uuid;
begin
  if tg_op = 'INSERT' then
    v_new := new.sequence_id;
  elsif tg_op = 'DELETE' then
    v_old := old.sequence_id;
  else
    v_new := new.sequence_id;
    v_old := old.sequence_id;
  end if;

  if v_new is not null then
    update public.sequences set
      avg_score = (select round(avg(score)::numeric, 1) from public.ratings where sequence_id = v_new),
      rating_count = (select count(*) from public.ratings where sequence_id = v_new)
    where id = v_new;
  end if;

  -- THE FIX. The old version stopped after the line above.
  if v_old is not null and v_old is distinct from v_new then
    update public.sequences set
      avg_score = (select round(avg(score)::numeric, 1) from public.ratings where sequence_id = v_old),
      rating_count = (select count(*) from public.ratings where sequence_id = v_old)
    where id = v_old;
  end if;

  return coalesce(new, old);
end;
$$;

comment on function public.update_sequence_rating() is
  'Recomputes avg_score and rating_count for every sequence a rating write touched -- both sides when an UPDATE moves sequence_id. The previous version used coalesce(new.sequence_id, old.sequence_id), which resolves to NEW on an update, so moving a rating stranded a forged score on the source with no rating row behind it (audit M4).';

-- ============================================================================
-- PART 3 (M5): a creator cannot rate their own sequence
-- ============================================================================
--
-- 009:33-40 checks only that the rater is who they say they are and has
-- onboarded. One self-rating of 10 on a fresh sequence yields avg_score = 10.0,
-- rating_count = 1, which qualifies for top_rated at maximum score.
--
-- This is an ANTICIPATED state rather than an oversight, which is what makes it
-- worth fixing rather than arguing about: notify_on_rating (002:382) explicitly
-- suppresses the notification for a self-rating, so the schema already knows
-- self-rating happens and already treats it as a special case. It just does not
-- refuse it.
--
-- Double-voting is separately and correctly blocked by unique(sequence_id,
-- user_id) and is untouched here.
--
-- EXISTING SELF-RATINGS ARE NOT REMOVED. A policy is not retroactive, so any
-- that exist stay and keep contributing to avg_score. They are not cleaned up
-- because THEY COULD NOT BE COUNTED FROM WHERE THIS WAS WRITTEN: the ratings
-- SELECT policy (002:228) restricts reads to the sequence's author, the rater,
-- and one admin uuid, so an unprivileged probe returns nothing and a DELETE
-- written blind would be a guess at how much data it removes. Count them first:
--
--     select count(*) from public.ratings r
--     join public.sequences s on s.id = r.sequence_id
--     where r.user_id = s.author_id;
--
-- and decide with the number in hand.
drop policy if exists "Onboarded verified authors can rate" on public.ratings;
create policy "Onboarded verified authors can rate"
on public.ratings
for insert
with check (
  auth.uid() = user_id
  and public.is_verified_poster(user_id)
  and public.has_completed_onboarding(user_id)
  -- `is distinct from` rather than `<>` so a sequence_id matching no row --
  -- where the subquery is NULL -- refuses rather than evaluating to NULL and
  -- failing the whole WITH CHECK by accident. Same outcome, stated on purpose.
  and user_id is distinct from (
    select s.author_id from public.sequences s where s.id = sequence_id
  )
);

-- The UPDATE policy is also replaced, because leaving it alone would let a
-- rating be inserted on someone else's sequence and then MOVED onto your own --
-- the M4 mechanism used to defeat part 3. With part 2 applied the score no
-- longer strands, but the self-rating would still land.
drop policy if exists "Users can update their own rating" on public.ratings;
create policy "Users can update their own rating"
on public.ratings
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and user_id is distinct from (
    select s.author_id from public.sequences s where s.id = sequence_id
  )
);

-- ============================================================================
-- PART 4 (M8): comments get their own rate limit, NOT the posting one
-- ============================================================================
--
-- The audit's wording is that the comments INSERT policy "omits the
-- check_post_rate_limit conjunct that the sequences policy twelve lines below
-- it includes". Adding that exact conjunct would be WRONG, and this is the one
-- place this file departs from what the finding proposed.
--
-- check_post_rate_limit HAS A SIDE EFFECT: on success it inserts into
-- post_rate_throttle (027:52-53), consuming one of the caller's 1/hour and
-- 3/day PUBLISH slots. Migration 031 already wrote this down as the reason
-- set_sequence_status does not call it. Wire it into the comments policy and
-- three comments would exhaust a new author's ability to publish a sequence for
-- the day -- a rate limit that throttles the wrong action.
--
-- It also only bites while the account is under 7 days old (027:30-32). M8's
-- stated risk is that "each insert fires an outbound Discord relay", and a
-- relay-spam risk does not age out at seven days. So the comment limiter
-- deliberately applies to EVERY account, which is the second departure.
--
-- THE NUMBERS BELOW ARE NOT MEASURED. Nothing in this repo records what a
-- normal commenting rate looks like, and the ratings/comments tables are not
-- readable from an unprivileged probe, so 10 per 10 minutes and 100 per day are
-- chosen to sit far above any plausible human and far below a relay flood.
-- They are declared as two variables at the top of the function body so
-- changing them is a one-line edit against real numbers once there are some.
-- If they turn out to bite a real user, that is the measurement arriving.
--
-- EXERCISE ON STAGING: post 11 comments inside ten minutes from one account and
-- assert the 11th is refused; assert an account that has NOT hit the limit can
-- still publish a sequence afterwards, which is the regression this design
-- exists to avoid.

create table if not exists public.comment_rate_throttle (
  author_id uuid not null references auth.users(id) on delete cascade,
  commented_at timestamptz not null default now()
);

create index if not exists comment_rate_throttle_author_time_idx
  on public.comment_rate_throttle (author_id, commented_at desc);

alter table public.comment_rate_throttle enable row level security;

-- No policy at all, deliberately. The only reader and writer is the SECURITY
-- DEFINER function below, which runs as the owner and is not subject to RLS.
-- With RLS enabled and no policy, every direct client read or write returns
-- nothing -- so a commenter cannot inspect or prune their own throttle history
-- to get around it.
revoke all on public.comment_rate_throttle from public, anon, authenticated;

create or replace function public.check_comment_rate_limit(check_author_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Unmeasured. See the block comment above. Two numbers, one place.
  v_per_window integer := 10;
  v_window interval := interval '10 minutes';
  v_per_day integer := 100;

  v_recent_count integer;
  v_daily_count integer;
begin
  -- Mirrors check_post_rate_limit's first guard: a check about somebody other
  -- than the caller is not this function's business and passes, because the
  -- policy's own `auth.uid() = author_id` conjunct is what makes them the same
  -- person in practice. Kept identical so the two limiters cannot disagree
  -- about whose quota is being spent.
  if check_author_id is distinct from auth.uid() then
    return true;
  end if;

  select count(*) into v_recent_count
  from public.comment_rate_throttle
  where author_id = check_author_id
    and commented_at > now() - v_window;

  if v_recent_count >= v_per_window then
    return false;
  end if;

  select count(*) into v_daily_count
  from public.comment_rate_throttle
  where author_id = check_author_id
    and commented_at > now() - interval '1 day';

  if v_daily_count >= v_per_day then
    return false;
  end if;

  insert into public.comment_rate_throttle (author_id, commented_at)
  values (check_author_id, now());

  -- Opportunistic prune, the same 1-in-100 shape increment_view_count uses
  -- (024): this table is append-only and nothing else would ever clear it.
  if random() < 0.01 then
    delete from public.comment_rate_throttle where commented_at < now() - interval '2 days';
  end if;

  return true;
end;
$$;

comment on function public.check_comment_rate_limit(uuid) is
  'Comment rate limit, separate from check_post_rate_limit on purpose: that one consumes a PUBLISH slot on success (027:52) and only applies to accounts under 7 days old, so reusing it would throttle the wrong action and stop throttling at 7 days. Audit M8. Limits are unmeasured starting values -- 10 per 10 minutes, 100 per day, every account.';

revoke all on function public.check_comment_rate_limit(uuid) from public, anon;
grant execute on function public.check_comment_rate_limit(uuid) to authenticated;

drop policy if exists "Onboarded verified authors can comment" on public.comments;
create policy "Onboarded verified authors can comment"
on public.comments
for insert
with check (
  auth.uid() = author_id
  and public.is_verified_poster(author_id)
  and public.has_completed_onboarding(author_id)
  -- LAST in the conjunction, and that is load-bearing rather than tidy.
  -- Postgres evaluates AND left to right here and short-circuits, so a caller
  -- who fails identity or onboarding never reaches this function and never
  -- spends a throttle slot on a request that was going to be refused anyway.
  and public.check_comment_rate_limit(author_id)
);
