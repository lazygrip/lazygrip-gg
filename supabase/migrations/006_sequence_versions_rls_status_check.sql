-- Migration 006: Restrict sequence_versions SELECT to published-or-own
--
-- Context: sequence_versions had two redundant SELECT policies, both
-- `using (true)` -- fully public, no status check. The parent table
-- (sequences) correctly restricts drafts to their author
-- ("Authors can view their own sequences" / "Published sequences are
-- viewable by everyone"), but sequence_versions never inherited an
-- equivalent restriction.
--
-- Impact assessed as not currently exploitable: create_draft_sequence and
-- update_draft_sequence never write to sequence_versions, only to
-- sequences. The first sequence_versions row is created by
-- publish_draft_sequence in the same transaction that flips status to
-- 'published'. So no row currently exists in sequence_versions for a
-- sequence that is still status = 'draft'.
--
-- Fixed anyway because the policy itself had no safety net: any future
-- function, script, or admin tool that ever wrote a sequence_versions row
-- ahead of publish (e.g. a draft-preview feature) would leak draft content
-- immediately, with no code change needed on the leak side, since RLS was
-- already wide open. This migration makes the table enforce the same
-- published-or-own rule the parent table does, independent of write-path
-- discipline.
--
-- Found and fixed 2026-07-25 during a full RLS policy audit (the first
-- full pass over pg_policies; prior audits this week covered SECURITY
-- DEFINER function bodies and API routes, not RLS). Applied live and
-- verified via pg_policies same day.

drop policy if exists "Anyone can read sequence versions" on public.sequence_versions;
drop policy if exists "Versions are viewable by everyone" on public.sequence_versions;

create policy "Versions viewable if sequence is published or own"
on public.sequence_versions for select
using (
  exists (
    select 1 from public.sequences s
    where s.id = sequence_versions.sequence_id
      and (s.status = 'published' or s.author_id = auth.uid())
  )
);
