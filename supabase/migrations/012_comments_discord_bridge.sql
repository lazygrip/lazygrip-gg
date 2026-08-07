-- Discord comment bridge: tag each comment with where it originated, and
-- record the Discord message id for comments relayed in from Discord.
--
-- source: distinguishes a comment posted directly on lazygrip.net ('web')
-- from one relayed in from the GRIP Discord ('discord'). This is the field
-- the outbound site->Discord relay reads to avoid re-relaying a comment that
-- originated on Discord in the first place (see design doc section 3.3).
--
-- discord_message_id: the Discord message id for a relayed-in comment, used
-- both to avoid inserting the same Discord message twice on gateway replay
-- (reconnect, webhook retry) and, later, to support editing/deleting the
-- site comment when the source Discord message is edited/deleted.
--
-- The partial unique index only applies to non-null values, so the (large)
-- set of existing and future 'web' comments -- which will never have a
-- discord_message_id -- never collide with each other on this index.

alter table public.comments
  add column source text not null default 'web'
    check (source in ('web', 'discord')),
  add column discord_message_id text;

create unique index comments_discord_message_id_key
  on public.comments (discord_message_id)
  where discord_message_id is not null;
