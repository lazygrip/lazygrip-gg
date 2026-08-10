-- 017: per-user Discord bridge opt-out, plus the is_verified_poster grant fix 014
-- set out to make and left one function short.
--
-- PART 1: profiles.discord_bridge_opted_out
--
-- Decision 3 in the bridge design's section 8 asked whether the opt-out should be
-- per-user or per-sequence. Answered 2026-08-09: per-user, on the profile. One
-- setting covering every sequence that author owns, honoured in both directions of
-- the comment bridge. The flag belongs to the SEQUENCE OWNER, not to the person
-- writing the comment.
--
-- Default false, so the bridge stays on for every existing account and for every
-- new one. NOT NULL so that a null can only ever mean a missing profile row, which
-- is a referential anomaly rather than a preference, and the routes can tell the
-- two apart.
--
-- Read at relay time, so it governs every future relay on every sequence that
-- author owns and unwinds nothing already posted. Purging existing relayed comments
-- when the toggle flips was considered and deliberately not done: a destructive
-- bulk write driven by a checkbox needs its own RPC and its own review.
--
-- profiles SELECT is `using (true)`, so this column is publicly readable like every
-- other column on the table. That is acceptable for a bridge preference and is
-- called out here so nobody later assumes it is private.

alter table public.profiles
add column if not exists discord_bridge_opted_out boolean not null default false;

comment on column public.profiles.discord_bridge_opted_out is
  'When true, comments on this user''s sequences are not relayed to the GRIP Discord and Discord messages in their sequence threads are not relayed back to the site. Per-user, covers every sequence the user owns, read at relay time. Default false = bridge on.';

-- PART 2: is_verified_poster, the one 014 missed
--
-- is_verified_poster is SECURITY DEFINER and callable by anon, which lets any
-- caller holding the publishable key test whether an arbitrary profile uuid is
-- eligible to post. 014 revoked exactly that access from has_completed_onboarding
-- and has_custom_username and did not touch this one, though it is the same shape
-- and 014's own reasoning applies to it word for word. Severity matches what 014
-- said of its two: a boolean, no profile data returned. It is weaker here on one
-- point, because these uuids are published on every sequence row and so are not
-- unguessable the way 014 assumed.
--
-- THE authenticated GRANT IS LOAD-BEARING AND MUST NOT BE DROPPED. This is the
-- correction 014 records in its own header, and it applies harder here.
-- is_verified_poster is called inside four RLS policies:
--
--   007:534  sequences insert
--   009:27   comments insert
--   009:38   ratings insert
--   009:49   the third policy in that file
--
-- Every one of them is evaluated as the authenticated role. Revoking authenticated
-- would take the comment box, the rating control and sequence publishing down at
-- once. service_role is granted because the inbound relay route calls this function
-- explicitly through the admin client, standing in for the RLS policy the admin
-- client bypasses.

revoke all on function public.is_verified_poster(uuid) from public, anon;

grant execute on function public.is_verified_poster(uuid) to authenticated, service_role;
