-- 014: restrict anon access to has_completed_onboarding / has_custom_username
--
-- Both functions are SECURITY DEFINER and were callable by anon and
-- authenticated (the default grant on function creation), letting any
-- caller -- logged in or not -- check any other user's onboarding status by
-- UUID. Low-severity (boolean only, no username or other profile data
-- returned, UUIDs are not guessable), but unintended public access to the
-- same class of gap fixed for delete_sequence_version and
-- update_sequence_metadata in 010_security_definer_ownership_checks.sql.
--
-- CORRECTION: an earlier version of this migration revoked authenticated as
-- well as anon, on the reasoning that no client-side code calls either
-- function directly via supabase.rpc(). That reasoning missed that RLS
-- policies and several SECURITY DEFINER functions in
-- 009_username_onboarding_gate_wiring.sql call has_completed_onboarding()
-- internally as part of evaluating comment/rating inserts and sequence
-- publish/draft actions -- those checks run as the authenticated role, so
-- revoking authenticated broke every one of those write paths (403 on
-- comment/rating insert, and the equivalent RPC checks) until this was
-- caught and authenticated execute access was restored live the same day.
--
-- The fix that actually matches the finding: anon should not be able to
-- call these directly, but authenticated legitimately needs to, both for
-- the RLS/RPC internal calls above and because there is no narrower path
-- available for those checks to run under. anon is revoked; authenticated
-- and service_role keep execute access.

revoke all on function public.has_completed_onboarding(uuid) from public, anon;
revoke all on function public.has_custom_username(uuid) from public, anon;

grant execute on function public.has_completed_onboarding(uuid) to authenticated, service_role;
grant execute on function public.has_custom_username(uuid) to authenticated, service_role;
