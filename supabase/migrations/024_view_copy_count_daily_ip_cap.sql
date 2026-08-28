-- Adds a real daily-count column to the throttle tables (previously they only
-- tracked "last counted at", which enforces a rate limit but not a cap -- a
-- scripted caller could loop slower than the window and increment unlimited
-- times per day). Also closes the v_ip IS NULL bypass, which previously
-- incremented with zero throttling and no row recorded when x-forwarded-for
-- was absent. view_count feeds a real sort (browse-query.ts order by view_count)
-- and a >=100 "popular" badge threshold (SequenceCard.tsx), so this is a
-- ranking-integrity fix, not cosmetic.

alter table public.view_count_throttle add column if not exists count_today integer not null default 1;
alter table public.copy_count_throttle add column if not exists count_today integer not null default 1;

create or replace function public.increment_view_count(seq_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
  v_row record;
  v_daily_cap integer := 30;
begin
  v_ip := nullif(trim(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)), '');

  -- No IP available: still apply the rate/day logic using a fixed sentinel key
  -- instead of skipping throttling entirely.
  if v_ip is null then
    v_ip := 'unknown';
  end if;

  select * into v_row
  from public.view_count_throttle
  where sequence_id = seq_id and viewer_ip = v_ip;

  if v_row is null then
    insert into public.view_count_throttle (sequence_id, viewer_ip, last_counted_at, count_today)
    values (seq_id, v_ip, now(), 1);
    update public.sequences set view_count = view_count + 1 where id = seq_id;
    return;
  end if;

  -- still inside the 30-minute rate window: no-op
  if v_row.last_counted_at > now() - interval '30 minutes' then
    return;
  end if;

  -- window has passed: reset the daily counter if the last count was on a
  -- previous UTC day, otherwise keep accumulating against the daily cap
  if v_row.last_counted_at < date_trunc('day', now()) then
    update public.view_count_throttle
    set last_counted_at = now(), count_today = 1
    where sequence_id = seq_id and viewer_ip = v_ip;
    update public.sequences set view_count = view_count + 1 where id = seq_id;
    return;
  end if;

  if v_row.count_today >= v_daily_cap then
    return;
  end if;

  update public.view_count_throttle
  set last_counted_at = now(), count_today = count_today + 1
  where sequence_id = seq_id and viewer_ip = v_ip;
  update public.sequences set view_count = view_count + 1 where id = seq_id;

  if random() < 0.01 then
    delete from public.view_count_throttle where last_counted_at < now() - interval '2 days';
  end if;
end;
$$;

create or replace function public.increment_copy_count(seq_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
  v_row record;
  v_daily_cap integer := 30;
begin
  v_ip := nullif(trim(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)), '');

  if v_ip is null then
    v_ip := 'unknown';
  end if;

  select * into v_row
  from public.copy_count_throttle
  where sequence_id = seq_id and copier_ip = v_ip;

  if v_row is null then
    insert into public.copy_count_throttle (sequence_id, copier_ip, last_counted_at, count_today)
    values (seq_id, v_ip, now(), 1);
    update public.sequences set copy_count = copy_count + 1 where id = seq_id;
    return;
  end if;

  if v_row.last_counted_at > now() - interval '2 minutes' then
    return;
  end if;

  if v_row.last_counted_at < date_trunc('day', now()) then
    update public.copy_count_throttle
    set last_counted_at = now(), count_today = 1
    where sequence_id = seq_id and copier_ip = v_ip;
    update public.sequences set copy_count = copy_count + 1 where id = seq_id;
    return;
  end if;

  if v_row.count_today >= v_daily_cap then
    return;
  end if;

  update public.copy_count_throttle
  set last_counted_at = now(), count_today = count_today + 1
  where sequence_id = seq_id and copier_ip = v_ip;
  update public.sequences set copy_count = copy_count + 1 where id = seq_id;

  if random() < 0.01 then
    delete from public.copy_count_throttle where last_counted_at < now() - interval '2 days';
  end if;
end;
$$;

revoke all on function public.increment_view_count(uuid) from public;
revoke all on function public.increment_copy_count(uuid) from public;
grant execute on function public.increment_view_count(uuid) to anon, authenticated, service_role;
grant execute on function public.increment_copy_count(uuid) to anon, authenticated, service_role;
