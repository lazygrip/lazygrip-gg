-- 051_member_messages.sql
--
-- Private one-to-one messages between members. Replaces the "Chat — coming
-- soon" stub on the profile page with something that works.
--
-- WHAT THIS ADDS
--   public.conversations    one row per pair of members (user_a < user_b).
--   public.messages         the messages in a conversation.
--   public.user_blocks      who has blocked whom.
--   public.message_reports  messages a participant has reported.
--   send_message, mark_conversation_read, get_inbox, unread_message_count,
--   block_user, unblock_user, report_message.
--
-- HOW WRITES ARE CONTROLLED. Same shape as the rest of the hardened schema:
-- RLS is on for all four tables, authenticated gets SELECT only on the first
-- three (participants only, enforced by policy) and nothing on message_reports,
-- anon gets nothing at all, and every write goes through a SECURITY DEFINER
-- function with a pinned search_path. Identity is always auth.uid(), never an
-- argument: there is no parameter by which a caller could send as someone else,
-- mark someone else's conversation read, or block on someone else's behalf.
--
-- WHO MAY SEND. The same two gates that guard posting: is_verified_poster
-- (display name set, confirmed or OAuth sign-in, account older than 60
-- minutes) and has_completed_onboarding (custom username, guidelines
-- acknowledged). A brand-new throwaway account therefore cannot message anyone.
-- Receiving needs only an account.
--
-- LIMITS, all counted from the rows themselves so they cannot drift and so no
-- side-effecting throttle table is needed (check_post_rate_limit writes a row on
-- every call, which is wrong for a limit that must only count real sends):
--   - 20 messages per 10 minutes per sender
--   - 10 new conversations per 24 hours per sender
--   - 5 messages in a row to someone who has not replied; the cap lifts the
--     moment they answer. This is the one that stops a member being flooded.
--
-- BLOCKING. If either side has blocked the other, send_message refuses with the
-- same message in both directions, so a blocked sender cannot tell a block from
-- a recipient who simply cannot be messaged. Existing messages stay where they
-- are for both sides; a block stops new ones.
--
-- NOT DONE HERE, stated because it is a gap and not an oversight: there is no
-- admin screen for message_reports yet. Reports are stored with the message id,
-- reporter and reason, and are readable with the service role. Nothing notifies
-- anyone when one arrives.
--
-- ORDER OF OPERATIONS. Apply BEFORE deploying the code that calls these
-- functions. The reverse is safe: the previous deploy does not reference them.
--
-- Idempotent: safe to run twice.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  started_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_read_a timestamptz,
  last_read_b timestamptz,
  constraint conversations_ordered_pair check (user_a < user_b),
  constraint conversations_starter_is_member check (started_by in (user_a, user_b)),
  constraint conversations_pair_unique unique (user_a, user_b)
);

create index if not exists conversations_user_b_idx on public.conversations (user_b);
create index if not exists conversations_started_by_idx on public.conversations (started_by, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (char_length(body) between 1 and 2000 and length(btrim(body)) > 0)
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_recent_idx on public.messages (sender_id, created_at desc);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint message_reports_reason_length check (reason is null or char_length(reason) <= 500),
  constraint message_reports_once unique (message_id, reporter_id)
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.message_reports enable row level security;

-- Start from nothing, then grant back exactly what is wanted. Supabase's default
-- privileges hand anon and authenticated everything on a new public table.
revoke all on table public.conversations from public, anon, authenticated;
revoke all on table public.messages from public, anon, authenticated;
revoke all on table public.user_blocks from public, anon, authenticated;
revoke all on table public.message_reports from public, anon, authenticated;

grant select on table public.conversations to authenticated;
grant select on table public.messages to authenticated;
grant select on table public.user_blocks to authenticated;

grant all on table public.conversations to service_role;
grant all on table public.messages to service_role;
grant all on table public.user_blocks to service_role;
grant all on table public.message_reports to service_role;

drop policy if exists conversations_participants_read on public.conversations;
create policy conversations_participants_read on public.conversations
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

drop policy if exists messages_participants_read on public.messages;
create policy messages_participants_read on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (select auth.uid()) in (c.user_a, c.user_b)
  ));

drop policy if exists user_blocks_own_read on public.user_blocks;
create policy user_blocks_own_read on public.user_blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- send_message
-- ---------------------------------------------------------------------------
create or replace function public.send_message(p_recipient_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_a uuid;
  v_b uuid;
  v_conv uuid;
  v_conv_is_new boolean := false;
  v_msg uuid;
  v_at timestamptz;
  v_last_theirs timestamptz;
  v_unanswered int;
begin
  if v_caller is null then
    raise exception 'Sign in to send messages.' using errcode = '42501';
  end if;

  if p_recipient_id is null or p_recipient_id = v_caller then
    raise exception 'Pick another member to message.' using errcode = '22023';
  end if;

  if char_length(v_body) < 1 then
    raise exception 'Write a message first.' using errcode = '22023';
  end if;

  if char_length(v_body) > 2000 then
    raise exception 'Messages can be up to 2000 characters.' using errcode = '22023';
  end if;

  if not public.is_verified_poster(v_caller) or not public.has_completed_onboarding(v_caller) then
    raise exception 'Finish setting up your account (username, display name, confirmed email) to send messages. New accounts can message after an hour.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception 'That member could not be found.' using errcode = 'P0002';
  end if;

  -- Same words whichever side did the blocking.
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = v_caller and blocked_id = p_recipient_id)
       or (blocker_id = p_recipient_id and blocked_id = v_caller)
  ) then
    raise exception 'You can''t message this member.' using errcode = '42501';
  end if;

  v_a := least(v_caller, p_recipient_id);
  v_b := greatest(v_caller, p_recipient_id);

  if (select count(*) from public.messages
      where sender_id = v_caller and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'You''re sending messages too quickly. Try again in a few minutes.' using errcode = 'P0001';
  end if;

  select id into v_conv from public.conversations where user_a = v_a and user_b = v_b;

  if v_conv is null then
    if (select count(*) from public.conversations
        where started_by = v_caller and created_at > now() - interval '24 hours') >= 10 then
      raise exception 'You''ve started a lot of conversations today. Try again tomorrow.' using errcode = 'P0001';
    end if;
  else
    select max(created_at) into v_last_theirs
    from public.messages
    where conversation_id = v_conv and sender_id = p_recipient_id;

    select count(*) into v_unanswered
    from public.messages
    where conversation_id = v_conv
      and sender_id = v_caller
      and (v_last_theirs is null or created_at > v_last_theirs);

    if v_unanswered >= 5 then
      raise exception 'Wait for a reply before sending more.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.conversations (user_a, user_b, started_by)
  values (v_a, v_b, v_caller)
  on conflict (user_a, user_b) do nothing
  returning id into v_conv;

  if v_conv is null then
    select id into v_conv from public.conversations where user_a = v_a and user_b = v_b;
  else
    v_conv_is_new := true;
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv, v_caller, v_body)
  returning id, created_at into v_msg, v_at;

  update public.conversations
  set last_message_at = v_at,
      last_read_a = case when v_caller = user_a then v_at else last_read_a end,
      last_read_b = case when v_caller = user_b then v_at else last_read_b end
  where id = v_conv;

  return jsonb_build_object(
    'conversation_id', v_conv,
    'message_id', v_msg,
    'created_at', v_at,
    'new_conversation', v_conv_is_new
  );
end;
$$;

comment on function public.send_message(uuid, text) is
  'Sends a private message from the caller. Requires is_verified_poster and has_completed_onboarding, refuses blocked pairs, and enforces 20 per 10 minutes, 10 new conversations per day and 5 unanswered in a row.';

-- ---------------------------------------------------------------------------
-- mark_conversation_read
-- ---------------------------------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  update public.conversations
  set last_read_a = case when v_caller = user_a then greatest(coalesce(last_read_a, '-infinity'::timestamptz), now()) else last_read_a end,
      last_read_b = case when v_caller = user_b then greatest(coalesce(last_read_b, '-infinity'::timestamptz), now()) else last_read_b end
  where id = p_conversation_id
    and v_caller in (user_a, user_b);
end;
$$;

comment on function public.mark_conversation_read(uuid) is
  'Marks the caller''s side of one of their own conversations as read. Does nothing for a conversation the caller is not in.';

-- ---------------------------------------------------------------------------
-- unread_message_count: conversations with something unread, for the header.
-- ---------------------------------------------------------------------------
create or replace function public.unread_message_count()
returns integer
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.conversations c
  where auth.uid() in (c.user_a, c.user_b)
    and exists (
      select 1 from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
          case when auth.uid() = c.user_a then c.last_read_a else c.last_read_b end,
          '-infinity'::timestamptz
        )
    );
$$;

comment on function public.unread_message_count() is
  'How many of the caller''s conversations have a message from the other member that the caller has not read. Zero for a signed-out caller.';

-- ---------------------------------------------------------------------------
-- get_inbox: the caller's conversations, newest first, with the other member's
-- public profile fields and a preview of the last message.
-- ---------------------------------------------------------------------------
create or replace function public.get_inbox()
returns table (
  conversation_id uuid,
  other_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_url text,
  other_avatar_color text,
  last_message_at timestamptz,
  last_body text,
  last_sender_id uuid,
  unread boolean,
  blocked_by_me boolean
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    c.id,
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.avatar_color,
    c.last_message_at,
    lm.body,
    lm.sender_id,
    coalesce(lm.sender_id <> auth.uid() and lm.created_at > coalesce(
      case when auth.uid() = c.user_a then c.last_read_a else c.last_read_b end,
      '-infinity'::timestamptz
    ), false),
    exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.id)
  from public.conversations c
  join public.profiles p
    on p.id = case when auth.uid() = c.user_a then c.user_b else c.user_a end
  left join lateral (
    select m.body, m.sender_id, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where auth.uid() in (c.user_a, c.user_b)
  order by c.last_message_at desc
  limit 100;
$$;

comment on function public.get_inbox() is
  'The caller''s conversations, newest first, with the other member''s username, display name and avatar fields and the last message. Empty for a signed-out caller.';

-- ---------------------------------------------------------------------------
-- block_user / unblock_user
-- ---------------------------------------------------------------------------
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_caller then
    raise exception 'You can''t block yourself.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'That member could not be found.' using errcode = 'P0002';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_caller, p_user_id)
  on conflict do nothing;
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  delete from public.user_blocks
  where blocker_id = v_caller and blocked_id = p_user_id;
end;
$$;

comment on function public.block_user(uuid) is
  'Blocks a member for the caller. Neither side can send to the other until the block is removed.';
comment on function public.unblock_user(uuid) is
  'Removes the caller''s own block on a member.';

-- ---------------------------------------------------------------------------
-- report_message
-- ---------------------------------------------------------------------------
create or replace function public.report_message(p_message_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = '22023';
  end if;

  -- Only a message the caller received can be reported. Reading the conversation
  -- here, in a definer function, means the participant check has to be explicit.
  if not exists (
    select 1
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = p_message_id
      and m.sender_id <> v_caller
      and v_caller in (c.user_a, c.user_b)
  ) then
    raise exception 'That message could not be found.' using errcode = 'P0002';
  end if;

  insert into public.message_reports (message_id, reporter_id, reason)
  values (p_message_id, v_caller, v_reason)
  on conflict (message_id, reporter_id) do nothing;
end;
$$;

comment on function public.report_message(uuid, text) is
  'Reports a message the caller received. One report per reporter per message. Readable with the service role only.';

-- ---------------------------------------------------------------------------
-- Function grants: nothing for anon or PUBLIC, execute for signed-in members.
-- ---------------------------------------------------------------------------
revoke all on function public.send_message(uuid, text) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.unread_message_count() from public, anon;
revoke all on function public.get_inbox() from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.report_message(uuid, text) from public, anon;

grant execute on function public.send_message(uuid, text) to authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;
grant execute on function public.unread_message_count() to authenticated, service_role;
grant execute on function public.get_inbox() to authenticated, service_role;
grant execute on function public.block_user(uuid) to authenticated, service_role;
grant execute on function public.unblock_user(uuid) to authenticated, service_role;
grant execute on function public.report_message(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Assertions
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  f text;
begin
  foreach t in array array['conversations', 'messages', 'user_blocks', 'message_reports'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception '051: RLS is off on public.%.', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'SELECT')
       or has_table_privilege('anon', 'public.' || t, 'INSERT')
       or has_table_privilege('anon', 'public.' || t, 'UPDATE')
       or has_table_privilege('anon', 'public.' || t, 'DELETE') then
      raise exception '051: anon holds a privilege on public.%.', t;
    end if;
    if has_table_privilege('authenticated', 'public.' || t, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE') then
      raise exception '051: authenticated can write public.% directly. The functions are meant to be the only way.', t;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.message_reports', 'SELECT') then
    raise exception '051: authenticated can read message_reports.';
  end if;

  foreach f in array array[
    'public.send_message(uuid, text)',
    'public.mark_conversation_read(uuid)',
    'public.unread_message_count()',
    'public.get_inbox()',
    'public.block_user(uuid)',
    'public.unblock_user(uuid)',
    'public.report_message(uuid, text)'
  ] loop
    if has_function_privilege('anon', f, 'EXECUTE') then
      raise exception '051: anon can execute %.', f;
    end if;
    if not has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception '051: authenticated cannot execute %.', f;
    end if;
  end loop;
end;
$$;
