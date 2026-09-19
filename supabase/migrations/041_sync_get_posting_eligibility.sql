-- 041_sync_get_posting_eligibility.sql
--
-- WHY THIS EXISTS. public.get_posting_eligibility is live in production and no
-- migration in this repo creates it, so a rebuild from scratch produces a database
-- where the two callers under src/ resolve to nothing. Production applied it as the
-- CLI migration 20260823023857 add_get_posting_eligibility_rpc, which has no file
-- here. Same shape as 038's slug_aliases recovery.
--
-- PROVENANCE. Body supplied by @slowdog-dev on issue #78, read off production.
-- Verified against the live API before this was written:
--
--     POST /rpc/get_posting_eligibility {check_user_id}           200  []
--     POST /rpc/get_posting_eligibility {check_user_id, p_extra}  404  PGRST202
--     POST /rpc/has_completed_onboarding {check_user_id}          401  42501   CONTROL
--
-- The second call proves the arity is exactly one. The third is the control that
-- makes the first meaningful: a function revoked from anon still answers 42501.
--
-- THE GRANTS, and why there are two statements rather than one.
--
-- The original migration granted EXECUTE to authenticated and revoked it from anon.
-- The revoke never took effect, because Postgres grants EXECUTE on a new function to
-- PUBLIC at creation time and the original never revoked THAT. anon inherits through
-- PUBLIC like every other role, which is why the probe above answers 200 rather than
-- 401 while the control answers 401. Diagnosis from @slowdog-dev, and it is the only
-- explanation consistent with the measurement.
--
-- The grant line is not decoration. From scratch, this file is what creates the
-- function, and the original grant lives in a CLI migration with no file here, so
-- without it authenticated would end up holding nothing and the two callers would
-- break on a rebuilt database.
--
-- ONE CONSEQUENCE TO BE AWARE OF: revoking from PUBLIC also removes what service_role
-- was inheriting through it. Nothing calls this function as service_role. The only two
-- callers are PostingEligibilityChecklist.tsx and useUsernameGate.ts, both browser
-- clients running as authenticated. No service_role grant is added here, so if that
-- role is expected to keep EXECUTE it has to be granted deliberately.

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

grant execute on function public.get_posting_eligibility(uuid) to authenticated;
revoke execute on function public.get_posting_eligibility(uuid) from public;
