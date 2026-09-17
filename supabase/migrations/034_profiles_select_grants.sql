-- 034_profiles_select_grants.sql
--
-- Audit M14, the half migration 032 deliberately did not carry.
--
--   M14  All 14 profile columns are readable by `anon`. LIVE-VERIFIED
--        2026-09-17: GET /rest/v1/profiles?select=* with the publishable key
--        returned 200 and all 14 columns, including terms_accepted_at and
--        discord_bridge_opted_out.
--
-- 032 revoked UPDATE and INSERT and left SELECT alone, and said why in its own
-- PART 0 rather than leaving the omission to be read as an oversight. That
-- reason is the whole design constraint here, so it is restated:
--
--     SELECT * expands to every column AT PARSE TIME and therefore requires
--     SELECT privilege on every column. A column-scoped SELECT grant turns
--     every `select=*` on profiles into `permission denied for table profiles`.
--
-- On main at b155435 there were SIX PostgREST reads embedding
-- `author:profiles(*)`, three of them running as `anon` on the public sequence
-- detail page, plus one anon `select` naming discord_bridge_opted_out on the
-- public profile page. Applied against that code, this file would have taken
-- the sequence pages and every profile page down together.
--
-- **THIS MIGRATION THEREFORE HAS A CODE PRECONDITION**, and it ships in the
-- same pull request as the code that satisfies it. Every one of the seven reads
-- was narrowed to an explicit column list first, each list measured from its
-- consumers rather than guessed:
--
--   lib/sequence-server.ts:46          (username, display_name)
--   SequencePageClient.tsx:308         (username, display_name)  -- same object
--   lib/sequence-server.ts:70          (username)
--   SequencePageClient.tsx:319         (username)
--   api/comments/route.ts:81           (username)
--   sequences/[slug]/update/page.tsx:98 (username)  -- reads none, kept for shape
--   user/[username]/page.tsx:90        discord_bridge_opted_out REMOVED, refetched
--                                      in an isOwnProfile-guarded query
--
-- display_name appears once because exactly one consumer reads it off an author
-- embed: sequences/[slug]/page.tsx:148 builds the JSON-LD author name as
-- `display_name || username`. Dropping it would not have errored -- it would
-- have silently degraded every sequence's structured-data author to the raw
-- username, which is the failure mode a migration cannot see.
--
-- ============================================================================
-- WHAT THIS CLOSES, AND WHAT IT DOES NOT
-- ============================================================================
--
-- CLOSED: the anon half. After this file, an unauthenticated caller cannot read
-- terms_accepted_at, discord_bridge_opted_out or updated_at from any profile,
-- and `select=*` fails outright rather than returning them.
--
-- NOT CLOSED, and this is stated rather than glossed: `authenticated` keeps
-- SELECT on terms_accepted_at and discord_bridge_opted_out for EVERY row, not
-- just its own, because the SELECT policy is `using (true)` and a column grant
-- cannot express "own row only". So a signed-in user can still read another
-- user's onboarding timestamp and bridge preference.
--
-- That is a strict improvement over "anyone on the internet can", and it is
-- where the cheap fix stops. Closing the rest means moving three own-row reads
-- behind an RPC -- middleware.ts:77, useUsernameGate.ts:48 and
-- welcome/page.tsx:44 all read `username, terms_accepted_at` for auth.uid()'s
-- own row, and get_posting_eligibility() already exists as the definer function
-- that could serve them. That is a change to the request path of every
-- authenticated page load, so it is not bundled here.
--
-- ALSO NOT GRANTED TO ANYONE: updated_at. Nothing in src reads it. It is left
-- off both lists rather than granted "just in case", because a column nobody
-- reads is the cheapest thing in this file to take away, and granting it would
-- have made the grant list a copy of the column list, which proves nothing.

do $$
declare
  -- The public profile surface. Everything user/[username]/page.tsx renders to
  -- a signed-out visitor, plus what the sitemap, the creator ranking and the
  -- author embeds need. Measured from every from('profiles').select() in src
  -- that can run as anon:
  --   user/[username]/page.tsx:54   username, display_name, bio
  --   user/[username]/page.tsx:90   the 11 below
  --   sitemap.ts:212                id, username
  --   home-stats.ts:39              id            (count head)
  --   home-stats.ts:126             id, username, display_name, avatar_url, avatar_color
  --   the six author embeds         username, display_name
  v_public text[] := array[
    'id', 'username', 'display_name',
    'avatar_url', 'avatar_color', 'banner_url',
    'bio', 'battletag', 'created_at',
    'social_links', 'featured_sequence_id'
  ];

  -- What a signed-in caller additionally needs. Both are own-row reads in
  -- practice; see the NOT CLOSED note above for why the grant is nonetheless
  -- table-wide.
  --   middleware.ts:77, useUsernameGate.ts:48, welcome/page.tsx:44
  --                                 terms_accepted_at
  --   user/[username]/page.tsx      discord_bridge_opted_out (isOwnProfile only)
  --   ProfileTabs.tsx settings tab  discord_bridge_opted_out
  v_authenticated_extra text[] := array[
    'terms_accepted_at', 'discord_bridge_opted_out'
  ];

  -- battletag STAYS PUBLIC, deliberately, and this array exists so that
  -- decision is asserted rather than implied by an absence. The audit first
  -- called a public battletag a leak and then DOWNGRADED it in PART 2 on the
  -- grounds that publishing it is the feature -- it is how people find each
  -- other in game, and the profile page renders it on purpose. Listing it here
  -- means a future reader who thinks it was forgotten finds the decision
  -- instead of re-deriving it.
  v_public_by_choice text[] := array['battletag', 'bio', 'created_at'];

  v_existing text[];
  v_anon_granting text[];
  v_auth_granting text[];
  v_missing text[];
  v_hidden_from_anon text[];
  v_col text;
  v_verified integer := 0;
begin
  -- pg_attribute, NOT information_schema.columns, for 031's and 032's reason:
  -- information_schema.columns is privilege-filtered, so an applier that is not
  -- the table owner reads a SHORT list and every assertion below silently skips
  -- what it could not see.
  select coalesce(array_agg(attname::text), array[]::text[])
  into v_existing
  from pg_attribute
  where attrelid = 'public.profiles'::regclass
    and attnum > 0
    and not attisdropped;

  if array_length(v_existing, 1) is null then
    raise exception '034: public.profiles reports no columns in pg_attribute -- refusing to grant blind.';
  end if;

  select coalesce(array_agg(c), array[]::text[]) into v_missing
  from unnest(v_public || v_authenticated_extra) as c where not (c = any(v_existing));

  if array_length(v_missing, 1) is not null then
    raise exception '034: % intended column(s) do not exist on public.profiles: %. A public page reads every name on that list, so granting a narrower set would take a rendered field away silently.',
      array_length(v_missing, 1), array_to_string(v_missing, ', ');
  end if;

  -- The decision assertion. If battletag is ever dropped or renamed, the claim
  -- in v_public_by_choice stops being about anything and this file should be
  -- re-read rather than applied.
  select coalesce(array_agg(c), array[]::text[]) into v_missing
  from unnest(v_public_by_choice) as c where not (c = any(v_public));

  if array_length(v_missing, 1) is not null then
    raise exception '034: % column(s) documented as deliberately public are not in the public grant: %. One of the two lists is wrong.',
      array_length(v_missing, 1), array_to_string(v_missing, ', ');
  end if;

  v_anon_granting := v_public;
  v_auth_granting := v_public || v_authenticated_extra;

  -- Everything the anon role must NOT end up holding. Derived from the catalog
  -- rather than written out, so a column added by a future migration is hidden
  -- from anon by DEFAULT and this assertion notices it -- which is the correct
  -- direction for a privacy grant to fail in.
  select coalesce(array_agg(c), array[]::text[]) into v_hidden_from_anon
  from unnest(v_existing) as c where not (c = any(v_anon_granting));

  -- Revoke first, then re-grant, so there is no window in which both the
  -- table-level grant and the column grants are live. A table-level REVOKE also
  -- drops the matching column-level privileges.
  execute 'revoke select on public.profiles from public';
  execute 'revoke select on public.profiles from anon';
  execute 'revoke select on public.profiles from authenticated';

  execute format(
    'grant select (%s) on public.profiles to anon',
    (select string_agg(quote_ident(c), ', ' order by c) from unnest(v_anon_granting) as c)
  );

  execute format(
    'grant select (%s) on public.profiles to authenticated',
    (select string_agg(quote_ident(c), ', ' order by c) from unnest(v_auth_granting) as c)
  );

  -- service_role keeps the whole table, asserted below rather than assumed. The
  -- four relay/notify routes read discord_bridge_opted_out through the admin
  -- client, and if service_role's SELECT had arrived via `public` the first
  -- revoke would have taken it and the Discord bridge would have started
  -- treating every author as opted out -- failing silently, in the direction
  -- that looks like a preference rather than a fault.
  execute 'grant select on public.profiles to service_role';

  -- ------------------------------------------------------------------
  -- VERIFY. has_column_privilege rather than
  -- information_schema.column_privileges, which only reports rows where a
  -- currently enabled role is grantor or grantee.
  -- ------------------------------------------------------------------
  foreach v_col in array v_hidden_from_anon loop
    if has_column_privilege('anon', 'public.profiles', v_col, 'SELECT') then
      raise exception '034: anon still holds SELECT on public.profiles.% after the revoke.', v_col;
    end if;
    v_verified := v_verified + 1;
  end loop;

  foreach v_col in array v_anon_granting loop
    if not has_column_privilege('anon', 'public.profiles', v_col, 'SELECT') then
      raise exception '034: anon did NOT receive SELECT on public.profiles.% -- the public profile page renders it.', v_col;
    end if;
  end loop;

  foreach v_col in array v_auth_granting loop
    if not has_column_privilege('authenticated', 'public.profiles', v_col, 'SELECT') then
      raise exception '034: authenticated did NOT receive SELECT on public.profiles.% -- onboarding or the settings tab reads it.', v_col;
    end if;
  end loop;

  foreach v_col in array v_existing loop
    if not has_column_privilege('service_role', 'public.profiles', v_col, 'SELECT') then
      raise exception '034: service_role lost SELECT on public.profiles.% -- the Discord bridge reads this table through the admin client and would start failing silently.', v_col;
    end if;
  end loop;

  -- 032's work must survive this file. Re-asserted here rather than trusted,
  -- because both files revoke on the same table and a mistaken `revoke all`
  -- in either one would undo the other with no error anywhere.
  if has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'UPDATE') then
    raise exception '034: authenticated holds UPDATE on terms_accepted_at -- migration 032 revoked it and something has given it back.';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'username', 'UPDATE') then
    raise exception '034: authenticated lost UPDATE on username -- migration 032 grants it and the profile editor needs it.';
  end if;

  raise notice '034: anon holds SELECT on % of % column(s), authenticated on %, service_role on all %; % column(s) verified hidden from anon (%).',
    array_length(v_anon_granting, 1),
    array_length(v_existing, 1),
    array_length(v_auth_granting, 1),
    array_length(v_existing, 1),
    v_verified,
    array_to_string(v_hidden_from_anon, ', ');
end $$;
