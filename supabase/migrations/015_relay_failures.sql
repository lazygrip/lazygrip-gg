-- Landing place for outbound relay failures to Sataana's gripbot, after all
-- retries in fireSequenceRelay are exhausted. Exists so a repeated failure
-- is visible to a human somewhere durable, not just a console.error line
-- scrolling off in Vercel's log retention window. Slowdog (or anyone with
-- Supabase access) can query this directly; a dashboard view or alert can
-- be layered on top later if the volume warrants it.

create table public.relay_failures (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  payload jsonb not null,
  error text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index relay_failures_unresolved_idx
  on public.relay_failures (created_at)
  where resolved_at is null;

alter table public.relay_failures enable row level security;

-- Only the service role writes here (from the relay helper's server-side
-- code) and only the service role reads it back. No anon/authenticated
-- access at all -- this is an internal ops log, not user-facing data.
create policy "Service role only"
  on public.relay_failures
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
