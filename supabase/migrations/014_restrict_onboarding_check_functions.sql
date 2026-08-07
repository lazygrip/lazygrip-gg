-- 014: restrict has_completed_onboarding / has_custom_username to service_role
--
-- Both functions are SECURITY DEFINER but were left executable by anon and
-- authenticated (the default grant on function creation), letting any
-- caller -- logged in or not -- check any other user's onboarding status by
-- UUID. Low-severity (boolean only, no username or other profile data
-- returned, UUIDs are not guessable), but unintended public access to the
-- same class of gap fixed for delete_sequence_version and
-- update_sequence_metadata in 010_security_definer_ownership_checks.sql.
--
-- No client-side caller uses supabase.rpc() for either function -- the
-- current-user onboarding check in src/lib/useUsernameGate.ts queries
-- public.profiles directly under RLS instead. Restricting to service_role
-- matches the pattern already used for lookup_profile_by_discord_id and
-- lookup_discord_id_by_user_id in 013_discord_identity_lookup_functions.sql
-- and does not change behavior for any current caller.

revoke all on function public.has_completed_onboarding(uuid) from public, anon, authenticated;
revoke all on function public.has_custom_username(uuid) from public, anon, authenticated;

grant execute on function public.has_completed_onboarding(uuid) to service_role;
grant execute on function public.has_custom_username(uuid) to service_role;
