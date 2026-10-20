-- 049_recover_triggers_no_migration_creates.sql
--
-- Recovers four triggers that exist in production and are created by no
-- migration in this repo. 002 defines the four trigger FUNCTIONS and says in
-- its closing NOTE that the `create trigger` statements binding them were not
-- queried, so a database rebuilt from supabase/migrations has the functions
-- and never fires them: no comment_count, no rating average, and neither the
-- comment nor the rating notification. Issue #91.
--
-- PROVENANCE. The definitions were read from production's pg_trigger on
-- 2026-10-17 by @slowdog-dev for PR #98, which locked down the nine
-- trigger-only functions (048) and wrote scripts/schema-check/
-- check-trigger-functions.sql, the test that fires every trigger. That script
-- had to create these four itself, inside its own rolled-back transaction, to
-- exercise them at all, and named the gap as this issue's to close. The four
-- statements below are those definitions, each behind the guard the script
-- uses, narrowed to the table the trigger belongs to, so on production, where
-- all four exist, this file is a no-op. The other five triggers in 048's list
-- are created by 001 (on_auth_user_created), 018 (on_comment_reply_notify),
-- 020 (saves_update_sequence_save_count), 030 (on_sequence_view_count_change)
-- and 036 (profiles_record_username_alias).
--
-- WHY A GUARD AND NOT `create or replace trigger`. The or-replace form would
-- overwrite production's binding with this text on apply; the guard leaves a
-- production trigger exactly as it is and only fills the gap on a database
-- that lacks it, which is the pattern 038 uses for slug_aliases.
--
-- The functions are 002's notify_on_comment() and notify_on_rating(), and
-- update_comment_count() and update_sequence_rating() as 037 last defined
-- them. A trigger binds the function by name, so it fires whichever
-- definition is current, which is also how production behaves.
--
-- VERIFIED on an empty PostgreSQL 16: apply-from-scratch.sh applies every
-- migration clean with this file included, pg_trigger then holds all four,
-- and check-trigger-functions.sql, whose guard skips its own creation of
-- these four once they exist, reports PASS.

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_comment_notify' and tgrelid = 'public.comments'::regclass and not tgisinternal
  ) then
    create trigger on_comment_notify after insert on public.comments
      for each row execute function public.notify_on_comment();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_rating_notify' and tgrelid = 'public.ratings'::regclass and not tgisinternal
  ) then
    create trigger on_rating_notify after insert on public.ratings
      for each row execute function public.notify_on_rating();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_comment_count' and tgrelid = 'public.comments'::regclass and not tgisinternal
  ) then
    create trigger trg_comment_count after insert or delete or update on public.comments
      for each row execute function public.update_comment_count();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_rating_change' and tgrelid = 'public.ratings'::regclass and not tgisinternal
  ) then
    create trigger on_rating_change after insert or delete or update on public.ratings
      for each row execute function public.update_sequence_rating();
  end if;
end $$;

-- The outcome is asserted rather than assumed, as 031 and 046 do for grants.
do $$
declare
  v_found integer;
begin
  select count(*) into v_found
  from pg_trigger
  where not tgisinternal
    and (
      (tgname = 'on_comment_notify' and tgrelid = 'public.comments'::regclass) or
      (tgname = 'on_rating_notify'  and tgrelid = 'public.ratings'::regclass)  or
      (tgname = 'trg_comment_count' and tgrelid = 'public.comments'::regclass) or
      (tgname = 'on_rating_change'  and tgrelid = 'public.ratings'::regclass)
    );
  if v_found <> 4 then
    raise exception '049: expected the four recovered triggers to exist after this file, found %', v_found;
  end if;
  raise notice '049: on_comment_notify, on_rating_notify, trg_comment_count and on_rating_change are present.';
end $$;
