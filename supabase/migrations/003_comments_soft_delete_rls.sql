-- 003: comments soft-delete RLS (SEC8)
--
-- The comments SELECT policy was `using (true)`, so a soft-deleted comment's
-- body stayed readable through the anon key even though the UI hides deleted
-- comments client-side (.eq('is_deleted', false)). Client-side filtering is
-- not a security boundary. This restricts the read to non-deleted rows, which
-- matches what the app already shows and closes the anon read of deleted
-- bodies.
--
-- No functional change: the UI already filters on the same condition. Soft
-- delete still keeps the row (the update_comment_count trigger decrements
-- comment_count); an author can still un-delete via the existing UPDATE
-- policy, which does not require SELECT.

drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone"
  on public.comments for select using (is_deleted = false);
