-- 031_column_grants_and_trusted_client_ip.sql
--
-- Three findings, one migration, because they are one mechanism seen from three
-- angles: the database trusts input it should not trust.
--
--   H4  Any author can write every ranking key on their own row.
--   H5  The same policy lets an author publish without passing any publish gate.
--   H6  The view and copy counters take the client-controlled end of
--       X-Forwarded-For, so an anonymous caller inflates them without limit.
--
-- They are not split because H4 and H5 are the SAME POLICY -- one grant closes
-- both, and closing only one would mean writing this analysis twice -- and
-- because H6 is the third place in the same schema where a value arriving over
-- HTTP was treated as authoritative.
--
-- ============================================================================
-- PART 0: WHAT THIS MIGRATION ASSERTS ABOUT ITSELF
-- ============================================================================
--
-- 026 is the reason this file verifies rather than assumes. It ran ALTER
-- FUNCTION against two signatures that did not exist, and because Supabase runs
-- each migration file in one transaction, the whole file may have rolled back
-- and taken seven search_path pins with it. 027 is the reason it verifies
-- against the CATALOG rather than against a description: 026's function body
-- referenced post_rate_throttle.created_at when the column is posted_at, which
-- plpgsql does not catch at CREATE time, so it applied clean and would have
-- thrown on the first real call.
--
-- So: the column list below is intersected against information_schema rather
-- than named blind, and the outcome is checked with has_column_privilege
-- afterwards. A name that does not exist is skipped with a notice instead of
-- raising and rolling back the file. A column that was supposed to end up
-- revoked and did not raises loudly.
--
-- This matters for a specific reason. The 2026-09-15 audit's proposed grant list
-- named `discord_bridge_opted_out`, which 017:26 puts on public.profiles and NOT
-- on public.sequences. Granted blind, that single name would have raised and
-- rolled back this entire file -- 026's failure repeated exactly.

-- ============================================================================
-- PART 1 (H6): the trustworthy end of X-Forwarded-For
-- ============================================================================
--
-- 011:49 and 024:24/:84 all read:
--
--     split_part(... ->>'x-forwarded-for', ',', 1)
--
-- which is the LEFTMOST element. Proxies APPEND, so the leftmost element is
-- whatever the client sent. This is not a theoretical reading of the RFC: it is
-- reproduced against Supabase specifically in supabase/supabase discussion
-- 34647, where a caller sending `X-Forwarded-For: spoofed` against an RPC using
-- this exact split_part expression gets back the string `spoofed`, and the
-- header as the database sees it reads `spoofed,68.65.164.215` -- the real peer
-- appended on the RIGHT. The same report notes Supabase fronts requests with
-- Cloudflare, which sets `cf-connecting-ip` to the true peer.
--
-- Hence the order below: cf-connecting-ip first, because it is a single
-- unambiguous value written by the edge; the rightmost X-Forwarded-For element
-- second, because that element was written by the last proxy in the chain rather
-- than by the caller.
--
-- WHAT WOULD MAKE THE FALLBACK WRONG, recorded so the next reader does not have
-- to rediscover it. The rightmost element is the true peer only while exactly
-- one hop appends. If Supabase's chain ever grows a second hop, the rightmost
-- value becomes that hop's own address -- a constant -- and every caller
-- collapses into one throttle bucket. That fails toward OVER-throttling, which
-- is the safe direction for a counter, and cf-connecting-ip is checked first
-- precisely so the chain length stops mattering.
--
-- 011 and 024 are NOT edited in place. They are applied history; a function is
-- changed by superseding it. A from-scratch apply runs their versions and then
-- this one, and ends in the right state.

create or replace function public.request_client_ip()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers json;
  v_cf text;
  v_xff text;
  v_parts text[];
begin
  -- `true` for missing_ok: there is no request.headers setting at all on a
  -- direct database connection, and that must be null rather than an exception.
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    -- A malformed or non-JSON setting must not take down a view increment.
    return null;
  end;

  if v_headers is null then
    return null;
  end if;

  v_cf := nullif(btrim(v_headers->>'cf-connecting-ip'), '');
  if v_cf is not null then
    return v_cf;
  end if;

  v_xff := v_headers->>'x-forwarded-for';
  if v_xff is null then
    return null;
  end if;

  v_parts := string_to_array(v_xff, ',');
  if v_parts is null or array_length(v_parts, 1) is null then
    return null;
  end if;

  -- THE RIGHTMOST ELEMENT. This is the whole fix.
  return nullif(btrim(v_parts[array_length(v_parts, 1)]), '');
end;
$$;

comment on function public.request_client_ip() is
  'Returns the client IP as the edge reported it: cf-connecting-ip if present, otherwise the RIGHTMOST X-Forwarded-For element. Never the leftmost, which is client-supplied -- see supabase/supabase discussion 34647 for the reproduction. Null when no request headers are present (direct database connection). Callers must treat null as "unknown" and still throttle.';

revoke all on function public.request_client_ip() from public, anon, authenticated;
grant execute on function public.request_client_ip() to service_role;

create or replace function public.increment_view_count(seq_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ip text;
  v_row record;
  v_daily_cap integer := 30;
begin
  -- WAS: split_part(..., ',', 1), the client-controlled leftmost element.
  v_ip := public.request_client_ip();

  -- No IP available: still apply the rate/day logic using a fixed sentinel key
  -- instead of skipping throttling entirely.
  if v_ip is null then
    v_ip := 'unknown';
  end if;

  select * into v_row
  from public.view_count_throttle
  where sequence_id = seq_id and viewer_ip = v_ip;

  if v_row is null then
    insert into public.view_count_throttle (sequence_id, viewer_ip, last_counted_at, count_today)
    values (seq_id, v_ip, now(), 1);
    update public.sequences set view_count = view_count + 1 where id = seq_id;
    return;
  end if;

  -- still inside the 30-minute rate window: no-op
  if v_row.last_counted_at > now() - interval '30 minutes' then
    return;
  end if;

  -- window has passed: reset the daily counter if the last count was on a
  -- previous UTC day, otherwise keep accumulating against the daily cap
  if v_row.last_counted_at < date_trunc('day', now()) then
    update public.view_count_throttle
    set last_counted_at = now(), count_today = 1
    where sequence_id = seq_id and viewer_ip = v_ip;
    update public.sequences set view_count = view_count + 1 where id = seq_id;
    return;
  end if;

  if v_row.count_today >= v_daily_cap then
    return;
  end if;

  update public.view_count_throttle
  set last_counted_at = now(), count_today = count_today + 1
  where sequence_id = seq_id and viewer_ip = v_ip;
  update public.sequences set view_count = view_count + 1 where id = seq_id;

  if random() < 0.01 then
    delete from public.view_count_throttle where last_counted_at < now() - interval '2 days';
  end if;
end;
$$;

create or replace function public.increment_copy_count(seq_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ip text;
  v_row record;
  v_daily_cap integer := 30;
begin
  -- WAS: split_part(..., ',', 1), the client-controlled leftmost element.
  v_ip := public.request_client_ip();

  if v_ip is null then
    v_ip := 'unknown';
  end if;

  select * into v_row
  from public.copy_count_throttle
  where sequence_id = seq_id and copier_ip = v_ip;

  if v_row is null then
    insert into public.copy_count_throttle (sequence_id, copier_ip, last_counted_at, count_today)
    values (seq_id, v_ip, now(), 1);
    update public.sequences set copy_count = copy_count + 1 where id = seq_id;
    return;
  end if;

  if v_row.last_counted_at > now() - interval '2 minutes' then
    return;
  end if;

  if v_row.last_counted_at < date_trunc('day', now()) then
    update public.copy_count_throttle
    set last_counted_at = now(), count_today = 1
    where sequence_id = seq_id and copier_ip = v_ip;
    update public.sequences set copy_count = copy_count + 1 where id = seq_id;
    return;
  end if;

  if v_row.count_today >= v_daily_cap then
    return;
  end if;

  update public.copy_count_throttle
  set last_counted_at = now(), count_today = count_today + 1
  where sequence_id = seq_id and copier_ip = v_ip;
  update public.sequences set copy_count = copy_count + 1 where id = seq_id;

  if random() < 0.01 then
    delete from public.copy_count_throttle where last_counted_at < now() - interval '2 days';
  end if;
end;
$$;

revoke all on function public.increment_view_count(uuid) from public;
revoke all on function public.increment_copy_count(uuid) from public;
grant execute on function public.increment_view_count(uuid) to anon, authenticated, service_role;
grant execute on function public.increment_copy_count(uuid) to anon, authenticated, service_role;

-- ============================================================================
-- PART 2 (H5): a status change is an RPC, not a column write
-- ============================================================================
--
-- This function has to exist BEFORE the grant in part 3 takes `status` away,
-- because taking `status` away without it breaks the publish/unpublish toggle on
-- the creator profile page. ProfileTabs.tsx:197 currently does:
--
--     .from('sequences').update({ status: newStatus }).eq('id', ...)
--
-- which is a live, shipped, client-side column write of the exact column H5 says
-- must not be writable. The audit's premise -- "publishing only happens through
-- the RPCs that already carry all four gates" -- was true when it was written
-- and stopped being true when the creator dashboard shipped in the 029/030
-- delta. Revoking the column without replacing the capability would have been a
-- production regression wearing a security label.
--
-- WHAT IT REFUSES, AND WHY THAT IS THE WHOLE FIX. H5's exploit is
-- create_draft_sequence (deliberately not rate limited, 007:130-133) N times,
-- then PATCH status to 'published' N times -- which skips the title, class_id
-- and grip_string checks, the slug reminting, and the creation of the
-- sequence_versions row, leaving current_version_id null. This function
-- therefore permits transitions ONLY between 'published' and 'private'. A
-- draft reaching 'published' still has to go through create_sequence_with_version,
-- publish_sequence_version or publish_draft_sequences_batch, which is where all
-- four gates live.
--
-- WHY IT DOES NOT CALL check_post_rate_limit, which is the non-obvious half.
-- That function has a SIDE EFFECT: on success it INSERTS into
-- post_rate_throttle (027:52-53), consuming one of the caller's 1/hour and 3/day
-- publish slots. A visibility toggle is not a new post -- the content it makes
-- visible was already validated when it was first published -- so spending a
-- publish slot on it would throttle a legitimate author for un-hiding their own
-- work. The gate is unnecessary here precisely BECAUSE draft to published is
-- refused. If the permitted transition set is ever widened to include it, the
-- rate limit stops being optional and must be added in the same change.
--
-- The invariant that makes this sound: 'private' is reachable only from
-- 'published' through this function, so anything private was once validly
-- published and carries a version row.
--
-- updated_at is deliberately NOT touched. See part 3.

create or replace function public.set_sequence_status(p_sequence_id uuid, p_status text)
returns public.sequence_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_author uuid;
  v_current public.sequence_status;
  v_target public.sequence_status;
begin
  if v_caller is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('published', 'private') then
    raise exception 'A sequence can only be set to published or private here (got %). Publishing a draft goes through the publish RPCs.', coalesce(p_status, 'null')
      using errcode = '22023';
  end if;

  v_target := p_status::public.sequence_status;

  -- Ownership is resolved from the row, never from an argument. The row is read
  -- inside a definer function so RLS does not apply, which is exactly why the
  -- comparison below has to be explicit.
  select author_id, status into v_author, v_current
  from public.sequences
  where id = p_sequence_id;

  if v_author is null then
    raise exception 'No such sequence.' using errcode = 'P0002';
  end if;

  if v_author is distinct from v_caller then
    raise exception 'That is not your sequence.' using errcode = '42501';
  end if;

  if v_current not in ('published', 'private') then
    raise exception 'A sequence at status % cannot be changed here. Publishing a draft goes through the publish RPCs.', v_current
      using errcode = '22023';
  end if;

  if v_current = v_target then
    return v_current;
  end if;

  update public.sequences
  set status = v_target
  where id = p_sequence_id;

  return v_target;
end;
$$;

comment on function public.set_sequence_status(uuid, text) is
  'Moves one of the caller''s own sequences between published and private. Refuses any transition involving draft or archived, so the publish-time validations in create_sequence_with_version / publish_sequence_version / publish_draft_sequences_batch cannot be bypassed by a status write. Replaces the direct client-side column PATCH that ProfileTabs.tsx used before 2026-09-17.';

revoke all on function public.set_sequence_status(uuid, text) from public, anon;
grant execute on function public.set_sequence_status(uuid, text) to authenticated, service_role;

-- ============================================================================
-- PART 3 (H4 + H5): column-level grants on public.sequences
-- ============================================================================
--
-- The policy at 002:196-198 restricts the ROW and places no constraint on the
-- COLUMNS:
--
--     create policy "Authors can update their own sequences"
--       on public.sequences for update using (auth.uid() = author_id);
--
-- No migration has ever issued a table-level GRANT or REVOKE on this table, so
-- `authenticated` keeps Supabase's default UPDATE grant on every column. One
-- PATCH sets avg_score, rating_count, view_count, save_count, comment_count,
-- updated_at and is_featured to anything -- which is every ranking key in
-- browse-query.ts:38-46, including the DEFAULT sort on updated_at. Forged values
-- are durable: update_sequence_rating only fires on ratings writes, and
-- view_count, save_count and updated_at have no recompute path at all.
--
-- ADDING `with check` WOULD DO NOTHING. Postgres already reuses the USING
-- expression as the check on UPDATE, which is also why there is no
-- ownership-transfer hole. Column-level grants are the only mechanism that
-- constrains which columns an RLS-permitted UPDATE may touch.
--
-- WHY THERE IS NO updated_at TRIGGER, against the audit's suggestion. The
-- audit proposed moving updated_at to a BEFORE UPDATE trigger once it came off
-- the grant. It is not needed and it would have been actively harmful:
-- increment_view_count issues `update public.sequences set view_count = ...` on
-- every counted view, so an unconditional trigger would restamp updated_at on
-- every view and destroy the meaning of the default browse sort -- turning the
-- H4 symptom into a feature. The backfill route's discord_thread_id writes would
-- have done the same to 37 sequences at once. Revoking the column is sufficient
-- on its own, because every legitimate writer of updated_at is a SECURITY
-- DEFINER RPC that runs as the owner and is unaffected by the `authenticated`
-- grant, and the client never writes it.
--
-- TWO COLUMNS THE AUDIT'S LIST GOT WRONG, both found by reading the code rather
-- than the finding:
--
--   set_id                    MUST be granted. SequencePageClient.tsx:682, :706
--                             and :723 PATCH it from the browser to link and
--                             unlink sequences. It was absent from the audit's
--                             list, so revoking it would have broken linking.
--
--   discord_bridge_opted_out  MUST NOT be named. 017:26 puts it on
--                             public.profiles, not here. Naming a column that
--                             does not exist raises and rolls back the file.

do $$
declare
  -- Author-editable content. Everything a creator legitimately types, pastes or
  -- picks about their own sequence.
  v_intended text[] := array[
    'title', 'description',
    'class_id', 'class_name', 'spec_id', 'spec_name',
    'content_type', 'hero_talent',
    'patch_version', 'grip_version', 'wow_build',
    'step_function', 'step_count',
    'grip_string', 'raw_steps', 'actions', 'keybind_info',
    'talent_string', 'warcraftlogs_url', 'performance_notes',
    'collection_sequences', 'original_author',
    'set_id'
  ];

  -- Must end up NOT updatable by `authenticated`. Every ranking key, every
  -- server-minted identifier, and status, which is now part 2's RPC.
  v_must_stay_revoked text[] := array[
    'id', 'author_id', 'slug', 'status',
    'created_at', 'updated_at',
    'view_count', 'save_count', 'copy_count', 'comment_count',
    'avg_score', 'rating_count', 'is_featured',
    'current_version_id', 'current_version_label',
    'discord_thread_id', 'last_discord_notified_at',
    'attribution_acknowledged_at'
  ];

  v_existing text[];
  v_granting text[];
  v_missing text[];
  v_col text;
begin
  select coalesce(array_agg(column_name::text), array[]::text[])
  into v_existing
  from information_schema.columns
  where table_schema = 'public' and table_name = 'sequences';

  if array_length(v_existing, 1) is null then
    raise exception '031: public.sequences has no columns in information_schema -- refusing to grant blind.';
  end if;

  select coalesce(array_agg(c), array[]::text[]) into v_granting
  from unnest(v_intended) as c where c = any(v_existing);

  select coalesce(array_agg(c), array[]::text[]) into v_missing
  from unnest(v_intended) as c where not (c = any(v_existing));

  if array_length(v_missing, 1) is not null then
    -- A notice, not an exception. This is the 026 failure mode defanged: an
    -- intended column that does not exist is reported and skipped rather than
    -- rolling back every other statement in this file.
    raise notice '031: skipping % intended column(s) absent from public.sequences: %',
      array_length(v_missing, 1), array_to_string(v_missing, ', ');
  end if;

  if array_length(v_granting, 1) is null then
    raise exception '031: no intended column matched public.sequences -- refusing to leave the table with no author-writable columns.';
  end if;

  -- Order matters. Revoke first, then re-grant the narrow set, so there is no
  -- window in which both the table-level grant and the column grants are live.
  execute 'revoke update on public.sequences from public';
  execute 'revoke update on public.sequences from anon';
  execute 'revoke update on public.sequences from authenticated';

  execute format(
    'grant update (%s) on public.sequences to authenticated',
    (select string_agg(quote_ident(c), ', ' order by c) from unnest(v_granting) as c)
  );

  -- ------------------------------------------------------------------
  -- VERIFY THE OUTCOME. A grant that was issued is not a grant that holds.
  -- has_column_privilege is used rather than information_schema.column_privileges
  -- because the view only reports rows where a currently enabled role is grantor
  -- or grantee, and this needs to be true regardless of who runs the migration.
  -- ------------------------------------------------------------------
  foreach v_col in array v_must_stay_revoked loop
    if v_col = any(v_existing)
       and has_column_privilege('authenticated', 'public.sequences', v_col, 'UPDATE') then
      raise exception '031: authenticated still holds UPDATE on public.sequences.% after the revoke.', v_col;
    end if;
  end loop;

  foreach v_col in array v_granting loop
    if not has_column_privilege('authenticated', 'public.sequences', v_col, 'UPDATE') then
      raise exception '031: authenticated did NOT receive UPDATE on public.sequences.% -- authors would lose the ability to edit it.', v_col;
    end if;
  end loop;

  foreach v_col in array v_existing loop
    if has_column_privilege('anon', 'public.sequences', v_col, 'UPDATE') then
      raise exception '031: anon holds UPDATE on public.sequences.% -- it should hold none.', v_col;
    end if;
  end loop;

  raise notice '031: granted UPDATE on % column(s) to authenticated; % sensitive column(s) verified revoked; anon holds none.',
    array_length(v_granting, 1), array_length(v_must_stay_revoked, 1);
end $$;

-- service_role keeps everything. It is the admin client, it does its own
-- authorization in the routes, and eight of the nine createAdminClient call
-- sites were already doing so before this migration (the ninth was H1, closed
-- 2026-09-17).
grant update on public.sequences to service_role;
