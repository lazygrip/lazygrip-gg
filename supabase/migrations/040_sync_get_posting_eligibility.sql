-- 040_sync_get_posting_eligibility.sql
--
-- WHY THIS EXISTS. public.get_posting_eligibility is live in production and no
-- migration in this repo creates it, so a rebuild from scratch produces a database
-- where nine call sites under src/ resolve to nothing. Production applied it as the
-- CLI migration 20260823023857 add_get_posting_eligibility_rpc, which has no file
-- here. Same shape as 038's slug_aliases recovery.
--
-- PROVENANCE. Body supplied by @slowdog-dev on issue #78, 2026-09-18, read off
-- production. Verified against the live API the same day before this was written:
--
--     POST /rpc/get_posting_eligibility {check_user_id}           200  []
--     POST /rpc/get_posting_eligibility {check_user_id, p_extra}  404  PGRST202
--     POST /rpc/has_completed_onboarding {check_user_id}          401  42501   CONTROL
--
-- The second call proves the arity is exactly one. The third is the control that
-- makes the first meaningful: a function revoked from anon still answers 42501.
--
-- ON THE ANON GRANT. Anon holds EXECUTE in production, which contradicts the
-- grant lines quoted on issue #78. That contradiction is real and is tracked
-- separately. It is not a hole: the function is SECURITY DEFINER and self-gates in
-- its final WHERE clause on auth.uid(), so an anonymous caller gets an empty set.
-- This migration deliberately asserts NO grants, because production and the issue
-- disagree about what they should be and picking one here would bury the question.

CREATE OR REPLACE FUNCTION public.get_posting_eligibility(check_user_id uuid)
 RETURNS TABLE(has_username boolean, has_accepted_terms boolean, has_display_name boolean, email_or_oauth_confirmed boolean, account_age_ok boolean, minutes_until_eligible integer, eligible boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select
    public.has_custom_username(check_user_id) as has_username,
    exists (
      select 1 from public.profiles p
      where p.id = check_user_id and p.terms_accepted_at is not null
    ) as has_accepted_terms,
    exists (
      select 1 from public.profiles p
      where p.id = check_user_id
        and p.display_name is not null
        and length(trim(p.display_name)) > 0
    ) as has_display_name,
    exists (
      select 1 from auth.users u
      where u.id = check_user_id
        and (u.email_confirmed_at is not null or u.last_sign_in_at is not null)
    ) as email_or_oauth_confirmed,
    exists (
      select 1 from auth.users u
      where u.id = check_user_id
        and u.created_at < now() - interval '60 minutes'
    ) as account_age_ok,
    greatest(
      0,
      ceil(
        extract(epoch from (
          (select u.created_at from auth.users u where u.id = check_user_id) + interval '60 minutes' - now()
        )) / 60
      )
    )::integer as minutes_until_eligible,
    (
      public.has_completed_onboarding(check_user_id)
      and public.is_verified_poster(check_user_id)
    ) as eligible
  where check_user_id = (select auth.uid());
$function$;
