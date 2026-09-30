-- 043_fix_publish_sequence_version_collection_type.sql
--
-- WHAT THIS FIXES
--
-- Reported 2026-09-29: /sequences/kayaans-elemental-shaman-far-seer-st-aoe-mt-mulb32wq
-- would not load -- Chrome showed a blank "This page couldn't load" state.
-- MEASURED via console: a client-side exception, `TypeError: tj.map is not
-- a function`, thrown inside SequencePageClient.tsx's collection-tab render
-- (the minified call is collectionEntries.map(...) at what is line 1375 in
-- the current source). MEASURED against the database: this sequence's
-- sequence_versions row (version 1) has collection_sequences stored as a
-- jsonb STRING (jsonb_typeof = 'string') instead of a jsonb array, while
-- the parent sequences row's own collection_sequences is a correctly typed
-- array. A jsonb string has no .map method, which is exactly the crash.
--
-- ROOT CAUSE, traced to 028_collection_sequence_versioning.sql
--
-- publish_sequence_version's p_collection_sequences parameter is declared
-- `jsonb`. The one caller, src/app/sequences/[slug]/update/page.tsx:498,
-- sends `JSON.stringify(collectionPayload)` -- a JS string, matching the
-- convention every OTHER function in this codebase that takes collection
-- data uses (update_draft_sequence, update_sequence_metadata, and the
-- draft side of publish_draft_sequence all declare this parameter as
-- `text` and cast it with `p_collection_sequences::jsonb` inside the
-- function body, which PARSES the string into a real array). Because this
-- one function instead types the parameter as `jsonb` directly, PostgREST
-- hands Postgres a JSON value that already looks like a plain string, and
-- casting a JSON string to jsonb does not parse it -- it wraps it as a
-- jsonb scalar string. The corrupted value lands in both the new
-- sequence_versions row (permanently -- version history is never rewritten
-- after the fact) and, transiently, the parent sequences row, though the
-- parent row is fixed the moment any other call (an edit via
-- update_sequence_metadata, which uses the correct text+cast pattern)
-- touches it again. That is why this bug hid for a while: the parent row
-- self-heals on the next edit, the version-history row does not.
--
-- MEASURED SCOPE as of 2026-09-29: every sequence_versions row with a
-- non-null collection_sequences was checked. Kayaan's version 1 is the
-- only one stored as a string; the others (mfdoom's Fury Warrior v2,
-- Slowdog's BM Hunter and Ret Paladin collection versions) all show
-- collection_sequences = null on their version rows, meaning those
-- particular publish_sequence_version calls happened to pass null for it
-- rather than a real payload, so they never hit this path. This is the
-- first known case of an actual collection payload going through
-- publish_sequence_version, and the bug was there from 028 onward for any
-- call that does.
--
-- THE FIX. Change the parameter to `text`, matching every sibling
-- function, and parse it inside the body before use, matching 019's own
-- pattern (`if p_collection_sequences is null then ... else
-- p_collection_sequences::jsonb`). Everything else in the function is
-- unchanged. This migration does not repair Kayaan's already-corrupted
-- version-1 row -- that is a one-row data fix, handled separately, not a
-- schema change replayable from scratch.
--
-- APPLIED BY HAND, VERIFIED 2026-09-30. This was run in the Supabase SQL
-- editor on 2026-09-29, so it has no row in supabase_migrations. The original
-- SQL text was not kept anywhere recoverable. What IS verified, by hashing
-- prosrc against the body below with comments removed: the live function body
-- is identical to this file's. The comments in this file are not in prod, and
-- prod currently has no COMMENT ON FUNCTION for this function either.
--
-- SEARCH_PATH IS CARRIED FORWARD DELIBERATELY. 028's own definition set
-- search_path to 'public' (not 'public, pg_temp' -- that broader pinning
-- was 026's convention applied to other functions, never applied here).
-- Preserved as-is; changing it is out of scope for this fix.

DROP FUNCTION IF EXISTS public.publish_sequence_version(uuid, integer, text, text, jsonb, text, uuid, text, text, text, text, text, text, text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.publish_sequence_version(p_sequence_id uuid, p_version_number integer, p_version_label text, p_grip_string text, p_raw_steps jsonb, p_changelog text, p_author_id uuid, p_hero_talent text, p_content_type text, p_step_function text, p_grip_version text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_actions jsonb DEFAULT NULL::jsonb, p_collection_sequences text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new_version_id uuid;
  v_owner uuid;
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

  select author_id into v_owner
  from public.sequences
  where id = p_sequence_id;

  if v_owner is null then
    raise exception 'sequence not found';
  end if;

  if v_owner is distinct from auth.uid() then
    raise exception 'not the owner of this sequence';
  end if;

  -- Parse rather than pass through raw, same reasoning as
  -- 019_wow_build_and_export_backfill.sql: a text parameter holding
  -- JSON.stringify'd content has to go through ::jsonb to actually become
  -- the array it looks like, or it stores as a jsonb scalar string instead.
  if p_collection_sequences is null or btrim(p_collection_sequences) = '' then
    v_collection_sequences := null;
  else
    v_collection_sequences := p_collection_sequences::jsonb;
  end if;

  insert into sequence_versions (
        sequence_id,
        version_number,
        version_label,
        grip_string,
        raw_steps,
        actions,
        collection_sequences,
        changelog,
        author_id,
        hero_talent,
        content_type,
        step_function,
        grip_version,
        talent_string,
        warcraftlogs_url,
        performance_notes
      )
  values (
        p_sequence_id,
        p_version_number,
        p_version_label,
        p_grip_string,
        p_raw_steps,
        p_actions,
        v_collection_sequences,
        p_changelog,
        p_author_id,
        p_hero_talent,
        p_content_type,
        p_step_function,
        p_grip_version,
        p_talent_string,
        p_warcraftlogs_url,
        p_performance_notes
      )
  returning id into v_new_version_id;

  update sequences
  set
    current_version_id = v_new_version_id,
    current_version_label = p_version_label,
    grip_string = p_grip_string,
    raw_steps = p_raw_steps,
    actions = p_actions,
    collection_sequences = v_collection_sequences,
    hero_talent = p_hero_talent,
    content_type = p_content_type,
    step_function = p_step_function,
    grip_version = p_grip_version,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes,
    updated_at = now()
  where id = p_sequence_id;

  return v_new_version_id;
end;
$function$;

comment on function public.publish_sequence_version(uuid, integer, text, text, jsonb, text, uuid, text, text, text, text, text, text, text, jsonb, text) is
  'Publishes a new version of an already-published sequence, including collections (028). p_collection_sequences takes text and parses it with ::jsonb (043) -- the previous jsonb-typed parameter stored the client''s JSON.stringify payload as a double-encoded jsonb string rather than an array, crashing the collection-tab UI with X.map is not a function the first time an author published a new version of a collection sequence with real collection data. See 043 header for the kayaans-elemental-shaman case that exposed it.';
