-- 044_version_label_follows_author_scheme_and_bump_updated_at.sql
--
-- WHAT THIS FIXES
--
-- Two defects in update_sequence_with_version, the RPC behind a versioned save
-- from the /post edit screen. Both were MEASURED against production on
-- 2026-10-07 while chasing a report that a macro on v2.0 showed "1.2 current"
-- after a description edit.
--
-- 1. THE LABEL IGNORED THE AUTHOR'S OWN SCHEME. The function named every new
--    version '1.' || (version_number - 1). The update page
--    (/sequences/[slug]/update) lets the author type a label, and most do:
--    "v2.0", "v3.0", "v6.0". The next versioned save on /post then wrote "1.2"
--    or "1.3" right after "v2.0", so the badge went backwards. Four other
--    sequences carry the same scar: lucifers-holy-m-plus-oracle..., the
--    pershizzles BM and Brewmaster rows, and sk-st-sub-trickster. The new label
--    is the current label with its minor number incremented ("v2.0" becomes
--    "v2.1", "1.3" becomes "1.4"), which is what an author expects an edit on
--    top of v2.0 to be called. A current label that does not look like
--    [v]major.minor falls back to the old numbering, and a label that already
--    exists on the sequence is skipped over rather than duplicated.
--
-- 2. updated_at WAS NEVER WRITTEN. publish_sequence_version and
--    update_sequence_metadata both set updated_at = now(); this one did not, so
--    a versioned save from /post left the sequence reading as last updated at
--    its previous change. Everything keyed on updated_at then drifts: the
--    "Updated ..." line on cards and pages, the stale-patch warning, the sitemap
--    lastmod, and gripbot's sweep, which only notices a row whose updated_at is
--    newer than last_discord_notified_at.
--
-- NOT DONE HERE, ON PURPOSE. No backfill of updated_at on old rows. 44
-- sequences have a newest version row later than updated_at; most differ by a
-- second or two and are harmless, several differ by weeks, and some of the
-- version rows involved are the 2026-06-02 backfill stamps rather than real
-- revisions. About twenty of those rows have no Discord notification on
-- record, so moving their updated_at forward would make the sweep repost cards
-- into the forum. This migration changes behaviour going forward only.
--
-- BASELINE. The body below is the live production function (pg_get_functiondef,
-- 2026-10-07), which is 025's definition with 026's search_path hardening. The
-- two changes are the label block and the extra updated_at line. SECURITY
-- DEFINER and SET search_path are repeated on purpose: CREATE OR REPLACE drops
-- any SET clause the new definition does not restate.

CREATE OR REPLACE FUNCTION public.update_sequence_with_version(p_sequence_id uuid, p_author_id uuid, p_title text, p_description text, p_class_id integer, p_class_name text, p_spec_id integer, p_spec_name text, p_content_type text, p_hero_talent text, p_patch_version text, p_grip_version text, p_step_function text, p_step_count integer, p_grip_string text, p_raw_steps text, p_talent_string text, p_warcraftlogs_url text, p_performance_notes text, p_changelog text, p_wow_build text DEFAULT NULL::text, p_actions text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_version_id uuid;
  v_raw_steps jsonb;
  v_actions jsonb;
  v_next_version_number integer;
  v_version_label text;
  v_current_label text;
  v_prefix text := '';
  v_major integer := 1;
  v_minor integer;
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

  if p_actions is null then
    v_actions := null;
  else
    v_actions := p_actions::jsonb;
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_next_version_number
  from public.sequence_versions
  where sequence_id = p_sequence_id;

  -- Name the new version after the author's own scheme. The default start is the
  -- old numbering ('1.' || (n - 1)), so a sequence whose current label does not
  -- parse behaves exactly as it did before this migration.
  select current_version_label into v_current_label
  from public.sequences
  where id = p_sequence_id;

  v_minor := v_next_version_number - 2;

  if v_current_label ~ '^[vV]?[0-9]{1,6}\.[0-9]{1,6}$' then
    v_prefix := substring(v_current_label from '^([vV]?)');
    v_major := substring(v_current_label from '^[vV]?([0-9]+)\.')::integer;
    v_minor := substring(v_current_label from '\.([0-9]+)$')::integer;
  end if;

  loop
    v_minor := v_minor + 1;
    v_version_label := v_prefix || v_major::text || '.' || v_minor::text;
    exit when not exists (
      select 1 from public.sequence_versions
      where sequence_id = p_sequence_id and version_label = v_version_label
    );
  end loop;

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
    actions = v_actions,
    talent_string = p_talent_string,
    warcraftlogs_url = p_warcraftlogs_url,
    performance_notes = p_performance_notes,
    updated_at = now()
  where id = p_sequence_id;

  insert into public.sequence_versions (
    sequence_id, author_id, version_number, version_label,
    grip_string, raw_steps, actions, changelog,
    hero_talent, content_type, step_function, grip_version,
    talent_string, warcraftlogs_url, performance_notes,
    wow_build
  ) values (
    p_sequence_id, p_author_id, v_next_version_number, v_version_label,
    p_grip_string, v_raw_steps, v_actions, p_changelog,
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
