-- Discord bridge: identity lookup functions.
--
-- The application's service-role key talks to Postgres through PostgREST,
-- which only exposes whitelisted schemas. auth.identities is not
-- necessarily one of them (and should not be made so just for this), so we
-- provide two narrow SECURITY DEFINER functions instead of querying
-- auth.identities directly from application code. Each function answers
-- exactly one lookup and returns only the fields the relay-identity
-- endpoint needs -- nothing here allows listing or enumerating identities.
--
-- SECURITY DEFINER is required here, not SECURITY INVOKER, because the
-- calling role (service_role via PostgREST RPC) does not itself have SELECT
-- on auth.identities -- only the function owner does. This mirrors the
-- ownership-check pattern already used elsewhere in this schema.

create or replace function public.lookup_profile_by_discord_id(p_discord_id text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from auth.identities i
  join public.profiles p on p.id = i.user_id
  where i.provider = 'discord'
    and i.provider_id = p_discord_id
  limit 1;
$$;

create or replace function public.lookup_discord_id_by_user_id(p_user_id uuid)
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select i.provider_id
  from auth.identities i
  where i.provider = 'discord'
    and i.user_id = p_user_id
  limit 1;
$$;

-- Only the service role (used by server-side API routes with the service
-- role key, never exposed to the browser) may call these. Explicitly revoke
-- from anon and authenticated so a future RLS or grant change elsewhere
-- can't accidentally make these callable from client-side code.
revoke all on function public.lookup_profile_by_discord_id(text) from public, anon, authenticated;
revoke all on function public.lookup_discord_id_by_user_id(uuid) from public, anon, authenticated;
grant execute on function public.lookup_profile_by_discord_id(text) to service_role;
grant execute on function public.lookup_discord_id_by_user_id(uuid) to service_role;
