-- 052_report_message_server_only.sql
--
-- Moves report_message behind a server route so a report can alert the site
-- owner on Discord. 051 let a signed-in member call report_message straight
-- from the browser, which stores the report and tells nobody. The alert has to
-- be sent from the server, and a browser that can still call the function
-- directly would skip it, so the browser loses the right to call it at all.
--
-- WHAT CHANGES
--   report_message(uuid, text)               dropped.
--   report_message(uuid, uuid, text)         added: the reporter is now an
--                                            argument, because the caller is
--                                            the service role and auth.uid()
--                                            is null there. Execute is granted
--                                            to service_role and nobody else,
--                                            so the only way to name a reporter
--                                            is through /api/messages/report,
--                                            which takes the reporter from the
--                                            signed-in session and never from
--                                            the request body.
--   It returns jsonb with what the alert needs (usernames and the new
--   report's id, never the message text) and whether the report was new.
--
-- A NEW LIMIT. A reporter can file 10 reports in 24 hours. Reports can only be
-- filed against messages the reporter received, which are themselves
-- rate limited by send_message, so this is a second fence on alert volume and
-- not the first.
--
-- ORDER OF OPERATIONS. There is a short gap whichever way round this goes, and
-- it only affects the Report button. Apply this first and merge straight after:
-- between the two, the old page still calls the two-argument function that is
-- now gone, so a report fails with an error until the deploy lands. Deploy
-- first and the new route calls the three-argument function that does not exist
-- yet, which fails the same way. Messages themselves are untouched either way.
--
-- Idempotent: safe to run twice.

drop function if exists public.report_message(uuid, text);

create or replace function public.report_message(
  p_reporter_id uuid,
  p_message_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_sender uuid;
  v_conversation uuid;
  v_report uuid;
  v_sender_name text;
  v_reporter_name text;
begin
  if p_reporter_id is null or p_message_id is null then
    raise exception 'Missing reporter or message.' using errcode = '22023';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = '22023';
  end if;

  -- Only a message the reporter received can be reported. The tables are read
  -- here by a definer function, so RLS does not apply and the participant check
  -- has to be explicit.
  select m.sender_id, m.conversation_id
    into v_sender, v_conversation
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.id = p_message_id
    and m.sender_id <> p_reporter_id
    and p_reporter_id in (c.user_a, c.user_b);

  if v_sender is null then
    raise exception 'That message could not be found.' using errcode = 'P0002';
  end if;

  if (select count(*) from public.message_reports
      where reporter_id = p_reporter_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You''ve sent a lot of reports today. Email admin@lazygrip.net if something urgent is going on.'
      using errcode = 'P0001';
  end if;

  insert into public.message_reports (message_id, reporter_id, reason)
  values (p_message_id, p_reporter_id, v_reason)
  on conflict (message_id, reporter_id) do nothing
  returning id into v_report;

  select username into v_sender_name from public.profiles where id = v_sender;
  select username into v_reporter_name from public.profiles where id = p_reporter_id;

  return jsonb_build_object(
    'inserted', v_report is not null,
    'report_id', v_report,
    'message_id', p_message_id,
    'conversation_id', v_conversation,
    'sender_username', v_sender_name,
    'reporter_username', v_reporter_name,
    'reason', v_reason
  );
end;
$$;

comment on function public.report_message(uuid, uuid, text) is
  'Reports a message the named reporter received. service_role only: called by /api/messages/report with the reporter taken from the session. One report per reporter per message, 10 per reporter per day. Returns what the alert needs, never the message text.';

revoke all on function public.report_message(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.report_message(uuid, uuid, text) to service_role;

do $$
begin
  if to_regprocedure('public.report_message(uuid, text)') is not null then
    raise exception '052: the old report_message(uuid, text) is still there, so the browser can still skip the alert.';
  end if;

  if has_function_privilege('anon', 'public.report_message(uuid, uuid, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.report_message(uuid, uuid, text)', 'EXECUTE') then
    raise exception '052: anon or authenticated can execute report_message. It is meant to be service_role only.';
  end if;

  if not has_function_privilege('service_role', 'public.report_message(uuid, uuid, text)', 'EXECUTE') then
    raise exception '052: service_role cannot execute report_message.';
  end if;
end;
$$;
