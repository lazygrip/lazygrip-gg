-- 036_profile_aliases.sql
--
-- Audit F7.3: a renamed username 404s every link to the old one.
--
-- ProfileTabs.tsx:1131-1193 lets a creator change their username freely, and the
-- only handling is a router.replace moving the current tab to the new URL. A
-- rename therefore breaks the author-profile URLs in the live sitemap, every
-- inbound link, and every /user/<name> reference in Discord history -- silently,
-- from the renamer's point of view, because their own tab follows along.
--
-- `sequences` has had the answer to this since before the audit: `slug_aliases`,
-- read by sequence-server.ts:54-62, exists precisely so "anyone who bookmarked,
-- linked, or has a Discord thread pointing at the old slug" keeps working.
-- Profiles got the rename capability and not the alias. This is not a new idea,
-- it is the existing one applied to the table that was missed.
--
-- Jesper chose this over blocking renames on 2026-09-17.
--
-- ============================================================================
-- A FINDING THIS FILE SURFACED AND DOES NOT FIX
-- ============================================================================
--
-- **`slug_aliases` IS NOT IN ANY MIGRATION IN THIS REPO.** `git grep
-- slug_aliases -- supabase/migrations` returns nothing, while the table plainly
-- exists in production -- read live on 2026-09-17, it returns rows with
-- old_slug, sequence_id and created_at. So it was created out of band, and a
-- from-scratch apply of supabase/migrations produces a database that
-- sequence-server.ts:54 queries and Postgres does not have.
--
-- That is the same class as M6 ("021 was never actually applied"), pointing the
-- other way: there, a migration existed and the schema did not follow; here, the
-- schema exists and the migration does not. It is NOT fixed here, because
-- writing a create-table for a live table from a three-column REST sample is a
-- guess about defaults, constraints, indexes and policies that would then read
-- as authoritative. It needs a pg_dump of the real definition, which is
-- @slowdog-dev's to run.
--
-- This file therefore deliberately does NOT mirror slug_aliases by reading it.
-- It is written from first principles for profiles, and the two may differ in
-- details until the dump settles what slug_aliases actually is.

create table if not exists public.profile_aliases (
  -- The old username IS the key. One name can only ever point at one profile,
  -- and the lookup is always "who used to be called this".
  old_username text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.profile_aliases is
  'Old usernames, so /user/<old-name> keeps resolving after a rename (audit F7.3). The profiles analogue of slug_aliases. Written only by the trigger below -- no client holds INSERT. A row here is NEVER authoritative over a live profiles.username: the lookup must try profiles first, because a name freed by one rename can be claimed by another account.';

create index if not exists profile_aliases_profile_id_idx
  on public.profile_aliases (profile_id);

alter table public.profile_aliases enable row level security;

drop policy if exists "Profile aliases are viewable by everyone" on public.profile_aliases;
create policy "Profile aliases are viewable by everyone"
  on public.profile_aliases for select using (true);

-- No INSERT, UPDATE or DELETE policy, and no grant for them either. Every write
-- comes from the trigger below, which is SECURITY DEFINER and runs as the owner.
-- That is not belt-and-braces: migration 032 grants `authenticated` UPDATE on
-- profiles.username, so a user can rename themselves, and if recording the alias
-- were the client's job a rename that skipped the UI would skip the alias too.
-- The trigger is the only place that CANNOT be bypassed by a direct PATCH.
revoke all on public.profile_aliases from public, anon, authenticated;
grant select on public.profile_aliases to anon, authenticated;
grant select, insert, update, delete on public.profile_aliases to service_role;

-- ============================================================================
-- The trigger, and the two cases that are not "record the old name"
-- ============================================================================
--
-- CASE 1, the reason this is not just an insert. A name freed by one rename can
-- be CLAIMED BY ANOTHER ACCOUNT. If A renames bob -> robert, 'bob' becomes an
-- alias for A. If B then takes 'bob', there is a live profile and a stale alias
-- with the same name, and the alias is now actively wrong -- it would send
-- people looking for B to A. So any alias matching a username being taken is
-- deleted, on both INSERT and UPDATE. The read path independently prefers
-- profiles over aliases, so this is the second of two defences rather than the
-- only one; a stale row would be harmless and is still not left lying around.
--
-- CASE 2, the auto-generated placeholder. handle_new_user() falls back to
-- 'user_<8 hex>' when it can derive nothing from the OAuth metadata, and 008's
-- constraint treats that pattern as reserved. Nobody ever linked to one -- an
-- account carrying it has not completed onboarding and has no public presence --
-- so recording it would permanently reserve a name that never resolved to
-- anything. The same regex 008 uses is used here, deliberately, so the two
-- cannot drift into disagreeing about what "auto-generated" means.
create or replace function public.record_profile_username_alias()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- CASE 1, both operations. Whoever is taking this name now owns it.
  if new.username is not null then
    delete from public.profile_aliases where old_username = new.username;
  end if;

  if tg_op = 'UPDATE'
     and old.username is not null
     and new.username is distinct from old.username
     -- CASE 2.
     and old.username !~ '^user_[0-9a-f]{8}$'
  then
    -- on conflict: the same old name can legitimately come back round. A
    -- renamed to bob, then away again; the newest owner of the trail wins, and
    -- created_at is refreshed so the row's age means what it says.
    insert into public.profile_aliases (old_username, profile_id)
    values (old.username, new.id)
    on conflict (old_username)
    do update set profile_id = excluded.profile_id, created_at = now();
  end if;

  return new;
end;
$$;

comment on function public.record_profile_username_alias() is
  'Records a profile''s previous username in profile_aliases on rename, and clears any alias matching a username being claimed. SECURITY DEFINER because no client role holds INSERT on profile_aliases -- migration 032 lets authenticated PATCH profiles.username directly, so a rename that skips the UI must still record the alias.';

drop trigger if exists profiles_record_username_alias on public.profiles;

-- AFTER, not BEFORE: the alias should only exist if the rename actually
-- committed. A BEFORE trigger would record an alias for a rename that 008's
-- format check or the unique index then rejected -- the statement rolls back
-- and takes the insert with it in the same transaction, true, but AFTER states
-- the intent and costs nothing.
--
-- `of username` narrows it to statements that name the column, so the ten other
-- columns 032 leaves writable -- bio, avatar_url, social_links and the rest --
-- do not fire it. Every avatar upload would otherwise run this function for
-- nothing.
create trigger profiles_record_username_alias
  after insert or update of username on public.profiles
  for each row
  execute function public.record_profile_username_alias();
