-- 028_collection_sequence_versioning.sql
--
-- WHY THIS EXISTS
--
-- publish_draft_sequence() has always deliberately skipped creating a
-- sequence_versions row for a collection (see 016_publish_reslug.sql) --
-- collections publish straight to status='published' with
-- current_version_id left null. That was a reasonable scope cut at the
-- time, but it means every collection sequence (the ST/MT-bundle format
-- most posts actually use, including every one of Slowdog's dual builds)
-- can never use the "publish a new version" flow: the /update page looks
-- up sequence_versions by current_version_id, finds nothing because there
-- was never anything to find, and falls through to a generic error that
-- has nothing to do with the sequence being missing. As of this session
-- that page hides its own Update button on collections and shows an
-- honest message instead of the misleading one, but the underlying gap,
-- collections structurally can't be versioned, was never closed. This
-- migration closes it.
--
-- WHAT A COLLECTION VERSION IS
--
-- Whole-bundle versioning, decided with Slowdog: a version wraps the
-- ENTIRE collection_sequences array (every named sub-sequence, e.g. ST
-- and MT) as one unit with one version_number/label/changelog, not one
-- history per sub-sequence. This matches how collections are actually
-- authored, one GRIP-EMS export decoded into multiple named entries in a
-- single paste, so there was never a moment where "ST changed but MT
-- didn't" as an independent publishing event. It also means a collection
-- version needs exactly one new column, collection_sequences, alongside
-- the fields sequence_versions already has (grip_string still holds the
-- full multi-sequence export blob for a collection, same as it does on
-- the parent sequences row today).
--
-- SCOPE: additive only. New nullable column, and publish_sequence_version
-- gains one new trailing parameter defaulted to null, so the collection
-- branch. Every existing 15-argument call site (the /update page as it
-- exists before this session's follow-up change) keeps resolving to this
-- same function unchanged, exactly the guarantee 016 and 025 both relied
-- on for their own added parameters. No backfill: the 24 collection
-- sequences already published keep reading their live sequences row with
-- zero version history, precisely as they do today, until an author
-- actually publishes a new version on one of them -- the first such
-- publish becomes that sequence's v1-equivalent in sequence_versions from
-- that point forward.

alter table public.sequence_versions
  add column if not exists collection_sequences jsonb;

DROP FUNCTION IF EXISTS public.publish_sequence_version(uuid, integer, text, text, jsonb, text, uuid, text, text, text, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.publish_sequence_version(p_sequence_id uuid, p_version_number integer, p_version_label text, p_grip_string text, p_raw_steps jsonb, p_changelog text, p_author_id uuid, p_hero_talent text, p_content_type text, p_step_function text, p_grip_version text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_actions jsonb DEFAULT NULL::jsonb, p_collection_sequences jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new_version_id uuid;
  v_owner uuid;
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
    p_collection_sequences,
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
    -- Same mirror discipline 025 established for grip_string/raw_steps/
    -- actions: without also writing collection_sequences here, a reader of
    -- the parent row (rather than the version row directly) would see the
    -- PREVIOUS version's collection content the instant a new one publishes.
    grip_string = p_grip_string,
    raw_steps = p_raw_steps,
    actions = p_actions,
    collection_sequences = p_collection_sequences,
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
