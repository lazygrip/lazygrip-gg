-- check-trigger-functions.sql
--
-- Proves that the nine trigger-only functions locked down by migration 048 still
-- run when their triggers fire, as a role that holds no EXECUTE on any of them.
--
-- RUN IT ONLY AGAINST THE EMPTY FROM-SCRATCH DATABASE, after apply-from-scratch.sh
-- has applied every migration:
--
--     PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres \
--       psql -d lazygrip_from_scratch -v ON_ERROR_STOP=1 -f scripts/schema-check/check-trigger-functions.sql
--
-- It inserts users, a sequence, comments, a rating and a save, so the first thing
-- it does is refuse to continue when auth.users already holds a row, which keeps
-- it away from production and from any database anyone has used. Everything runs
-- inside one transaction that ends in ROLLBACK, so nothing is left behind, not
-- even the test role.
--
-- Four of the nine triggers (on_comment_notify, on_rating_notify, trg_comment_count
-- and on_rating_change) existed in production with no file creating them until
-- 049_recover_triggers_no_migration_creates.sql, which carries the definitions
-- read from production's pg_trigger on 2026-10-17. The guarded block below creates
-- them too, inside the transaction, so this script still exercises all nine against
-- a database built before 049; once 049 has run, the guard skips it.
--
-- Exits non-zero, through RAISE EXCEPTION, on the first thing that does not hold.

\set ON_ERROR_STOP on

begin;

do $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'refusing to run: auth.users is not empty. This script is for the empty from-scratch database only.';
  end if;
end $$;

-- The four triggers 049 creates, copied from production; skipped once 049 has run.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_comment_notify' and not tgisinternal) then
    create trigger on_comment_notify after insert on public.comments
      for each row execute function public.notify_on_comment();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'on_rating_notify' and not tgisinternal) then
    create trigger on_rating_notify after insert on public.ratings
      for each row execute function public.notify_on_rating();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_comment_count' and not tgisinternal) then
    create trigger trg_comment_count after insert or delete or update on public.comments
      for each row execute function public.update_comment_count();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'on_rating_change' and not tgisinternal) then
    create trigger on_rating_change after insert or delete or update on public.ratings
      for each row execute function public.update_sequence_rating();
  end if;
end $$;

-- A role that can change rows but holds no EXECUTE on the functions. BYPASSRLS so
-- row level security is not what this tests, only the function grants.
create role trigger_tester nologin bypassrls;
grant usage on schema public, auth to trigger_tester;
grant select, insert, update, delete on all tables in schema public to trigger_tester;
grant select, insert, update on auth.users to trigger_tester;
revoke execute on all functions in schema public from trigger_tester;

-- ASSERTION 1: none of the nine is executable by PUBLIC, anon, authenticated or
-- the tester. This is what 048 changes, and it fails before 048 is applied.
do $$
declare
  fn text;
  r  text;
begin
  foreach fn in array array[
    'bump_sequence_view_daily', 'handle_new_user', 'notify_on_comment',
    'notify_on_rating', 'notify_on_reply', 'record_profile_username_alias',
    'update_comment_count', 'update_sequence_rating', 'update_sequence_save_count']
  loop
    foreach r in array array['anon', 'authenticated', 'trigger_tester'] loop
      if has_function_privilege(r, ('public.' || fn || '()')::regprocedure, 'execute') then
        raise exception 'FAIL: role % can still execute public.%()', r, fn;
      end if;
    end loop;
    if exists (
      select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = ('public.' || fn || '()')::regprocedure
        and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      raise exception 'FAIL: PUBLIC can still execute public.%()', fn;
    end if;
  end loop;
end $$;

-- ASSERTION 2: every trigger still fires and does its job, as that role.
set local role trigger_tester;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alpha@example.test', '{"user_name":"alpha"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'beta@example.test',  '{"user_name":"beta"}');

do $$
begin
  if (select count(*) from public.profiles) <> 2 then
    raise exception 'FAIL handle_new_user: expected 2 profiles, found %', (select count(*) from public.profiles);
  end if;
end $$;

update public.profiles set username = 'alpha2' where id = '00000000-0000-0000-0000-0000000000a1';
do $$
begin
  if not exists (select 1 from public.profile_aliases where old_username = 'alpha') then
    raise exception 'FAIL record_profile_username_alias: no alias row for the old username';
  end if;
end $$;

insert into public.sequences (id, author_id, title, slug, class_id, class_name, content_type)
values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1',
        'Trigger check', 'trigger-check', 11, 'Druid', 'mythic_plus');

update public.sequences set view_count = view_count + 1 where id = '00000000-0000-0000-0000-0000000000c3';
do $$
begin
  if coalesce((select sum(views) from public.sequence_view_daily
               where sequence_id = '00000000-0000-0000-0000-0000000000c3'), 0) <> 1 then
    raise exception 'FAIL bump_sequence_view_daily: sequence_view_daily did not record the view';
  end if;
end $$;

insert into public.comments (id, sequence_id, author_id, body)
values ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c3',
        '00000000-0000-0000-0000-0000000000b2', 'first comment');
insert into public.comments (id, sequence_id, author_id, parent_id, body)
values ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c3',
        '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d4', 'a reply');
do $$
begin
  if (select comment_count from public.sequences where id = '00000000-0000-0000-0000-0000000000c3') <> 2 then
    raise exception 'FAIL update_comment_count: comment_count is %',
      (select comment_count from public.sequences where id = '00000000-0000-0000-0000-0000000000c3');
  end if;
  if not exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL notify_on_comment: the sequence author got no notification';
  end if;
  if not exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b2') then
    raise exception 'FAIL notify_on_reply: the parent comment author got no notification';
  end if;
end $$;

insert into public.ratings (sequence_id, user_id, score)
values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2', 8);
do $$
begin
  if (select rating_count from public.sequences where id = '00000000-0000-0000-0000-0000000000c3') <> 1
     or (select avg_score from public.sequences where id = '00000000-0000-0000-0000-0000000000c3') <> 8 then
    raise exception 'FAIL update_sequence_rating: rating_count or avg_score did not update';
  end if;
  if (select count(*) from public.notifications
      where user_id = '00000000-0000-0000-0000-0000000000a1') < 2 then
    raise exception 'FAIL notify_on_rating: the sequence author got no rating notification';
  end if;
end $$;

insert into public.saves (sequence_id, user_id)
values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2');
do $$
begin
  if (select save_count from public.sequences where id = '00000000-0000-0000-0000-0000000000c3') <> 1 then
    raise exception 'FAIL update_sequence_save_count: save_count did not update';
  end if;
end $$;

reset role;
select 'PASS: all nine trigger functions are locked down and all nine triggers still fire' as result;

rollback;
