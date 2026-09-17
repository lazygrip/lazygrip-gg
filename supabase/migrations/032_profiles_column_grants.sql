-- 032_profiles_column_grants.sql
--
-- The profiles analogue of 031. One finding, one mechanism:
--
--   F7.2  public.profiles has the identical H4 hole 031 closed for
--         public.sequences. The RLS policy restricts the ROW and places no
--         constraint on the COLUMNS, and no migration has ever issued a
--         table-level GRANT or REVOKE on this table, so `authenticated` keeps
--         Supabase's default UPDATE and INSERT grant on every column.
--
-- LIVE-VERIFIED OPEN, 2026-09-17 evening, read-only with the publishable key
-- against an all-zeroes id that matches no row:
--
--     PATCH /rest/v1/profiles?id=eq.00000000-0000-0000-0000-000000000000  -> 204
--     PATCH /rest/v1/sequences?id=eq.00000000-0000-0000-0000-000000000000 -> 42501
--
-- Same request shape, two tables, two answers. The second is 031 working. The
-- first is this file's reason to exist.
--
-- 030 put banner_url, social_links and featured_sequence_id into that writable
-- set, which is why this is also the third precondition of F7.1 (the unquoted
-- CSS url() on every public profile). PR #67 made such a value unrenderable;
-- this makes it unwritable. Neither alone is the whole fix.
--
-- ============================================================================
-- PART 0: WHAT THIS MIGRATION ASSERTS ABOUT ITSELF
-- ============================================================================
--
-- The same reasoning as 031's PART 0, kept because the two failure modes it
-- guards against are properties of this repo's history rather than of that
-- file. 026 ran ALTER FUNCTION against two signatures that did not exist, and
-- Supabase runs each migration file in one transaction, so a single wrong name
-- rolls the whole file back. 027 referenced a column that did not exist from
-- inside a function body, which plpgsql does not catch at CREATE time, so it
-- applied clean and would have thrown on the first real call.
--
-- THE CATALOG IS pg_attribute AND NOT information_schema.columns.
-- information_schema.columns is PRIVILEGE-FILTERED: it returns only columns the
-- current user owns or holds some privilege on. Read through it by an applier
-- that is not the table owner, the column list comes back SHORT, every
-- assertion gated on that list silently skips the columns it could not see, and
-- the migration reports green having verified nothing about them. A verifier
-- that can be blinded by the privileges of whoever runs it is not a verifier.
--
-- WHAT THIS FILE DOES NOT DO, stated up front so its absence is not read as an
-- oversight. It does not touch SELECT. Audit M14 (all 14 profile columns are
-- anon-readable, including terms_accepted_at and discord_bridge_opted_out) is
-- real and is NOT closed here, because closing it requires a code change this
-- file cannot carry:
--
--     SELECT * expands to every column at parse time and therefore requires
--     SELECT on every column. A column-scoped SELECT grant turns every
--     `select=*` on profiles into `permission denied for table profiles`.
--
-- MEASURED on main at b155435: SIX reads embed `author:profiles(*)` --
-- api/comments/route.ts:81, sequences/[slug]/SequencePageClient.tsx:308 and
-- :319, sequences/[slug]/update/page.tsx:98, lib/sequence-server.ts:46 and :70.
-- Three of those run as `anon` on the public sequence detail page. And
-- user/[username]/page.tsx:90 names discord_bridge_opted_out in an anon select,
-- so hiding that one column alone would make `single()` return null and send
-- every public profile page to notFound().
--
-- Confirmed live the same evening: `select=*` as anon returns all 14 columns
-- today, 200 OK. So the SELECT half is a behavioural change to the public
-- sequence and profile pages, with a different blast radius and a different
-- reviewer question from a grant revoke, and it ships as its own migration on
-- its own PR rather than riding along in this one.

-- ============================================================================
-- PART 1: terms_accepted_at is an RPC, not a column write
-- ============================================================================
--
-- This function has to exist BEFORE the grant in part 2 takes terms_accepted_at
-- away, because taking it away without a replacement breaks onboarding outright.
-- This is 031's set_sequence_status situation repeating exactly, and it was
-- found the same way: by reading every client write to the table before
-- revoking anything, rather than by trusting the audit's proposed column list.
--
-- TWO LIVE CLIENT WRITERS, both plain column PATCHes, both on main today:
--
--   src/app/welcome/page.tsx:84      { terms_accepted_at: new Date().toISOString() }
--                                    (plus username/display_name on first run)
--   src/components/PostingEligibilityChecklist.tsx:153
--                                    { terms_accepted_at: new Date().toISOString() }
--
-- and terms_accepted_at is half of the real posting gate -- 008's
-- has_completed_onboarding() is has_custom_username() AND terms_accepted_at is
-- not null. Revoking the column without this function would have left every new
-- account permanently unable to finish onboarding and therefore unable to post,
-- with the migration reporting green. That is a production outage wearing a
-- security label.
--
-- WHAT IT FIXES, which is the part the finding actually named. PART 7.3 of the
-- audit says "a user can stamp their own terms acceptance". The problem was
-- never that the user performs the acceptance -- they must, it is their
-- acceptance. It is that the TIMESTAMP was client-supplied, so it could be
-- backdated to before the terms said what they say now, and it could be
-- rewritten at any later moment. Here the value is `now()`, evaluated
-- server-side, and the identity is auth.uid() rather than an argument.
--
-- IDEMPOTENT ON PURPOSE. /welcome renders for a returning user who has a real
-- username but has not acknowledged the guidelines, and its guard lets a user
-- who HAS accepted land there again through a stale link or the back button. A
-- second call must not move the recorded timestamp, so an existing value is
-- returned unchanged rather than overwritten. The record of when someone
-- accepted is evidence; re-stamping it destroys the thing it is for.
--
-- IT DOES NOT CREATE THE ROW. handle_new_user() (001:198, superseded at 002:301)
-- inserts the profile on signup as a SECURITY DEFINER trigger. A missing row
-- means that trigger did not run, which is a real fault that should surface
-- rather than be papered over by a second insert path with different defaults.

create or replace function public.accept_terms()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_existing timestamptz;
begin
  if v_caller is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  -- Read inside a definer function, so RLS does not apply and the row is found
  -- regardless of policy. The identity comparison is therefore explicit: the
  -- only row this function will ever touch is auth.uid()'s own.
  select terms_accepted_at into v_existing
  from public.profiles
  where id = v_caller;

  if not found then
    raise exception 'No profile row for the signed-in user -- handle_new_user() did not run.'
      using errcode = 'P0002';
  end if;

  if v_existing is not null then
    return v_existing;
  end if;

  update public.profiles
  set terms_accepted_at = now()
  where id = v_caller
  returning terms_accepted_at into v_existing;

  return v_existing;
end;
$$;

comment on function public.accept_terms() is
  'Stamps terms_accepted_at for the CALLING user with a server-side now(), once. Returns the existing value unchanged if already set, so a second call through a stale /welcome link cannot move the record. Replaces the direct client-side column PATCH that /welcome and PostingEligibilityChecklist used before 2026-09-17; the column is not writable by authenticated after migration 032.';

revoke all on function public.accept_terms() from public, anon;
grant execute on function public.accept_terms() to authenticated, service_role;

-- ============================================================================
-- PART 2: column-level grants on public.profiles
-- ============================================================================
--
-- The policies, 001:24-28 restated at 002:175-181:
--
--     create policy "Profiles are viewable by everyone"
--       on public.profiles for select using (true);
--     create policy "Users can update own profile"
--       on public.profiles for update using (auth.uid() = id);
--
-- Row-scoped, column-unconstrained. ADDING `with check` WOULD DO NOTHING:
-- Postgres already reuses the USING expression as the check on UPDATE. Column
-- grants are the only mechanism that constrains which columns an RLS-permitted
-- UPDATE may touch.
--
-- THE username DECISION, made deliberately because it is the column most
-- obviously worth arguing about, and recorded here rather than in a PR comment
-- that nobody re-reads. **username stays on the UPDATE grant.** Three reasons,
-- in the order they were checked:
--
--   1. There is no RPC to move it to. PART 7 of the audit says in passing that
--      username "has an onboarding RPC". IT DOES NOT, and this is a correction
--      rather than a quibble: `git grep "\.rpc("` across src on main returns 26
--      call sites and not one of them names a username or onboarding function.
--      /welcome:100, PostingEligibilityChecklist:112 and ProfileTabs:1161 all
--      write the column with a plain .update(). Revoking it on the strength of
--      that parenthetical would have broken all three, and the parenthetical is
--      precisely the kind of claim that reads as settled and was not checked.
--
--   2. Its integrity is enforced at the DATABASE, not in the client, so a
--      direct PATCH that skips the UI gains nothing. 001:13 declares
--      `username text unique not null`, and 008:76-78 adds
--
--          profiles_username_format check (
--            username !~ '^user_[0-9a-f]{8}$'
--            and username ~ '^[A-Za-z0-9_.-]{2,32}$'
--          ) not valid
--
--      so a PATCHed username can neither collide nor carry '/', '?', '#', or a
--      space. That charset is what makes /user/[username] and the redirectTo at
--      ProfileTabs:1031 safe, and NOT VALID only exempts the rows that already
--      existed -- every new write is checked.
--
--      This is asserted below rather than trusted. 021 "was never actually
--      applied" (audit M6), so "a migration file in this repo contains it" is
--      not evidence that the live database has it. The assertion reads
--      pg_constraint and REFUSES to issue the username grant without it, which
--      makes reason 2 a gate rather than a paragraph.
--
--   3. The residual risk of a writable username is that a rename orphans every
--      link to the old one (F7.3). That is a product defect with a product
--      fix -- a profile_aliases table mirroring slug_aliases, which Jesper
--      chose on 2026-09-17 -- and a grant cannot express it.
--
-- TWO COLUMNS THE AUDIT'S PROPOSED LIST GOT WRONG, both found by reading the
-- code rather than the finding, and both in the same direction as 031's set_id:
--
--   avatar_color   MUST be granted. saveAvatarColor (ProfileTabs.tsx:1063)
--                  PATCHes it together with avatar_url from the browser. It was
--                  absent from the audit's PART 7.3 fix list, so revoking it
--                  would have broken the colour picker silently -- the write
--                  fails, the local state has already changed, and the UI shows
--                  the new colour until the next refresh.
--
--   updated_at     MUST NOT be granted, and there is no trigger to add either.
--                  Nothing in src writes it; it carries `default now()` from
--                  002:45 and is otherwise untouched. Unlike sequences, no
--                  counter RPC restamps it, so its current behaviour is
--                  "whatever the row was created with" and this migration
--                  deliberately does not change that. Making it a live
--                  modification timestamp is a feature, not a security fix.

do $$
declare
  -- Everything a creator legitimately edits about their own profile, measured
  -- from the three client write paths rather than named from the finding:
  --   ProfileTabs.tsx:1063  avatar_color, avatar_url
  --   ProfileTabs.tsx:1090  avatar_url
  --   ProfileTabs.tsx:1118  banner_url
  --   ProfileTabs.tsx:1127  banner_url
  --   ProfileTabs.tsx:1161  username, display_name, bio, battletag,
  --                         discord_bridge_opted_out, social_links,
  --                         featured_sequence_id
  --   welcome/page.tsx:100  username, display_name
  --   PostingEligibilityChecklist.tsx:112  username, display_name
  --   PostingEligibilityChecklist.tsx:136  display_name
  v_intended text[] := array[
    'username', 'display_name', 'bio', 'battletag',
    'avatar_url', 'avatar_color', 'banner_url',
    'social_links', 'featured_sequence_id',
    'discord_bridge_opted_out'
  ];

  -- Must end up NOT updatable by `authenticated`. The primary key, the two
  -- timestamps the row owns rather than the user, and the onboarding stamp that
  -- part 1 just turned into an RPC.
  v_must_stay_revoked text[] := array[
    'id', 'created_at', 'updated_at', 'terms_accepted_at'
  ];

  v_existing text[];
  v_granting text[];
  v_missing text[];
  v_absent_sensitive text[];
  v_has_username_check boolean;
  v_verified integer := 0;
  v_col text;
begin
  -- pg_attribute, NOT information_schema.columns. See PART 0.
  select coalesce(array_agg(attname::text), array[]::text[])
  into v_existing
  from pg_attribute
  where attrelid = 'public.profiles'::regclass
    and attnum > 0
    and not attisdropped;

  if array_length(v_existing, 1) is null then
    raise exception '032: public.profiles reports no columns in pg_attribute -- refusing to grant blind.';
  end if;

  -- REASON 2 OF THE username DECISION, AS A GATE. Keeping username writable is
  -- defensible only while the database itself constrains its shape. If the
  -- constraint is absent -- because 008 never applied here, the way 021 never
  -- applied (audit M6) -- then this file's own justification does not hold and
  -- it must not proceed on a premise it just disproved.
  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_username_format'
      and contype = 'c'
  ) into v_has_username_check;

  if not v_has_username_check then
    raise exception '032: constraint profiles_username_format is NOT present on public.profiles. This migration keeps username on the UPDATE grant specifically because 008 constrains its charset and uniqueness at the database; without that constraint a direct PATCH could write any string into the column that /user/<name> routes on. Apply 008, or remove username from v_intended and give it an RPC -- do not apply this file as written.';
  end if;

  select coalesce(array_agg(c), array[]::text[]) into v_granting
  from unnest(v_intended) as c where c = any(v_existing);

  select coalesce(array_agg(c), array[]::text[]) into v_missing
  from unnest(v_intended) as c where not (c = any(v_existing));

  -- A missing intended column RAISES, for 031's reason: with an unfiltered
  -- catalog read, a name here the table does not have means the schema
  -- genuinely lacks a column creators are supposed to be able to edit.
  -- Granting a narrower set silently would leave them unable to edit it with no
  -- error anywhere.
  if array_length(v_missing, 1) is not null then
    raise exception '032: % intended column(s) do not exist on public.profiles: %. Either the column list is wrong or a migration is missing -- fix one of those rather than granting a narrower set silently.',
      array_length(v_missing, 1), array_to_string(v_missing, ', ');
  end if;

  -- The reverse direction stays a notice: there is nothing to revoke from a
  -- column that does not exist. Reported rather than swallowed so the closing
  -- count cannot overstate what was checked.
  select coalesce(array_agg(c), array[]::text[]) into v_absent_sensitive
  from unnest(v_must_stay_revoked) as c where not (c = any(v_existing));

  if array_length(v_absent_sensitive, 1) is not null then
    raise notice '032: % column(s) on the must-stay-revoked list do not exist and were not checked: %',
      array_length(v_absent_sensitive, 1), array_to_string(v_absent_sensitive, ', ');
  end if;

  -- Revoke first, then re-grant the narrow set, so there is no window in which
  -- both the table-level grant and the column grants are live. A table-level
  -- REVOKE also drops the matching column-level privileges, so nothing stale
  -- survives underneath.
  execute 'revoke update, insert on public.profiles from public';
  execute 'revoke update, insert on public.profiles from anon';
  execute 'revoke update, insert on public.profiles from authenticated';

  execute format(
    'grant update (%s) on public.profiles to authenticated',
    (select string_agg(quote_ident(c), ', ' order by c) from unnest(v_granting) as c)
  );

  -- INSERT IS NOT RE-GRANTED AT ALL, and this is the one structural difference
  -- from 031. There 031 had to hand three columns back because
  -- post/page.tsx:1079 is a raw browser-client INSERT into sequences. profiles
  -- has no such path: `git grep "from('profiles')"` across src on main returns
  -- 28 sites, of which 9 are writes and every one is an .update(). Rows are
  -- created exclusively by handle_new_user(), a SECURITY DEFINER trigger on
  -- auth.users that runs as its owner and is unaffected by what `authenticated`
  -- holds.
  --
  -- Measured before revoking, so this is not an assumption about what the grant
  -- was: an anon POST /rest/v1/profiles on 2026-09-17 returned
  -- `new row violates row-level security policy for table "profiles"`, which is
  -- the POLICY refusing it -- not `permission denied`, which is what an absent
  -- grant says. The grant was there and only RLS stood in front of it. After
  -- this file the answer becomes permission denied, which is the correct answer
  -- for a capability no client has.

  -- service_role keeps everything, asserted rather than assumed. It is the
  -- admin client and does its own authorization in the routes. The revokes
  -- above name public, anon and authenticated only -- but if service_role's
  -- privilege ever arrived VIA public rather than by a direct grant, the first
  -- revoke would have taken it and every createAdminClient write to profiles
  -- would start failing with this migration reported green.
  execute 'grant update, insert on public.profiles to service_role';

  -- ------------------------------------------------------------------
  -- VERIFY THE OUTCOME. A grant that was issued is not a grant that holds.
  -- has_column_privilege rather than information_schema.column_privileges,
  -- because that view only reports rows where a currently enabled role is
  -- grantor or grantee, and this needs to be true regardless of who applies it.
  -- ------------------------------------------------------------------
  foreach v_col in array v_must_stay_revoked loop
    if v_col = any(v_existing) then
      if has_column_privilege('authenticated', 'public.profiles', v_col, 'UPDATE') then
        raise exception '032: authenticated still holds UPDATE on public.profiles.% after the revoke.', v_col;
      end if;
      if has_column_privilege('authenticated', 'public.profiles', v_col, 'INSERT') then
        raise exception '032: authenticated still holds INSERT on public.profiles.% -- no client inserts this table, so it should hold none.', v_col;
      end if;
      v_verified := v_verified + 1;
    end if;
  end loop;

  foreach v_col in array v_granting loop
    if not has_column_privilege('authenticated', 'public.profiles', v_col, 'UPDATE') then
      raise exception '032: authenticated did NOT receive UPDATE on public.profiles.% -- a creator would lose the ability to edit it.', v_col;
    end if;
  end loop;

  foreach v_col in array v_existing loop
    if has_column_privilege('authenticated', 'public.profiles', v_col, 'INSERT') then
      raise exception '032: authenticated holds INSERT on public.profiles.% -- rows are created only by handle_new_user(), so no column should be insertable.', v_col;
    end if;
    if has_column_privilege('anon', 'public.profiles', v_col, 'UPDATE')
       or has_column_privilege('anon', 'public.profiles', v_col, 'INSERT') then
      raise exception '032: anon holds UPDATE or INSERT on public.profiles.% -- it should hold neither.', v_col;
    end if;
    if not has_column_privilege('service_role', 'public.profiles', v_col, 'UPDATE')
       or not has_column_privilege('service_role', 'public.profiles', v_col, 'INSERT') then
      raise exception '032: service_role lost UPDATE or INSERT on public.profiles.% -- every admin-client write to this table would start failing.', v_col;
    end if;
  end loop;

  -- The onboarding path has to still work after the revoke above, and the only
  -- thing standing between "terms_accepted_at is off the grant" and "nobody can
  -- ever finish onboarding" is part 1's function. Assert it is callable by the
  -- role that needs it, in the same block that took the column away.
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'accept_terms' and p.pronargs = 0
  ) then
    raise exception '032: accept_terms() does not exist, but terms_accepted_at was just revoked -- onboarding would be unfinishable.';
  end if;

  if not has_function_privilege('authenticated', 'public.accept_terms()', 'EXECUTE') then
    raise exception '032: authenticated cannot EXECUTE accept_terms(), but terms_accepted_at was just revoked -- onboarding would be unfinishable.';
  end if;

  raise notice '032: authenticated holds UPDATE on % column(s) and INSERT on none; % of % sensitive column(s) verified locked; anon holds neither; service_role holds all % column(s); accept_terms() present and executable.',
    array_length(v_granting, 1),
    v_verified,
    array_length(v_must_stay_revoked, 1),
    array_length(v_existing, 1);
end $$;
