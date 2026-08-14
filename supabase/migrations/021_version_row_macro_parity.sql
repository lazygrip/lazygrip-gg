-- 021_version_row_macro_parity.sql
--
-- WHY THIS EXISTS
--
-- update_sequence_metadata writes grip_string and raw_steps to
-- public.sequences, and then updates the row's CURRENT version with eight
-- columns: hero_talent, content_type, step_function, grip_version, wow_build,
-- talent_string, warcraftlogs_url and performance_notes. grip_string and
-- raw_steps are not among them.
--
-- So a "Minor edit" that changes the macro leaves
-- sequence_versions.grip_string holding the PREVIOUS export while
-- sequences.grip_string holds the new one, for the version the site itself
-- labels current. Nothing reports it.
--
-- IT IS USER-VISIBLE, which is why this is worth a migration. The sequence
-- page reads every version row (src/lib/sequence-server.ts and
-- SequencePageClient.tsx both select * from sequence_versions) and renders a
-- version picker over them. A reader who selects the current version is handed
-- the export the version row holds, so on a drifted row they copy a macro the
-- author replaced.
--
-- MEASURED AGAINST PRODUCTION ON 2026-08-14, through the anon key, with
-- bin/lazygrip_audit.py --drift in Tools/chromeserver:
--
--     published rows                           65
--     with a current_version_id                51
--     without one (collections)                14
--     current version unreadable                0
--     compared                                 51
--     grip_string disagrees                    10
--     raw_steps disagrees                      18
--     either disagrees                         19
--
-- The two counts differ because raw_steps has a second source of drift. It is
-- re-derived by the form on every save, so a row can pick up a differently
-- shaped steps array without its export changing at all, and six of the
-- eighteen were last touched in May and June, before the current form. Both
-- kinds are fixed the same way.
--
-- WHY 021 AND NOT 020. Every earlier note about this work calls it "migration
-- 020". 020_save_count_trigger_and_backfill.sql is already on main, in commit
-- 165d642. This repo has collided on a migration number twice, two 005s and
-- two 006s, and the cost is a file whose name no longer identifies what ran.
-- 021.
--
-- ============================================================
-- WHY THERE IS NO DROP HERE, UNLIKE FIVE OF THE SEVEN IN 019
-- ============================================================
--
-- 019 had to drop before creating because it ADDED a parameter, and in
-- PostgreSQL CREATE OR REPLACE matches on the argument type list: a new
-- parameter defines a SECOND function rather than replacing the first, both go
-- live, and every existing caller then fails to resolve with "function is not
-- unique" from Postgres and PGRST203 from PostgREST.
--
-- This migration changes only the BODY. The signature is byte for byte the one
-- 019 created, so CREATE OR REPLACE replaces the function it names and there
-- is no second overload to strand. Adding a DROP would be harmless but would
-- also be a lie about what changed.
--
-- ============================================================
-- THE BODY IS COPIED VERBATIM FROM 019 AND EDITED IN TWO PLACES
-- ============================================================
--
-- 019 is the LATEST definition of update_sequence_metadata, and 020 does not
-- touch it. The only edits below are the two lines added to the version-row
-- UPDATE.
--
-- ONE THING A READER WILL THINK IS A MISTAKE AND IT IS NOT, carried forward
-- from 019 because it is still true: this body has no has_completed_onboarding
-- check while the version in 009 does. 010 ran after 009 and recreated the
-- function without it, so the live function has not had that check since 010.
-- Copying 010's shape preserves live behaviour; restoring the gate is a real
-- behaviour change and belongs in its own migration where it can be reviewed
-- as one, not smuggled in beside a two-line fix.
--
-- NO GRANTS ARE ISSUED. No migration in this repo grants execute on this
-- function; it relies on the default, and CREATE OR REPLACE leaves that
-- unchanged. Inventing a GRANT here would be adding a privilege rather than
-- preserving one.

-- ============================================================
-- 1. update_sequence_metadata
-- ============================================================

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
      performance_notes = p_performance_notes,
      -- THE TWO LINES THIS MIGRATION EXISTS FOR.
      --
      -- They are assigned UNCONDITIONALLY, exactly as the sequences UPDATE
      -- above assigns them, and not wrapped in a coalesce. That is deliberate.
      -- The version row is a MIRROR of the sequence for the version the site
      -- calls current, so a null that reaches public.sequences must reach the
      -- version row too. A coalesce here would produce the opposite of this
      -- migration's purpose: the two would agree on every value except the
      -- absence of one, which is the hardest kind of disagreement to notice.
      grip_string = p_grip_string,
      raw_steps = v_raw_steps
    where id = v_current_version_id;
  end if;
end;
$function$;

-- ============================================================
-- 2. The backfill
-- ============================================================
--
-- The function fix above only helps rows edited AFTER it is applied. Nineteen
-- published rows already disagree, and every one of them is a sequence page
-- that hands a reader the wrong export if they pick the current version.
--
-- SAME SHAPE AS THE MIRROR STATEMENT AT THE BOTTOM OF 019, which copied
-- grip_version, talent_string and wow_build onto each row's current version
-- for exactly this reason. This one carries the two columns 019 did not.
--
-- WHAT IT PRESERVES AND WHAT IT DOES NOT, stated plainly because this UPDATE
-- overwrites history and that deserves an explicit answer:
--
--   It touches ONLY the row named by sequences.current_version_id. Every
--   earlier version row is untouched, so the version history a reader can
--   browse keeps every export that was ever published under its own label.
--
--   It DOES overwrite the current version row's export with the sequence's.
--   Where the two disagree, the version row holds what a minor edit
--   superseded WITHOUT creating a new version, so the value being replaced was
--   never published under a label of its own -- the site has been showing that
--   label with the sequence's other columns already updated around it. Making
--   the row match the sequence is what "current version" is supposed to mean.
--
--   It CANNOT be undone by a later migration, because the superseded value is
--   not recorded anywhere else. If that is not wanted, the alternative is to
--   ship section 1 alone and leave the nineteen rows for their authors to fix
--   by saving again, which the fixed function would then do correctly.
--
-- PUBLISHED ROWS ONLY. A draft has no version row to disagree with, and an
-- unpublished sequence is not readable through the anon key that measured this.
--
-- NOT GUARDED ON AN EXPECTED VALUE, unlike 019's three UPDATEs, and the
-- difference is worth saying out loud. Those carried literal values generated
-- three days earlier, so a guard was the only thing standing between a stale
-- snapshot and a clobbered row. This statement reads BOTH sides live in the
-- same transaction: it copies whatever public.sequences holds at the moment it
-- runs, so there is no snapshot to go stale and nothing for a guard to compare
-- against. A row edited one second before this runs is copied correctly.
--
-- IT IS IDEMPOTENT. Running it twice is running it once: the second pass finds
-- every current version row already equal to its sequence and writes the same
-- values again.

update public.sequence_versions sv set
  grip_string = s.grip_string,
  raw_steps = s.raw_steps
from public.sequences s
where sv.id = s.current_version_id
  and s.status = 'published'
  and (sv.grip_string is distinct from s.grip_string
       or sv.raw_steps is distinct from s.raw_steps);
