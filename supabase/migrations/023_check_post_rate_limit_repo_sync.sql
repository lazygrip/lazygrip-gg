-- Sync repo migration history with the live definition of check_post_rate_limit.
-- The auth.uid() defense-in-depth check (Aug 19 2026 fix, alongside the anon/PUBLIC
-- grant revocation in migration 022) was applied directly to the live database and
-- never captured in a committed migration file. check-rpc-audit.ps1 resolves "latest
-- definition" by scanning migration files, so it kept resolving to 007's pre-fix body
-- and flagging a false positive. This migration is a no-op against the live DB
-- (CREATE OR REPLACE with the exact current live body) whose only purpose is to give
-- the repo a migration file that matches what's actually running, so the audit script
-- picks up the real latest definition.

create or replace function public.check_post_rate_limit(check_author_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_age interval;
  v_recent_count integer;
  v_daily_count integer;
  v_limit_hourly integer := 1;
  v_limit_daily integer := 3;
begin
  if check_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  select now() - u.created_at into v_account_age
  from auth.users u where u.id = check_author_id;

  -- accounts under 7 days old get tighter limits
  if v_account_age is not null and v_account_age < interval '7 days' then
    select count(*) into v_recent_count
    from public.post_rate_throttle
    where author_id = check_author_id
      and posted_at > now() - interval '1 hour';

    if v_recent_count >= v_limit_hourly then
      return false;
    end if;

    select count(*) into v_daily_count
    from public.post_rate_throttle
    where author_id = check_author_id
      and posted_at > now() - interval '1 day';

    if v_daily_count >= v_limit_daily then
      return false;
    end if;
  end if;

  insert into public.post_rate_throttle (author_id, posted_at)
  values (check_author_id, now());

  if random() < 0.01 then
    delete from public.post_rate_throttle where posted_at < now() - interval '30 days';
  end if;

  return true;
end;
$$;

revoke all on function public.check_post_rate_limit(uuid) from public, anon;
grant execute on function public.check_post_rate_limit(uuid) to authenticated, service_role;
