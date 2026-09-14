-- 030_creator_dashboard.sql
--
-- WHY THIS EXISTS
--
-- Slowdog's ask (2026-09-14): the public creator profile page
-- (/user/[username]) is "very generic" and creators get nothing beyond a
-- lifetime view/save/rating total. This migration adds the data side of
-- three things: a fuller-looking profile header (banner image + social
-- links + a featured sequence a creator can pin), and the two owner-only
-- dashboard pieces that need new storage rather than just a nicer query
-- against existing columns (a real day-by-day view history, since
-- sequences.view_count is only ever a lifetime total; the third piece,
-- the recent-activity feed, needs no schema change at all -- it reads the
-- existing `notifications` table, which already records "someone commented
-- on / rated / replied to you" via its existing triggers).
--
-- PART 1 -- profiles: banner, social links, featured sequence
--
-- All three are nullable/defaulted additions to an existing table, so this
-- is purely additive. featured_sequence_id is a plain FK with ON DELETE SET
-- NULL rather than a constrained/checked reference to "one of this user's
-- own published sequences" -- Postgres can't express "must belong to this
-- same row's owner and be published" as a FK or simple CHECK, so that rule
-- is enforced in application code when a creator sets it (src/app/profile
-- Settings tab), the same way plenty of other authorship rules in this
-- schema (e.g. featured sequences, current_version_id) are FK-shaped but
-- author-checked at the RPC/application layer rather than the constraint
-- layer.
alter table public.profiles
  add column if not exists banner_url text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists featured_sequence_id uuid references public.sequences(id) on delete set null;

comment on column public.profiles.social_links is
  'Flexible small object of creator-supplied external links, e.g. {"discord": "...", "twitch": "...", "youtube": "...", "twitter": "...", "website": "..."}. All keys optional; unknown keys are ignored by the UI rather than rejected, so adding a new platform later needs no migration.';

-- PART 2 -- per-day view history
--
-- sequences.view_count (bumped by increment_view_count(), see
-- 024_view_copy_count_daily_ip_cap.sql) has only ever been a single
-- lifetime counter -- there was never a way to reconstruct "views this
-- week vs last week" from it. This adds a rollup table and a trigger that
-- captures the delta every time view_count actually increases, so the
-- history starts accumulating from today forward. Past views already
-- baked into the lifetime total cannot be backfilled -- there is no record
-- of which day they happened on -- so a new creator's trend chart starts
-- at zero on the day this ships, not at their historical total.
--
-- Deliberately a trigger on sequences.view_count rather than a second
-- write bolted onto increment_view_count() itself: increment_view_count is
-- the only known caller today, but a trigger keeps this table correct
-- automatically against ANY future code path that changes view_count,
-- without needing to remember to update two places in step.
create table if not exists public.sequence_view_daily (
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  day date not null,
  views integer not null default 0,
  primary key (sequence_id, day)
);

alter table public.sequence_view_daily enable row level security;

drop policy if exists "Sequence view history viewable by the sequence's author" on public.sequence_view_daily;
create policy "Sequence view history viewable by the sequence's author"
  on public.sequence_view_daily for select
  using (exists (
    select 1 from public.sequences
    where sequences.id = sequence_view_daily.sequence_id
      and sequences.author_id = auth.uid()
  ));

-- No insert/update policy for authenticated/anon: every write to this table
-- goes through the SECURITY DEFINER trigger function below, the same
-- pattern increment_view_count() already uses to write sequences.view_count
-- regardless of the caller's own row-level permissions.
create or replace function public.bump_sequence_view_daily()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.view_count > old.view_count then
    insert into public.sequence_view_daily (sequence_id, day, views)
    values (new.id, (now() at time zone 'utc')::date, new.view_count - old.view_count)
    on conflict (sequence_id, day)
    do update set views = public.sequence_view_daily.views + excluded.views;
  end if;
  return new;
end;
$$;

drop trigger if exists on_sequence_view_count_change on public.sequences;
create trigger on_sequence_view_count_change
  after update of view_count on public.sequences
  for each row
  execute function public.bump_sequence_view_daily();

-- PART 3 -- storage bucket for banner images
--
-- Mirrors the existing (dashboard-created, not migration-tracked) `avatars`
-- bucket and its "own file only" policy exactly -- same public-read /
-- owner-write shape, same filename convention ({auth.uid()}.{ext}), just a
-- separate bucket so a banner upload can never collide with or overwrite a
-- user's avatar file. Slightly larger size cap (5MB vs avatars' 2MB) since
-- a banner is a much bigger visible area.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Banner full access for authenticated" on storage.objects;
create policy "Banner full access for authenticated"
  on storage.objects for all
  using (bucket_id = 'banners' and storage.filename(name) like (auth.uid())::text || '.%')
  with check (bucket_id = 'banners' and storage.filename(name) like (auth.uid())::text || '.%');
