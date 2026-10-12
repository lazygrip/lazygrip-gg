-- 047_allow_own_placeholder_username_on_insert.sql
--
-- Fixes new Battle.net signups failing with "Database error saving new user".
--
-- Since 008 added profiles_username_format on 2026-08-05, every first-time
-- sign in through the Battle.net custom OAuth provider has been rejected by the
-- database, and the person has seen a 500 on /callback. Battle.net returns no
-- battletag, name or email in raw_user_meta_data (the live auth.users rows for
-- provider custom:battlenet carry only sub, email_verified and phone_verified),
-- so handle_new_user() falls all the way through its COALESCE to
-- 'user_' || the first 8 hex characters of the new user's id. That is the exact
-- pattern the constraint reserves, so the insert into public.profiles violates
-- the check, the transaction aborts, and the auth.users row is rolled back with
-- it. The last Battle.net account that got through was created on 2026-08-04,
-- the day before 008 was applied, and none has been created since. 008
-- anticipated the existing placeholder rows and used NOT VALID to tolerate
-- them, but it did not account for the trigger still generating new ones.
--
-- The fix is to let the constraint accept the placeholder in exactly one case,
-- which is the value handle_new_user() itself generates for that row,
-- 'user_' || substr(id::text, 1, 8). Every other username in the placeholder
-- shape stays rejected, and the character set and length rules are unchanged.
-- has_custom_username(), has_completed_onboarding(), the /welcome flow and the
-- alias trigger in 036 all keep treating the placeholder as "not yet chosen"
-- because the stored value is the same string they already look for. The
-- trigger itself is not touched.
--
-- Tradeoff, stated plainly: the constraint cannot see who is writing, so a
-- signed in user can still PATCH their own username back to their own
-- placeholder. The only effect is that they lose posting eligibility until they
-- pick a name again, so it harms nobody but themselves. They still cannot take
-- anyone else's placeholder, because each one is tied to a different id.
--
-- NOT VALID is kept so the constraint behaves exactly as before for existing
-- data. All current rows already satisfy the new definition, so a later
-- VALIDATE CONSTRAINT would succeed if anyone wants it.
--
-- To roll back, re-add the constraint with the 008 definition, which brings the
-- Battle.net signup failure back.

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format check (
    username ~ '^[A-Za-z0-9_.-]{2,32}$'
    and (
      username !~ '^user_[0-9a-f]{8}$'
      or username = 'user_' || substr(id::text, 1, 8)
    )
  ) not valid;
