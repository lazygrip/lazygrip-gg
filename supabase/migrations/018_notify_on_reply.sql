-- Reply notifications: notify_on_comment (existing) tells a sequence author
-- someone commented on their sequence. It says nothing to the person whose
-- specific comment got replied to, which is the actual gap kohtas/itmeteemo-
-- adjacent feedback did not ask for but the comment-depth work this session
-- was scoped against did: "no way to know if the author responded to you."
--
-- Deliberately a separate trigger rather than folded into notify_on_comment,
-- for the same reason update_comment_count and notify_on_comment are already
-- separate triggers on the same table/event: each does one thing, and a bug
-- in one cannot take the other down since they run as independent trigger
-- invocations, not sequential steps inside one function body.
--
-- KNOWN, ACCEPTED OVERLAP: if the sequence author's own comment gets a
-- reply, notify_on_comment fires (replier != sequence author) AND this
-- trigger fires (replier != parent comment author, who is the sequence
-- author here) -- two notifications, "X commented on your sequence" and
-- "X replied to your comment." Not deduplicated. Left as-is because they
-- carry different information (a comment happened / your comment
-- specifically got a reply) rather than being redundant restatements of the
-- same event.
--
-- Applied live via Supabase MCP on 2026-08-11 and verified with a
-- transaction-wrapped, rolled-back insert test before this file was
-- written; this file brings local history in sync with the live database,
-- same pattern as migration 008.
create or replace function public.notify_on_reply()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  parent_author_id uuid;
  seq_title text;
  actor_username text;
begin
  if new.parent_id is null then
    return new;
  end if;

  select author_id into parent_author_id
  from comments where id = new.parent_id;

  -- Parent comment missing (deleted between the reply being composed and
  -- inserted) or the replier replying to their own comment: nothing to
  -- notify either way.
  if parent_author_id is null or parent_author_id = new.author_id then
    return new;
  end if;

  select title into seq_title
  from sequences where id = new.sequence_id;

  select username into actor_username
  from profiles where id = new.author_id;

  insert into notifications (user_id, type, sequence_id, actor_id, message)
  values (
    parent_author_id,
    'reply',
    new.sequence_id,
    new.author_id,
    actor_username || ' replied to your comment on "' || seq_title || '"'
  );

  return new;
end;
$function$;

create trigger on_comment_reply_notify
  after insert on public.comments
  for each row
  execute function public.notify_on_reply();
