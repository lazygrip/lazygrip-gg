-- 006: increment_view_count anonymous rate limit
--
-- increment_view_count had no auth requirement and no rate limit -- any anon
-- caller could inflate a sequence's view_count arbitrarily by calling the RPC
-- repeatedly (it's invoked client-side directly from
-- src/app/sequences/[slug]/SequencePageClient.tsx on every sequence page load,
-- supabase.rpc('increment_view_count', ...), with no API route in front of it).
-- Flagged as optional/low-priority in both our
-- tracker (Q3) and Slowdog's own SECURITY_AUDIT_2026-07-22.md ("only matters
-- if view counts ever feed a trending/sort mechanic"). Shipping now per
-- Jesper's go-ahead.
--
-- Approach: rate-limit by caller IP, taken from the x-forwarded-for header
-- PostgREST exposes via the request.headers setting -- one counted view per
-- (sequence, IP) per 30 minutes. If the IP can't be determined for any reason
-- (direct DB access, missing header, PostgREST config difference, etc), this
-- fails OPEN: the view still gets counted, same as today, rather than
-- silently dropping a legitimate visit. Worth Slowdog confirming the header
-- actually populates in his deployment (view a sequence page anonymously,
-- check view_count_throttle picks up a row) since Cowork can't test this live.
--
-- New view_count_throttle table is RLS-enabled with zero policies, so it's
-- reachable only from inside this SECURITY DEFINER function, never directly
-- by anon/authenticated PostgREST clients. Self-prunes rows older than a day
-- on ~1% of calls so the table doesn't grow unbounded -- rows are only
-- functionally useful for 30 minutes anyway.
--
-- language changes from sql to plpgsql (needed for the conditional logic);
-- the actual view_count update statement is unchanged from the original.

create table if not exists public.view_count_throttle (
  sequence_id uuid not null,
  viewer_ip text not null,
  last_counted_at timestamptz not null default now(),
  primary key (sequence_id, viewer_ip)
);

alter table public.view_count_throttle enable row level security;

create or replace function public.increment_view_count(seq_id uuid)
returns void
language plpgsql
security definer
as $function$
declare
  v_ip text;
  v_recently_counted boolean;
begin
  v_ip := nullif(trim(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)), '');

  if v_ip is null then
    update public.sequences set view_count = view_count + 1 where id = seq_id;
    return;
  end if;

  select exists (
    select 1 from public.view_count_throttle
    where sequence_id = seq_id
      and viewer_ip = v_ip
      and last_counted_at > now() - interval '30 minutes'
  ) into v_recently_counted;

  if v_recently_counted then
    return;
  end if;

  update public.sequences set view_count = view_count + 1 where id = seq_id;

  insert into public.view_count_throttle (sequence_id, viewer_ip, last_counted_at)
  values (seq_id, v_ip, now())
  on conflict (sequence_id, viewer_ip)
  do update set last_counted_at = now();

  if random() < 0.01 then
    delete from public.view_count_throttle where last_counted_at < now() - interval '1 day';
  end if;
end;
$function$;
