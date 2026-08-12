-- 019_wow_build_and_export_backfill.sql
--
-- WHY THIS EXISTS
--
-- src/app/post/page.tsx writes meta.version into grip_version. meta.version is
-- the WIRE FORMAT version of the export envelope, currently 5. It is not the
-- addon version and never was. Measured on 2026-08-11 by decoding all 65
-- published exports: 29 rows hold a grip_version that disagrees with the addon
-- version recorded inside their own export, and 8 of those literally read '5'.
-- Every post made through the form repeats it.
--
-- The same envelope carries a WoW client build that the schema had nowhere to
-- put, and 13 rows carry a talent string in the export that never reached the
-- talent_string column.
--
-- PR 38 taught the two Discord post paths to read the envelope and prefer it
-- over the columns, so the forum card has been correct since 2026-08-11. The
-- site is not: the sequence page, the browse filters and the version history
-- all read the columns. This migration gives the build somewhere to live, makes
-- every write path carry it, and corrects the rows that are already wrong.
--
-- WHY 019 AND NOT 018. The design doc and every earlier note call this
-- 'migration 018'. 018_notify_on_reply.sql shipped on 2026-08-11 in bd69c90 and
-- is already on main. This repo has collided on a migration number twice, two
-- 005s and two 006s, and the cost is a file whose name no longer identifies
-- what ran. 019.
--
-- ============================================================
-- WHY THE DROPS ARE REQUIRED, NOT TIDYING
-- ============================================================
--
-- Same trap 016_publish_reslug.sql documents, five times over. In PostgreSQL
-- CREATE OR REPLACE matches on the ARGUMENT TYPE LIST, so adding a parameter
-- defines a SECOND function rather than replacing the first. Both would then be
-- live. Every existing caller passing the old argument count would match both
-- candidates and fail to resolve: 'function is not unique' from Postgres,
-- PGRST203 from PostgREST. Dropping the superseded signature leaves exactly one
-- function.
--
-- WHY p_wow_build GOES LAST, in every one of the five. A parameter with a
-- DEFAULT appended to the end keeps every existing call site resolving to the
-- same function with p_wow_build null, which is a no-op. Inserting it anywhere
-- else would silently rebind positional arguments; PostgREST calls these by
-- name, but a psql or SQL-editor caller does not have to.
--
-- WHY THE BODIES ARE COPIED RATHER THAN REWRITTEN. These are SECURITY DEFINER
-- functions and several of them exist ONLY because an ownership check was added
-- to them after the fact: 010 is entirely about restoring auth.uid() checks a
-- previous pass had missed, and 009 is entirely about wiring the onboarding
-- gate into every write path. Recreating one of these from a stale definition
-- silently reverts a security fix and nothing fails to say so. Each body below
-- is copied verbatim from the LATEST definition of that function and the only
-- edits are the wow_build ones.
--
-- Sources, which are not simply the highest migration number:
--
--   create_draft_sequence          009_username_onboarding_gate_wiring.sql
--   update_draft_sequence          009_username_onboarding_gate_wiring.sql
--   create_sequence_with_version   009_username_onboarding_gate_wiring.sql
--   update_sequence_with_version   009_username_onboarding_gate_wiring.sql
--   update_sequence_metadata       010_security_definer_ownership_checks.sql
--   publish_draft_sequence         016_publish_reslug.sql
--   publish_draft_sequences_batch  009_username_onboarding_gate_wiring.sql
--
-- ONE THING A READER WILL THINK IS A MISTAKE AND IT IS NOT. The
-- update_sequence_metadata body below carries no has_completed_onboarding
-- check, while the version of it in 009 does. That is because 010 runs AFTER
-- 009 and recreated the function without it, so the live function has not had
-- that check since 010 was applied. Copying 010 preserves live behaviour;
-- copying 009 would change it. Restoring the onboarding gate to this one
-- function is a real question and a real behaviour change, and it belongs in
-- its own migration where it can be reviewed as such, not smuggled in beside a
-- column addition.
--
-- NO GRANTS ARE ISSUED HERE. No migration in this repo grants execute on any of
-- these seven; they rely on the default. DROP plus CREATE leaves that unchanged,
-- so inventing a GRANT now would be adding a privilege, not preserving one.
--
-- ============================================================
-- THE BACKFILL AT THE BOTTOM
-- ============================================================
--
-- The values were produced on 2026-08-11 by decoding every published export
-- through this repository's own decodeExport, the same function the site and
-- the Discord routes use. 65 published rows read, 65 decoded, zero failures.
-- They are literals rather than a decode-in-SQL because Postgres cannot decode
-- a GRIP export and nothing should teach it to.
--
-- Three UPDATEs and a mirror: 29 grip_version corrections, 29 wow_build
-- additions, 13 talent_string recoveries, then one statement copying those
-- three columns onto each row's current version so the version history does not
-- disagree with the sequence it belongs to.
--
-- patch_version WAS IN AN EARLIER DRAFT OF THIS BACKFILL AND WAS REMOVED ON
-- PURPOSE. grip_version and wow_build are machine facts the envelope owns;
-- patch_version is the author's claim about which patch their sequence is FOR,
-- and an export produced on a 12.0.7 client can be deliberately labelled 12.1.
-- Seven published rows were relabelled by hand from 12.0.7 to 12.1 between
-- 19:54 and 20:17 on 2026-08-11, against exports that all still say 12.0.7, and
-- the draft backfill would have reverted every one of them minutes after this
-- migration was applied. The form change in the same PR does not read
-- envelope.wowPatch either, for the same reason. Do not add it back.
--
-- Every UPDATE is guarded on the value it expects to find, so a row edited
-- between generation and apply is skipped rather than clobbered. Those guards
-- are load-bearing; do not simplify them away. A skipped row is not a lost one:
-- the form fix shipping in this same PR corrects it the next time its author
-- saves.
--
-- IT COVERS PUBLISHED ROWS ONLY. Drafts are not reachable from the anon-key
-- read that generated these values, and they do not need to be: a draft
-- corrects itself the next time its author saves through the fixed form, which
-- is the same pass that gives it a wow_build.

-- ============================================================
-- 1. The column, on both tables
-- ============================================================
--
-- It goes on sequence_versions as well as sequences because every RPC that
-- writes grip_version writes it to both, and a version row that records the
-- addon version but not the client build it was produced against is half a
-- record. The column mirrors grip_version exactly: nullable text, no default,
-- no constraint. A build is a number today and Blizzard is under no obligation
-- to keep it one.

alter table public.sequences add column if not exists wow_build text;
alter table public.sequence_versions add column if not exists wow_build text;

-- ============================================================
-- 2. create_draft_sequence
-- ============================================================
--
-- Body copied verbatim from 009_username_onboarding_gate_wiring.sql. Writes to
-- public.sequences only; there is no sequence_versions row until publish.

DROP FUNCTION IF EXISTS public.create_draft_sequence(uuid, text, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, boolean, text);

CREATE OR REPLACE FUNCTION public.create_draft_sequence(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false, p_collection_sequences text DEFAULT NULL::text, p_wow_build text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_sequence_id uuid;
  v_raw_steps jsonb;
  v_collection_sequences jsonb;
  v_attribution_acknowledged_at timestamptz;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;
  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;
  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;
  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;
  if p_collection_sequences is null then
    v_collection_sequences := null;
  else
    v_collection_sequences := p_collection_sequences::jsonb;
  end if;
  v_attribution_acknowledged_at := case when p_attribution_acknowledged then now() else null end;
  insert into public.sequences (
    author_id, title, slug, description,
    class_id, class_name, spec_id, spec_name,
    content_type, hero_talent, patch_version, grip_version,
    step_function, step_count, grip_string, raw_steps,
    talent_string, warcraftlogs_url, performance_notes,
    original_author, attribution_acknowledged_at,
    collection_sequences,
    wow_build,
    status
  ) values (
    p_author_id, p_title, p_slug, p_description,
    p_class_id, p_class_name, p_spec_id, p_spec_name,
    p_content_type, p_hero_talent, p_patch_version, p_grip_version,
    p_step_function, p_step_count, p_grip_string, v_raw_steps,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_original_author, v_attribution_acknowledged_at,
    v_collection_sequences,
    p_wow_build,
    'draft'
  )
  returning id into v_sequence_id;
  return json_build_object(
    'sequence_id', v_sequence_id,
    'slug', p_slug
  );
end;
$function$;

-- ============================================================
-- 3. update_draft_sequence
-- ============================================================
--
-- Body copied verbatim from 009_username_onboarding_gate_wiring.sql. Updates
-- public.sequences only, for the same reason: a draft has no version row.

DROP FUNCTION IF EXISTS public.update_draft_sequence(uuid, uuid, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text DEFAULT NULL::text, p_wow_build text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_raw_steps jsonb;
  v_collection_sequences jsonb;
  v_status sequence_status;
  v_owner uuid;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;
  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;
  select status, author_id into v_status, v_owner
  from public.sequences
  where id = p_sequence_id;
  if v_owner is null then
    raise exception 'sequence not found';
  end if;
  if v_owner is distinct from auth.uid() then
    raise exception 'not the owner of this sequence';
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'sequence is not a draft, cannot update through this function';
  end if;
  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;
  if p_collection_sequences is null then
    v_collection_sequences := null;
  else
    v_collection_sequences := p_collection_sequences::jsonb;
  end if;
  update public.sequences set
    title = p_title,
    description = p_description,
    class_id = p_class_id,
    class_name = p_class_name,
    spec_id = p_spec_id,
    spec_name = p_spec_name,
    content_type = p_content_type,
    hero_talent = p_hero_talent,
    patch_version = p_patch_version,
    grip_version = p_grip_version,
    wow_build = p_wow_build,
    step_function = p_step_function,
    step_count = p_step_count,
    grip_string = p_grip_string,
    raw_steps = v_raw_steps,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes,
    collection_sequences = coalesce(v_collection_sequences, collection_sequences),
    updated_at = now()
  where id = p_sequence_id;
  return json_build_object('sequence_id', p_sequence_id);
end;
$function$;

-- ============================================================
-- 4. create_sequence_with_version
-- ============================================================
--
-- Body copied verbatim from 009_username_onboarding_gate_wiring.sql. This one
-- writes wow_build TWICE, once into sequences and once into the version row it
-- creates, because it already writes grip_version to both.

DROP FUNCTION IF EXISTS public.create_sequence_with_version(uuid, text, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.create_sequence_with_version(p_author_id uuid, p_title text, p_slug text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text, p_original_author text DEFAULT NULL::text, p_attribution_acknowledged boolean DEFAULT false, p_wow_build text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_sequence_id uuid;
  v_version_id uuid;
  v_raw_steps jsonb;
  v_attribution_acknowledged_at timestamptz;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;

  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;

  if not public.check_post_rate_limit(p_author_id) then
    raise exception 'posting rate limit reached, please try again later';
  end if;

  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;

  v_attribution_acknowledged_at := case when p_attribution_acknowledged then now() else null end;

  insert into public.sequences (
    author_id, title, slug, description,
    class_id, class_name, spec_id, spec_name,
    content_type, hero_talent, patch_version, grip_version,
    step_function, step_count, grip_string, raw_steps,
    talent_string, warcraftlogs_url, performance_notes,
    original_author, attribution_acknowledged_at,
    wow_build,
    status
  ) values (
    p_author_id, p_title, p_slug, p_description,
    p_class_id, p_class_name, p_spec_id, p_spec_name,
    p_content_type, p_hero_talent, p_patch_version, p_grip_version,
    p_step_function, p_step_count, p_grip_string, v_raw_steps,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_original_author, v_attribution_acknowledged_at,
    p_wow_build,
    'published'
  )
  returning id into v_sequence_id;

  insert into public.sequence_versions (
    sequence_id, author_id, version_number, version_label,
    grip_string, raw_steps, changelog,
    hero_talent, content_type, step_function, grip_version,
    talent_string, warcraftlogs_url, performance_notes,
    wow_build
  ) values (
    v_sequence_id, p_author_id, 1, '1.0',
    p_grip_string, v_raw_steps, p_changelog,
    p_hero_talent, p_content_type, p_step_function, p_grip_version,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_wow_build
  )
  returning id into v_version_id;

  update public.sequences
  set current_version_id = v_version_id,
      current_version_label = '1.0'
  where id = v_sequence_id;

  return json_build_object(
    'sequence_id', v_sequence_id,
    'version_id', v_version_id,
    'slug', p_slug
  );
end;
$function$;

-- ============================================================
-- 5. update_sequence_with_version
-- ============================================================
--
-- Body copied verbatim from 009_username_onboarding_gate_wiring.sql. Writes
-- wow_build to the sequences row and to the new version row, beside
-- grip_version in both.

DROP FUNCTION IF EXISTS public.update_sequence_with_version(uuid, uuid, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_sequence_with_version(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text, p_wow_build text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_version_id uuid;
  v_raw_steps jsonb;
  v_next_version_number integer;
  v_version_label text;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  if not exists (
    select 1 from public.sequences
    where id = p_sequence_id and author_id = p_author_id
  ) then
    raise exception 'Not authorised';
  end if;

  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;

  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;

  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_next_version_number
  from public.sequence_versions
  where sequence_id = p_sequence_id;

  v_version_label := '1.' || (v_next_version_number - 1)::text;

  update public.sequences set
    title = p_title,
    description = p_description,
    class_id = p_class_id,
    class_name = p_class_name,
    spec_id = p_spec_id,
    spec_name = p_spec_name,
    content_type = p_content_type,
    hero_talent = p_hero_talent,
    patch_version = p_patch_version,
    grip_version = p_grip_version,
    wow_build = p_wow_build,
    step_function = p_step_function,
    step_count = p_step_count,
    grip_string = p_grip_string,
    raw_steps = v_raw_steps,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes
  where id = p_sequence_id;

  insert into public.sequence_versions (
    sequence_id, author_id, version_number, version_label,
    grip_string, raw_steps, changelog,
    hero_talent, content_type, step_function, grip_version,
    talent_string, warcraftlogs_url, performance_notes,
    wow_build
  ) values (
    p_sequence_id, p_author_id, v_next_version_number, v_version_label,
    p_grip_string, v_raw_steps, p_changelog,
    p_hero_talent, p_content_type, p_step_function, p_grip_version,
    p_talent_string, p_warcraftlogs_url, p_performance_notes,
    p_wow_build
  )
  returning id into v_version_id;

  update public.sequences set
    current_version_id = v_version_id,
    current_version_label = v_version_label
  where id = p_sequence_id;

  return json_build_object(
    'sequence_id', p_sequence_id,
    'version_id', v_version_id,
    'version_number', v_next_version_number
  );
end;
$function$;

-- ============================================================
-- 6. update_sequence_metadata
-- ============================================================
--
-- Body copied verbatim from 010_security_definer_ownership_checks.sql, which is
-- the LATEST definition of this function and not the one in 009. See the note
-- in the header about the missing has_completed_onboarding check: it is missing
-- because 010 is missing it, and this migration is not the place to restore it.

DROP FUNCTION IF EXISTS public.update_sequence_metadata(uuid, uuid, text, text, integer, text, integer, text, text, text, text, text, text, integer, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_sequence_metadata(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_collection_sequences text DEFAULT NULL::text, p_wow_build text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_raw_steps jsonb;
  v_collection_sequences jsonb;
  v_current_version_id uuid;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  if not exists (
    select 1 from public.sequences
    where id = p_sequence_id and author_id = p_author_id
  ) then
    raise exception 'Not authorised';
  end if;

  if p_raw_steps is null then
    v_raw_steps := null;
  else
    v_raw_steps := p_raw_steps::jsonb;
  end if;

  if p_collection_sequences is null then
    v_collection_sequences := null;
  else
    v_collection_sequences := p_collection_sequences::jsonb;
  end if;

  update public.sequences set
    title = p_title,
    description = p_description,
    class_id = p_class_id,
    class_name = p_class_name,
    spec_id = p_spec_id,
    spec_name = p_spec_name,
    content_type = p_content_type,
    hero_talent = p_hero_talent,
    patch_version = p_patch_version,
    grip_version = p_grip_version,
    wow_build = p_wow_build,
    step_function = p_step_function,
    step_count = p_step_count,
    grip_string = p_grip_string,
    raw_steps = v_raw_steps,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes,
    collection_sequences = coalesce(v_collection_sequences, collection_sequences),
    updated_at = now()
  where id = p_sequence_id
  returning current_version_id into v_current_version_id;

  if v_current_version_id is not null then
    update public.sequence_versions set
      hero_talent = p_hero_talent,
      content_type = p_content_type,
      step_function = p_step_function,
      grip_version = p_grip_version,
      wow_build = p_wow_build,
      talent_string = p_talent_string,
      warcraftlogs_url = p_warcraftlogs_url,
      performance_notes = p_performance_notes
    where id = v_current_version_id;
  end if;
end;
$function$;

-- ============================================================
-- 7. publish_draft_sequence
-- ============================================================
--
-- NO DROP, AND THAT IS CORRECT HERE. This function takes no version parameters:
-- it READS the columns off the sequences row and copies them into the version
-- row it creates. So the signature is unchanged, CREATE OR REPLACE replaces the
-- function it names, and there is no second overload to strand. This and the
-- batch below are the only two of the seven where that is true.
--
-- Body copied verbatim from 016_publish_reslug.sql, which is the LATEST
-- definition and carries the p_slug remint that 009's does not.
--
-- wow_build joins grip_version in all four places it appears: the local, the
-- SELECT column list, the INTO list, and both halves of the version INSERT.

CREATE OR REPLACE FUNCTION public.publish_draft_sequence(p_sequence_id uuid, p_author_id uuid, p_changelog text DEFAULT NULL::text, p_slug text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_version_id uuid;
  v_status sequence_status;
  v_owner uuid;
  v_grip_string text;
  v_raw_steps jsonb;
  v_hero_talent text;
  v_content_type text;
  v_step_function text;
  v_grip_version text;
  v_wow_build text;
  v_talent_string text;
  v_warcraftlogs_url text;
  v_performance_notes text;
  v_title text;
  v_class_id integer;
  v_collection_sequences jsonb;
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;
  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;
  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;
  if not public.check_post_rate_limit(p_author_id) then
    raise exception 'posting rate limit reached, please try again later';
  end if;
  select status, author_id, grip_string, raw_steps, hero_talent,
         content_type, step_function, grip_version, wow_build, talent_string,
         warcraftlogs_url, performance_notes, title, class_id,
         collection_sequences
  into v_status, v_owner, v_grip_string, v_raw_steps, v_hero_talent,
       v_content_type, v_step_function, v_grip_version, v_wow_build, v_talent_string,
       v_warcraftlogs_url, v_performance_notes, v_title, v_class_id,
       v_collection_sequences
  from public.sequences
  where id = p_sequence_id;
  if v_owner is null then
    raise exception 'sequence not found';
  end if;
  if v_owner is distinct from auth.uid() then
    raise exception 'not the owner of this sequence';
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'sequence is not a draft, nothing to publish';
  end if;
  if v_title is null or trim(v_title) = '' then
    raise exception 'draft is missing a title, cannot publish';
  end if;
  if v_class_id is null then
    raise exception 'draft is missing a class, cannot publish';
  end if;

  if p_slug is not null and btrim(p_slug) <> '' then
    begin
      update public.sequences
      set slug = p_slug
      where id = p_sequence_id and slug is distinct from p_slug;
    exception when unique_violation then
      -- A publish must NEVER fail because a URL was taken. Keep the
      -- existing slug and let the publish through; a stale slug is a
      -- cosmetic problem and a failed publish is not.
      null;
    end;
  end if;

  if v_collection_sequences is not null then
    if jsonb_array_length(v_collection_sequences) = 0 then
      raise exception 'collection draft has no sequences, cannot publish';
    end if;

    update public.sequences
    set status = 'published'
    where id = p_sequence_id;

    return json_build_object(
      'sequence_id', p_sequence_id,
      'version_id', null
    );
  end if;

  if v_grip_string is null or trim(v_grip_string) = '' then
    raise exception 'draft is missing a GRIP export string, cannot publish';
  end if;
  insert into public.sequence_versions (
    sequence_id, author_id, version_number, version_label,
    grip_string, raw_steps, changelog,
    hero_talent, content_type, step_function, grip_version,
    talent_string, warcraftlogs_url, performance_notes,
    wow_build
  ) values (
    p_sequence_id, p_author_id, 1, '1.0',
    v_grip_string, v_raw_steps, p_changelog,
    v_hero_talent, v_content_type, v_step_function, v_grip_version,
    v_talent_string, v_warcraftlogs_url, v_performance_notes,
    v_wow_build
  )
  returning id into v_version_id;
  update public.sequences
  set current_version_id = v_version_id,
      current_version_label = '1.0',
      status = 'published'
  where id = p_sequence_id;
  return json_build_object(
    'sequence_id', p_sequence_id,
    'version_id', v_version_id
  );
end;
$function$;

-- ============================================================
-- 8. publish_draft_sequences_batch
-- ============================================================
--
-- NO DROP, same reason as publish_draft_sequence: it reads the columns rather
-- than taking them as parameters, so its signature does not move.
--
-- This is LIVE CODE, not a leftover. It is called from
-- src/app/profile/page.tsx line 215, the multi-select publish on the profile
-- page. Body copied verbatim from 009_username_onboarding_gate_wiring.sql.
--
-- The wow_build read lands in the SECOND loop only. The first loop validates
-- and reads nothing it does not check; the second is the one that copies the
-- sequences row into the version row.

CREATE OR REPLACE FUNCTION public.publish_draft_sequences_batch(p_sequence_ids uuid[], p_author_id uuid, p_changelog text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_sequence_id uuid;
  v_version_id uuid;
  v_status sequence_status;
  v_owner uuid;
  v_grip_string text;
  v_raw_steps jsonb;
  v_hero_talent text;
  v_content_type text;
  v_step_function text;
  v_grip_version text;
  v_wow_build text;
  v_talent_string text;
  v_warcraftlogs_url text;
  v_performance_notes text;
  v_title text;
  v_class_id integer;
  v_collection_sequences jsonb;
  v_results json[] := array[]::json[];
begin
  if p_author_id is distinct from auth.uid() then
    raise exception 'author_id does not match authenticated user';
  end if;

  if not public.is_verified_poster(p_author_id) then
    raise exception 'account not eligible to post: display name and verified sign-in required';
  end if;

  if not public.has_completed_onboarding(p_author_id) then
    raise exception 'username_required: a custom username is required to post';
  end if;

  if not public.check_post_rate_limit(p_author_id) then
    raise exception 'posting rate limit reached, please try again later';
  end if;

  if p_sequence_ids is null or array_length(p_sequence_ids, 1) is null then
    raise exception 'no sequence ids provided';
  end if;

  foreach v_sequence_id in array p_sequence_ids
  loop
    select status, author_id, title, class_id, grip_string, collection_sequences
    into v_status, v_owner, v_title, v_class_id, v_grip_string, v_collection_sequences
    from public.sequences
    where id = v_sequence_id;

    if v_owner is null then
      raise exception 'sequence % not found', v_sequence_id;
    end if;
    if v_owner is distinct from auth.uid() then
      raise exception 'not the owner of sequence %', v_sequence_id;
    end if;
    if v_status is distinct from 'draft' then
      raise exception 'sequence % is not a draft, nothing to publish', v_sequence_id;
    end if;
    if v_title is null or trim(v_title) = '' then
      raise exception 'draft % is missing a title, cannot publish', v_sequence_id;
    end if;
    if v_class_id is null then
      raise exception 'draft % is missing a class, cannot publish', v_sequence_id;
    end if;

    if v_collection_sequences is not null then
      if jsonb_array_length(v_collection_sequences) = 0 then
        raise exception 'collection draft % has no sequences, cannot publish', v_sequence_id;
      end if;
    else
      if v_grip_string is null or trim(v_grip_string) = '' then
        raise exception 'draft % is missing a GRIP export string, cannot publish', v_sequence_id;
      end if;
    end if;
  end loop;

  foreach v_sequence_id in array p_sequence_ids
  loop
    select grip_string, raw_steps, hero_talent, content_type, step_function,
           grip_version, wow_build, talent_string, warcraftlogs_url, performance_notes,
           collection_sequences
    into v_grip_string, v_raw_steps, v_hero_talent, v_content_type, v_step_function,
         v_grip_version, v_wow_build, v_talent_string, v_warcraftlogs_url, v_performance_notes,
         v_collection_sequences
    from public.sequences
    where id = v_sequence_id;

    if v_collection_sequences is not null then
      update public.sequences
      set status = 'published'
      where id = v_sequence_id;

      v_results := v_results || json_build_object(
        'sequence_id', v_sequence_id,
        'version_id', null
      );
    else
      insert into public.sequence_versions (
        sequence_id, author_id, version_number, version_label,
        grip_string, raw_steps, changelog,
        hero_talent, content_type, step_function, grip_version,
        talent_string, warcraftlogs_url, performance_notes,
        wow_build
      ) values (
        v_sequence_id, p_author_id, 1, '1.0',
        v_grip_string, v_raw_steps, p_changelog,
        v_hero_talent, v_content_type, v_step_function, v_grip_version,
        v_talent_string, v_warcraftlogs_url, v_performance_notes,
        v_wow_build
      )
      returning id into v_version_id;

      update public.sequences
      set current_version_id = v_version_id,
          current_version_label = '1.0',
          status = 'published'
      where id = v_sequence_id;

      v_results := v_results || json_build_object(
        'sequence_id', v_sequence_id,
        'version_id', v_version_id
      );
    end if;
  end loop;

  return json_build_object(
    'published_count', array_length(p_sequence_ids, 1),
    'results', array_to_json(v_results)
  );
end;
$function$;

-- ============================================================
-- 9. The backfill
-- ============================================================
--
-- Pasted verbatim from the generated file. See the header for provenance.

-- ONE-TIME BACKFILL VALUES, decoded from the stored exports on 2026-08-11.
-- Generated by decoding every published grip_string through this repo own
-- decodeExport under jiti. 65 published rows read, 65 decoded, zero failures.
--
-- patch_version IS DELIBERATELY NOT CORRECTED HERE, and an earlier draft of
-- this file did correct it. That was wrong. grip_version and wow_build are
-- machine facts: which addon version wrote the export, and which client build
-- it ran on. patch_version is an EDITORIAL field, the patch the author says
-- the sequence is for, and the two questions are not the same. Measured while
-- this migration was being written: seven rows moved from 12.0.7 to 12.1
-- between 19:54 and 20:17 on 2026-08-11, roughly half a minute apart, while
-- every one of those exports still says 12.0.7 and the live client is still
-- 12.0.7.68974. That is an author labelling their work for the new patch, and
-- a backfill keyed on the envelope would have reverted all seven.
--
-- These values are a dated snapshot and they do not need to be fresh. Every
-- UPDATE is guarded on the value it expects to find, so a row edited between
-- generation and apply is SKIPPED rather than clobbered, and the form fix that
-- ships in the same PR corrects any skipped row the next time its author
-- saves. Published rows only: drafts are not readable through the anon key
-- that generated this, and they correct themselves the same way.

-- grip_version: the column holds the WIRE FORMAT version, the export holds
-- the addon version. 29 rows disagree.
update public.sequences s set grip_version = v.new_ver
from (values
  ('anubikks-frostbane-m-mr9olkgy', '2.1.20', '2.3.5'),
  ('night-stalker-msemgiw7', '2.1.20', '2.3.3'),
  ('kohtas-retribution-paladin-super-sba-mrqg9der', '2.1.20', '2.3.10'),
  ('kohtas-balance-druid-super-sba-mrpvf10w', '2.1.20', '2.3.10'),
  ('kohtas-marksmanship-hunter-super-sba-mrucgdi1', '2.1.20', '2.3.12'),
  ('kohtas-subtlety-rogue-super-sba-mrswxcgb', '2.1.20', '2.3.12'),
  ('121-msoz7i7f', '5', '2.3.19'),
  ('kohtas-subtlety-rogue-super-sba-mrsx0a1d', '2.1.20', '2.3.12'),
  ('1-msp3dbay', '5', '2.3.19'),
  ('anubikks-msoy6uwh', '5', '2.3.19'),
  ('anubikks-destruction-warlock-diabolist-m-plus-121-ready-msjnqumq', '5', '2.3.18'),
  ('kohtas-enhancement-shaman-super-sba-mrud1kmn', '2.1.20', '2.3.12'),
  ('anubikk-mry2uxu0', '2.1.20', '2.3.14'),
  ('kohtas-frost-death-knight-super-sba-mrqg89ig', '2.1.20', '2.3.10'),
  ('itmeteemo-frost-mage-1207-mr87uiyu', '2.1.20', '2.3.5'),
  ('azeroths-ice-age-spellslinger-mrv07qa0', '2.1.20', '2.3.14'),
  ('-highlord-ret-midnight-raid-m-templar-ms0fkjij', '2.1.20', '2.3.14'),
  ('anubikk-msoxnife', '5', '2.3.19'),
  ('kohtas-windwalker-monk-super-sba-mrqgbmqi', '2.1.20', '2.3.10'),
  ('master-arcanist-spellslinger-mrv02gdw', '2.1.20', '2.3.14'),
  ('anu-msp1qw58', '5', '2.3.19'),
  ('kohtas-arms-warrior-super-sba-mrqg4d2p', '2.1.20', '2.3.10'),
  ('kohtas-elemental-shaman-super-sba-mrswuvda', '2.1.20', '2.3.12'),
  ('anubikk-msp1c6zs', '5', '2.3.19'),
  ('kohtas-arcane-mage-super-sba-mrpvhsgg', '2.1.20', '2.3.10'),
  ('kohtas-havoc-demon-hunter-super-sba-mrswrjpi', '2.1.20', '2.3.12'),
  ('anubikks-121-holy-pally-lightsmith-m-plus-msp2rojc', '5', '2.3.19'),
  ('1207-mfdoom-shadow-priest-mqzxri1u', '2.1.20', '2.2.0'),
  ('kohtas-shadow-priest-super-sba-mrpuldfm', '2.1.20', '2.3.10')
) as v(slug, old_ver, new_ver)
where s.slug = v.slug and s.grip_version is not distinct from v.old_ver;

-- wow_build: new column, 29 rows carry a build in their export envelope.
update public.sequences s set wow_build = v.build
from (values
  ('anubikks-frostbane-m-mr9olkgy', '68453'),
  ('1207-mfdoom-vengeance-demon-hunter-mql76kas', '68887'),
  ('kohtas-subtlety-rogue-super-sba-mrrpt08j', '68453'),
  ('kohtas-retribution-paladin-super-sba-mrqg9der', '68453'),
  ('kohtas-balance-druid-super-sba-mrpvf10w', '68453'),
  ('kohtas-marksmanship-hunter-super-sba-mrucgdi1', '68453'),
  ('kohtas-subtlety-rogue-super-sba-mrswxcgb', '68453'),
  ('121-msoz7i7f', '68974'),
  ('kohtas-subtlety-rogue-super-sba-mrsx0a1d', '68453'),
  ('1-msp3dbay', '68974'),
  ('anubikks-msoy6uwh', '68974'),
  ('anubikks-destruction-warlock-diabolist-m-plus-121-ready-msjnqumq', '68974'),
  ('kohtas-enhancement-shaman-super-sba-mrud1kmn', '68453'),
  ('anubikk-mry2uxu0', '68887'),
  ('kohtas-frost-death-knight-super-sba-mrqg89ig', '68453'),
  ('itmeteemo-frost-mage-1207-mr87uiyu', '68275'),
  ('azeroths-ice-age-spellslinger-mrv07qa0', '68453'),
  ('-highlord-ret-midnight-raid-m-templar-ms0fkjij', '68887'),
  ('anubikk-msoxnife', '68974'),
  ('kohtas-windwalker-monk-super-sba-mrqgbmqi', '68453'),
  ('master-arcanist-spellslinger-mrv02gdw', '68453'),
  ('anu-msp1qw58', '68974'),
  ('kohtas-arms-warrior-super-sba-mrqg4d2p', '68453'),
  ('kohtas-elemental-shaman-super-sba-mrswuvda', '68453'),
  ('anubikk-msp1c6zs', '68974'),
  ('kohtas-arcane-mage-super-sba-mrpvhsgg', '68453'),
  ('kohtas-havoc-demon-hunter-super-sba-mrswrjpi', '68453'),
  ('anubikks-121-holy-pally-lightsmith-m-plus-msp2rojc', '68974'),
  ('kohtas-shadow-priest-super-sba-mrpuldfm', '68453')
) as v(slug, build)
where s.slug = v.slug and s.wow_build is null;

-- talent_string: 13 rows carry one in the export that never reached the column.
update public.sequences s set talent_string = v.talent
from (values
  ('anubikks-frostbane-m-mr9olkgy', 'CsPAkXBWxkyfx9CbGaHonEAhLNAzMjZmZGDz2MzMzMLmZmMDGzMjBPgZMzMzMzMDAAAAAAAAAjZbgBsAWGmQGLYmhZGYGADzMAAD'),
  ('night-stalker-msemgiw7', 'CUQAAAAAAAAAAAAAAAAAAAAAAAgx2MAAAAAwsMGLTMbbjxMjZMegZmZGjZbYGbLzMzMzMjBjZ2GAAAAmhxAGzmhBGYWYhWsBDYmBzYA'),
  ('slowdogs-hunter-bm-midnight-s1-grip-m-pack-leader-st-mt-v10-mq47bnje', 'C0PApei1JmYNvFfEFaN5bWuGKAMmxwCsAzwQDbAAYGPwyMzsYGmZmZGzMMzMmhZGzMzgZGzYGMmmBAAAAAAAAMzYMgZ2QwiZBsNA'),
  ('121-msoz7i7f', 'CsPAkXBWxkyfx9CbGaHonEAhLNAzMjZMzYY2mZmZmZzMjmZMmZmZGYMzwMzMjZAAAAAAAAAYMbDMgFwywEyYBzMMzAzAYYmBAYA'),
  ('1-msp3dbay', 'CYEAVg1HmQqr1Dwlv86ljju8vCAAAAAMaW2mZmlxMmBAAAAAwMlZZGmZsNMbDzsNjZGjhZswGAmtZbmZ2aQAAALAGwAmZDYGzMbAzMDDjBD'),
  ('anubikks-msoy6uwh', 'CcEAjLzRlq54bI5v+r8Sr9Xw4jZmZmFzYmZGAAAghphZwMbLzMzMjZGzMAAAAAGLzMwWYssNbmZZYxwwMzMtRzMYDMzwwgZZmtBzMzMAYMMA'),
  ('anubikk-mry2uxu0', 'CYQARUG2fGwHkLP0T7/MoTNl/AAAAAzMbLzMGjZZZZMmhBAAAAYxMbwAGwsxEysAAz2MzMGbLm2YmZbsMjZGDLzyMzyMGzMLAAzAgZGDDD'),
  ('slowdogs-ret-midnight-s1-grip-m-templar-st-mt-v20-mq3bybrw', 'CYEAVg1HmQqr1Dwlv86ljju8vCAAAAAMa22mZmlxMzMAAAAAAmpMLzwMjthZbYmtZMGjhZsxGAAQmZaZmZbGAwGgBAjZYgZMzshlZwwYYwA'),
  ('slowdogs-unholy-dk-rider-of-the-apocalypse-grip-m-macro-v10-mqy6tyjo', 'CwPAkXBWxkyfx9CbGaHonEAhLBYmhZMmZY2mZmZaYmxMzYAAAAAAAAYmxwAglZMzsZmxMzAWMbGGyAzGDNWwAmBgxMzYGgZmZMG'),
  ('-highlord-ret-midnight-raid-m-templar-ms0fkjij', 'CYEAVg1HmQqr1Dwlv86ljju8vCAAAAAMa22mZmlxMzMDAAAAAwMlxMMzYbY2GmZbGjxYYGbsBAAkZm2mZ2mBAsBYAwYGDYmZYDLzghxMGM'),
  ('anubikk-msoxnife', 'CYQARUG2fGwHkLP0T7/MoTNl/AAAAAzMbLzMGjZZZZMmhBAAAAYxMbwAGwsxEysAAz2MzMGbLm2YmZbsMjZGDLzyMjZmxMzCAwMAYmxwwA'),
  ('anu-msp1qw58', 'C4PApei1JmYNvFfEFaN5bWuGKwCMwMGNWGQmBbAAAAAAAAAzYmZGbzYmZMDLjpZMYW22mZGmZmZmZWYmlhZGAAAzMGAmZsBGgNmZM'),
  ('anubikk-msp1c6zs', 'C4PApei1JmYNvFfEFaN5bWuGKwCMwMGNWGQmBbAAAAAAAAAzYmZGbzYmZMDGTzYYmlFzMGzMzMzMLMzywMDAAYMmZAYG2ADwGzMzA')
) as v(slug, talent)
where s.slug = v.slug and (s.talent_string is null or btrim(s.talent_string) = '');

-- Mirror the three shared columns onto each row current version, so the
-- version history does not disagree with the sequence it belongs to.
-- patch_version is absent from sequence_versions, so it does not appear here
-- either.
update public.sequence_versions sv set
  grip_version = s.grip_version,
  talent_string = s.talent_string,
  wow_build = s.wow_build
from public.sequences s
where sv.id = s.current_version_id
  and s.status = 'published';
