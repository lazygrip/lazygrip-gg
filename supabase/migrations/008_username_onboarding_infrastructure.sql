-- 008_username_onboarding_infrastructure.sql
--
-- Foundation for the "every user must have a real username to post" policy.
-- Applied live via Supabase MCP on 2026-08-05; this file brings local
-- migrations back in sync with that session (versions 20260805175558
-- through 20260805181416 in the live migration history).
--
-- Context: handle_new_user() (see 001_initial_schema.sql) falls back to
-- 'user_' || first 8 hex chars of the uuid when OAuth metadata has no
-- usable name (observed with the Battle.net custom OAuth provider, which
-- returns no battletag/email in raw_user_meta_data). 14 of 171 existing
-- accounts carry this fallback as of 2026-08-05.

-- Checks whether a user has replaced the auto-generated fallback username
-- with something they actually chose.
create or replace function public.has_custom_username(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = check_user_id
      and p.username is not null
      and length(trim(p.username)) > 0
      and p.username !~ '^user_[0-9a-f]{8}$'
  );
$$;

comment on function public.has_custom_username(uuid) is
  'Returns true if the user has set a custom username, rather than carrying the auto-generated user_<hash> fallback assigned at signup.';

-- Tracks completion of the /welcome onboarding interstitial (set username +
-- acknowledge community guidelines). Null means not yet completed.
alter table public.profiles
add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.terms_accepted_at is
  'Timestamp when the user completed the onboarding interstitial (set a custom username and acknowledged community guidelines). Null = not yet completed.';

-- Combined check: the real posting gate. True only when both the username
-- has been customized AND the guidelines screen was acknowledged.
create or replace function public.has_completed_onboarding(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    public.has_custom_username(check_user_id)
    and exists (
      select 1 from public.profiles p
      where p.id = check_user_id
        and p.terms_accepted_at is not null
    );
$$;

comment on function public.has_completed_onboarding(uuid) is
  'True when the user has both a custom username and has acknowledged the community guidelines interstitial. This is the real posting gate -- has_custom_username() alone is necessary but not sufficient.';

-- Format constraint on new/updated usernames: blocks the auto-generated
-- pattern specifically (so nobody can set it back to look unset) and
-- enforces a sane character set matched against real existing usernames
-- (BattleTag/Discord-style handles commonly use dots, e.g. "n.cakovan").
-- NOT VALID: applies to all new writes immediately without retroactively
-- validating the 14 existing auto-generated rows, which are expected to
-- violate it until their owner sets a real username (at which point the
-- UPDATE itself is checked against this same constraint).
alter table public.profiles
drop constraint if exists profiles_username_format;

alter table public.profiles
add constraint profiles_username_format check (
  username !~ '^user_[0-9a-f]{8}$'
  and username ~ '^[A-Za-z0-9_.-]{2,32}$'
) not valid;
