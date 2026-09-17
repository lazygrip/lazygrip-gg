-- 033_published_sequences_require_a_spec.sql
--
-- Audit F6. Two published sequences carry a null spec, and the important part
-- of the finding is not the two rows -- it is that the count was RISING. The
-- 2026-09-15 audit found ONE. By 2026-09-17 there were TWO. The publish form
-- accepted a null spec, so backfilling alone would have reset a counter rather
-- than fixed anything.
--
-- Three parts, in an order that makes the third one prove the first:
--
--   1. Backfill the two known rows.
--   2. Constrain published rows to carry a spec.
--   3. VALIDATE that constraint against the whole table, which fails loudly if
--      part 1's list was incomplete.
--
-- The client half ships in the same PR: src/app/post/page.tsx's handleSubmit
-- now refuses to publish without a spec that resolves against the selected
-- class. This file is the half that holds when someone bypasses the form.
--
-- ============================================================================
-- PART 1: the two rows, and how their values were established
-- ============================================================================
--
-- NOT inferred from the title alone. Jesper's instruction on 2026-09-17 was to
-- infer from the title AND the decoded grip_string, and to stop rather than
-- guess if the two disagreed. Each grip_string was decoded through the live
-- /api/workshop/decode endpoint and read for spec-defining abilities:
--
--   kohtas-enhancement-shaman-super-sba-mrud1kmn
--     class_name 'Shaman', class_id 7, title says Enhancement.
--     Decoded: "/cast [combat,nochanneling] Doom Winds".
--     Doom Winds is an Enhancement ability and exists on no other Shaman spec.
--     -> spec_id 263, spec_name 'Enhancement'. Title and decode agree.
--
--   legaciers-boomkin-st-mt-sequence-mu5v79ml
--     class_name 'Druid', class_id 11, title says Boomkin.
--     This row's `actions` and `raw_steps` columns are BOTH NULL -- it was
--     published without ever being decoded into them, which is its own smell
--     and is why the grip_string had to be decoded fresh rather than read off
--     the row. Decoded: "/cast [noform:4] Moonkin Form", "/cast Starsurge",
--     "/cast Starfall", "/cast Fury of Elune", "/cast Starfire", plus
--     {spell:102560} Incarnation: Chosen of Elune.
--     Every one of those is Balance. -> spec_id 102, spec_name 'Balance'.
--
-- The ids and names are the ones src/lib/wow-data.ts declares (263
-- 'Enhancement' at :89, 102 'Balance' at :23), so the backfilled rows sort and
-- filter identically to a row the form would write today.
--
-- Each UPDATE is guarded on slug AND class_id AND spec_id being null, so this
-- is a no-op rather than a clobber if the row has since been fixed by hand, and
-- refuses to write a Balance spec onto a row that is no longer a Druid.

do $$
declare
  v_updated integer;
  v_total integer := 0;
begin
  update public.sequences
  set spec_id = 263, spec_name = 'Enhancement'
  where slug = 'kohtas-enhancement-shaman-super-sba-mrud1kmn'
    and class_id = 7
    and spec_id is null;
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  if v_updated = 0 then
    raise notice '033: kohtas-enhancement-shaman-super-sba-mrud1kmn was not updated -- already has a spec, changed class, or the slug is gone. Part 3 will catch it if it is still null.';
  end if;

  update public.sequences
  set spec_id = 102, spec_name = 'Balance'
  where slug = 'legaciers-boomkin-st-mt-sequence-mu5v79ml'
    and class_id = 11
    and spec_id is null;
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  if v_updated = 0 then
    raise notice '033: legaciers-boomkin-st-mt-sequence-mu5v79ml was not updated -- already has a spec, changed class, or the slug is gone. Part 3 will catch it if it is still null.';
  end if;

  raise notice '033: backfilled % of 2 known null-spec published sequence(s).', v_total;
end $$;

-- ============================================================================
-- PART 2 and 3: the constraint, and its validation as the completeness proof
-- ============================================================================
--
-- SCOPED TO published ROWS ONLY, deliberately. A draft legitimately has no spec
-- yet -- that is what a draft is, and create_draft_sequence is explicitly the
-- unvalidated path -- so constraining every status would break the autosave
-- that every author's first two minutes depend on. 'private' and 'archived' are
-- also left alone: a private row may be a draft that was never published, since
-- post/page.tsx:1079 can raw-insert any status, and this file is not the place
-- to relitigate that.
--
-- BOTH columns are required, not just one. A row carrying spec_name with a null
-- spec_id is the shape the class-change bug produces (pick Balance, switch the
-- class, spec_name survives and spec_id resolves to null), and it filters as
-- missing on /browse while displaying as present on the sequence page -- two
-- surfaces disagreeing about the same row, which is worse than a clean null.
--
-- ADDED WITHOUT `not valid`, WHICH IS THE POINT. A NOT VALID constraint would
-- apply to new writes and quietly exempt whatever part 1 missed. Validating
-- immediately means Postgres reads every published row and this migration
-- FAILS, rolling back the whole file, if there is a third null-spec row the
-- 2026-09-17 sweep did not see. The measurement was
--
--     status=eq.published&or=(spec_name.is.null,spec_id.is.null)  ->  2 rows
--
-- taken as anon, and published rows are the ones anon can read, so the count
-- should be complete. Should be. This is what turns that into a fact: if the
-- file applies, the corpus is clean; if it raises, the count was wrong and the
-- error names the constraint rather than leaving a silent third row behind.
alter table public.sequences
drop constraint if exists sequences_published_requires_spec;

alter table public.sequences
add constraint sequences_published_requires_spec check (
  status <> 'published'
  or (spec_id is not null and spec_name is not null and spec_name <> '')
);

comment on constraint sequences_published_requires_spec on public.sequences is
  'A published sequence must carry both spec_id and a non-empty spec_name. Drafts, private and archived rows are unconstrained -- a draft without a spec is a normal draft. Audit F6: two published rows had null specs and the count was rising, because the publish form accepted it. Mirrored client-side in post/page.tsx handleSubmit.';
