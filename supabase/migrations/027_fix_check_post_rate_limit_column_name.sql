-- 026_search_path_hardening_and_rate_limit_ownership.sql introduced a
-- check_post_rate_limit body that referenced post_rate_throttle.created_at.
-- The table's actual timestamp column (confirmed live via
-- information_schema.columns, not assumed from the 07-31 audit's prose
-- description of the table) is posted_at. plpgsql does not validate embedded
-- SQL against the real schema at CREATE FUNCTION time -- only at first
-- execution -- so 026 applied with no error and this would have thrown on the
-- very first real call (every publish attempt from an account under 7 days
-- old). Caught in the same session as 026, before any user hit it, by
-- re-querying information_schema instead of trusting the description.
create or replace function public.check_post_rate_limit(check_author_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_age interval;
  v_recent_count integer;
  v_daily_count integer;
begin
  if check_author_id is distinct from auth.uid() then
    return true;
  end if;

  select now() - created_at into v_account_age
  from auth.users
  where id = check_author_id;

  if v_account_age is null or v_account_age >= interval '7 days' then
    return true;
  end if;

  select count(*) into v_recent_count
  from public.post_rate_throttle
  where author_id = check_author_id
    and posted_at > now() - interval '1 hour';

  if v_recent_count >= 1 then
    return false;
  end if;

  select count(*) into v_daily_count
  from public.post_rate_throttle
  where author_id = check_author_id
    and posted_at > now() - interval '1 day';

  if v_daily_count >= 3 then
    return false;
  end if;

  insert into public.post_rate_throttle (author_id, posted_at)
  values (check_author_id, now());

  return true;
end;
$$;

revoke all on function public.check_post_rate_limit(uuid) from public, anon;
grant execute on function public.check_post_rate_limit(uuid) to authenticated;
