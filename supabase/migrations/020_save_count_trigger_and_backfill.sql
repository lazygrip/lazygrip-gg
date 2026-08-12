-- Numbered 020, not 019. Applied to production as 019 on 2026-08-11, before
-- PR #39 (wow_build_and_export_backfill) was seen, which also claims 019.
-- PR #39 has not merged, this migration is already live, so this file is
-- renumbered rather than asking PR #39 to move. Same collision problem
-- PR #39's own header documents happening twice before (005, 006).
--
-- sequences.save_count has existed since 001_initial_schema.sql but nothing
-- has ever written to it: saves are inserted/deleted directly from
-- SequencePageClient.tsx with no trigger and no RPC touching save_count.
-- Confirmed via pg_proc (no save-related function existed) and via
-- information_schema.triggers (no trigger on saves or sequences) before
-- this migration. Every row's save_count sits at its default of 0
-- regardless of real saves.

create or replace function public.update_sequence_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update sequences set save_count = save_count + 1 where id = new.sequence_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update sequences set save_count = greatest(save_count - 1, 0) where id = old.sequence_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists saves_update_sequence_save_count on saves;
create trigger saves_update_sequence_save_count
after insert or delete on saves
for each row execute function public.update_sequence_save_count();

-- One-time backfill: correct every existing sequences.save_count from the
-- real saves table, since the column has been silently wrong since launch.
update sequences s
set save_count = coalesce(sv.real_count, 0)
from (
  select sequence_id, count(*) as real_count
  from saves
  group by sequence_id
) sv
where sv.sequence_id = s.id;

-- Sequences with zero real saves never appear in the subquery above and
-- were already 0, so no separate zero-out pass is needed.
