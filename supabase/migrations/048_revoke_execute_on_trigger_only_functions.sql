-- 048_revoke_execute_on_trigger_only_functions.sql
--
-- Defense in depth, same family as 037, 040, 045 and 046. Zero behavior change on
-- production: nothing the site does depends on the grants removed here.
--
-- WHAT THIS CLOSES. The Supabase security advisor lists these nine functions
-- under "Public Can Execute SECURITY DEFINER Function" and "Signed-In Users Can
-- Execute SECURITY DEFINER Function", because the default privileges on the
-- public schema gave EXECUTE to PUBLIC, anon and authenticated, which is what
-- puts a function behind /rest/v1/rpc. Every one of them returns trigger and is
-- attached to exactly one trigger, read from pg_proc and pg_trigger on
-- 2026-10-17:
--
--   bump_sequence_view_daily       on_sequence_view_count_change on sequences
--   handle_new_user                on_auth_user_created on auth.users
--   notify_on_comment              on_comment_notify on comments
--   notify_on_rating               on_rating_notify on ratings
--   notify_on_reply                on_comment_reply_notify on comments
--   record_profile_username_alias  profiles_record_username_alias on profiles
--   update_comment_count           trg_comment_count on comments
--   update_sequence_rating         on_rating_change on ratings
--   update_sequence_save_count     saves_update_sequence_save_count on saves
--
-- WHY THIS CANNOT BREAK A TRIGGER. PostgreSQL checks the EXECUTE privilege on a
-- trigger function once, when CREATE TRIGGER runs, by the role creating the
-- trigger. It does not check it again when the trigger fires, so a row change by
-- any role still runs the function. These functions are also SECURITY DEFINER,
-- so the body runs as the owner regardless of who changed the row. 045 left this
-- one for last with the note that handle_new_user sits behind signups and should
-- be tested first, so it was tested first: scripts/schema-check/check-trigger-functions.sql
-- fires every one of the nine triggers as an unprivileged role that holds no
-- EXECUTE on any of them, after this file has been applied, and reads the results
-- back. It passes with this file applied and fails without it, and it only runs
-- against the empty from-scratch database.
--
-- WHAT THIS DOES NOT TOUCH, ON PURPOSE. increment_view_count and
-- increment_copy_count are called by logged out visitors through rpc and keep
-- their grants. get_posting_eligibility, has_completed_onboarding and the other
-- functions src/ calls with .rpc() keep theirs as well, since the site depends
-- on them and each checks auth.uid() in its body. service_role keeps EXECUTE on
-- everything.
--
-- Safe to run twice: REVOKE on a privilege the role does not hold is a no-op.
--
-- Rollback, if it is ever wanted, is the same nine statements with GRANT EXECUTE
-- ... TO anon, authenticated in place of REVOKE.

revoke execute on function public.bump_sequence_view_daily()      from public, anon, authenticated;
revoke execute on function public.handle_new_user()               from public, anon, authenticated;
revoke execute on function public.notify_on_comment()             from public, anon, authenticated;
revoke execute on function public.notify_on_rating()              from public, anon, authenticated;
revoke execute on function public.notify_on_reply()               from public, anon, authenticated;
revoke execute on function public.record_profile_username_alias() from public, anon, authenticated;
revoke execute on function public.update_comment_count()          from public, anon, authenticated;
revoke execute on function public.update_sequence_rating()        from public, anon, authenticated;
revoke execute on function public.update_sequence_save_count()    from public, anon, authenticated;
