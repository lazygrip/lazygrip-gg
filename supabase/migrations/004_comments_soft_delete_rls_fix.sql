-- 004: comments soft-delete RLS fix (SEC8 follow-up)
--
-- 003 restricted the comments SELECT policy to is_deleted = false, but that
-- also blocked an author from reading their own soft-deleted comment (e.g.
-- to un-delete it). This adds the author_id exception so an author can still
-- see their own deleted comments, while everyone else still can't.
drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone"
  on public.comments for select
  using (is_deleted = false or auth.uid() = author_id);