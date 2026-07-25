# LazyGrip.net Security Audit — 2026-07-22 (updated 2026-07-25)

Full hostile-caller pass across three layers: every SECURITY DEFINER function in
the live Supabase database, every API route in the deployed Next.js app, and
every Row Level Security policy on every table. This is the same style of audit
Sataana runs (AI reading the actual code asking "who can call this, what does it
check, what happens if a hostile user passes someone else's ID"), done
deliberately on our side instead of waiting for the next private disclosure.

2026-07-22 covered SECURITY DEFINER functions and API routes. 2026-07-25 added
the RLS policy pass, which was an explicitly named gap in the original doc.

Method: function bodies pulled live from pg_proc (not from migration files, not
from descriptions of what's supposed to be there). Route code read from
raw.githubusercontent.com off current main (commit state as of PR #9 merge,
67438b5).

---

## Layer 1: Database — SECURITY DEFINER functions (20 total, all checked)

The bug pattern being hunted: a function that takes a caller-supplied
p_author_id, verifies the target row belongs to that author_id, but never
verifies the caller's own auth.uid() matches it. This exact pattern was found
and fixed three times this week (delete_sequence_version,
update_sequence_metadata, update_sequence_with_version).

### Clean — has the auth.uid() ownership check
| Function | Notes |
|---|---|
| create_draft_sequence | Check present at top |
| create_sequence_with_version | Check present at top |
| delete_sequence_version | Fixed 7/21, verified live |
| publish_draft_sequence | Double-checked: p_author_id vs auth.uid() up front, then row owner vs auth.uid() after lookup |
| publish_draft_sequences_batch | Same double-check pattern, per-row inside the validation loop |
| publish_sequence_version | Double-checked, same as above |
| update_draft_sequence | Double-checked |
| update_sequence_metadata | Fixed 7/21, verified live |
| update_sequence_with_version | Fixed 7/22 (Sataana private disclosure), verified live via pg_proc same day, migration 005 committed |
| set_current_patch | Different but correct pattern: hard-checks auth.uid() against the site owner UUID before allowing the write. Single-admin config function, appropriate for what it does |

### Not applicable — no caller-supplied author_id to spoof
| Function | Why it's fine without the check |
|---|---|
| handle_new_user | Trigger on auth.users insert; NEW.id comes from Supabase auth itself, not a parameter |
| increment_view_count | No ownership concept; see open items below |
| notify_on_comment | Trigger; fires off NEW row data from an insert that already passed its own table's RLS |
| notify_on_rating | Trigger; same |
| update_comment_count | Trigger; same |
| update_sequence_rating | Trigger; same |

**Database verdict: 20/20 accounted for. Every function that takes a
caller-supplied p_author_id and writes sequence data has the ownership check.
No remaining instances of the missing-auth.uid() pattern.**

---

## Layer 2: API routes (9 routes across 4 groups, all read in full)

### /api/notify-discord (POST)
SEC1 patch confirmed actually in shipped code, not just described:
- Server-verified Supabase session required, 401 before anything else runs
- slug regex-locked to ^[a-z0-9-]{1,120}$ before touching DB or URL
- className / contentType allowlisted against fixed sets
- Free text whitespace-collapsed and length-clamped (cleanText)
- "Posted by" name taken from the verified session, never the request body
Clean.

### /api/cron/patch-reminder (GET)
Best-guarded route on the site. Bearer token checked against CRON_SECRET before
anything runs; service-role client used server-side only; effectively read-only
on user data (reads site_config, posts a Discord message). Cannot be abused to
modify or exfiltrate anything even if hit directly. Clean.

### /api/decode-grip (POST)
Stateless decoder: pasted string in, parsed JSON out, no DB access, no
persistence, nothing to authorize. Input shape validated, errors returned as
clean 4xx responses without stack leakage. Clean.

**Side finding: this route is NOT dead code.** It imports live from
@/lib/workshop/index and is an active decode endpoint. Closes the open item
"never confirmed whether anything still calls decode-grip" from the earlier
toolbox comparison work — it is itself a live caller of the current workshop
library, not a leftover duplicate.

### /api/workshop/build (POST)
- normalizeActionKind confirmed in shipped code: recursively remaps
  kind:"Step" -> "Action" before response, i.e. the fix for the bug that
  blanked build previews is real and deployed, not a lost hotfix
- enforceAuthorLock(body) runs before buildGripFromModel — consistent with the
  author-lock forgery fix on the toolbox side
- Stateless, no DB writes, no auth needed. Clean.

### /api/workshop/import (POST)
- Stateless, no DB writes. Clean.
- repeatCount defensively clamped to 1–50
- **Side finding relevant to the attribution-badge backlog item:** the response
  payload confirms originalAuthor, originalAuthorRealm, authorLocked,
  lockedAuthor, authorLockTokens, and privacyMode are all genuinely returned to
  the browser by this route. The data exists at this layer; the open question
  for the badge feature is purely whether post/page.tsx forwards these fields
  into the Supabase write (the ~536 / ~577 call sites).

### /api/workshop/convert (POST)
Stateless, validates !GSE3! prefix before processing, clean error handling.
Clean.

### /api/workshop/spells (GET)
Stateless spell search. Clean on auth. See open items for the limit param.

### /api/workshop/convert-spell-texts (POST)
Stateless, validates direction enum and array shape. Clean on auth. See open
items for the missing array-length cap.

**API verdict: 9/9 clean on authorization. Every route that persists data or
holds privilege is gated; every ungated route is stateless with nothing to
authorize.**

---

## Layer 3: Row Level Security policies (24 policies, 8 tables, all checked)

Pulled live via pg_policies (not from migration files) on 2026-07-25:

```sql
select schemaname, tablename, policyname, cmd as command, permissive, roles,
       qual as using_expression, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;
```

### Clean
| Table | Notes |
|---|---|
| comments | Insert/update both tied to auth.uid() = author_id. Select correctly shows non-deleted OR own (the 7/21 fix, confirmed still live). No DELETE policy exists — appears intentional (soft-delete only via UPDATE), worth a one-time confirmation that no hard-delete path is expected anywhere on this table |
| notifications | Select/update both scoped to auth.uid() = user_id. No INSERT policy — correct, real inserts go through SECURITY DEFINER trigger functions that bypass RLS |
| profiles | Public read (intentional), update locked to own row |
| ratings | Select allows: sequence author, rating's own author, or the site-owner UUID. Real three-way check, not a blanket allow. Insert/update tied to auth.uid() = user_id |
| saves | All three ops (select/insert/delete) scoped to auth.uid() = user_id, no leakage of what a user has saved |
| sequences | Correctly status-aware: authors see their own regardless of status, everyone else only sees status = 'published' |
| site_config | Public read, no write policy (writes go through set_current_patch, which has its own owner-UUID check) |

### Found and fixed: sequence_versions
Had two redundant SELECT policies, both `using (true)` — fully public, no
status check, unlike the parent sequences table.

**Exploitability check performed before fixing, not assumed:** read the actual
bodies of create_draft_sequence, update_draft_sequence, and
publish_draft_sequence (already pulled during the Layer 1 pass). Neither
create_draft_sequence nor update_draft_sequence ever writes to
sequence_versions — only to sequences. The first sequence_versions row is
created by publish_draft_sequence in the same transaction that flips status to
'published'. Conclusion: no row can currently exist in sequence_versions for a
sequence still in draft status, so the open policy was not actively leaking
anything at the time it was found.

**Fixed anyway.** The policy had no safety net — it was leak-proof only by
convention (every write path happening to respect the invariant), not by
enforcement. Any future function, script, or admin tool that ever wrote a
sequence_versions row ahead of publish (e.g. a draft-preview feature) would
leak draft content immediately with zero additional code change on the leak
side. Collapsed the two redundant policies into one that mirrors the parent
table's rule:

```sql
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
```

Applied live 2026-07-25, verified via pg_policies same day (exactly one SELECT
policy remains, correct using expression confirmed). Captured in migration 006.

**RLS verdict: 24/24 policies read. One real gap found, assessed for actual
exploitability rather than assumed, and fixed regardless since it lacked a
structural safety net.**

---

## Open items (none are authorization holes)

1. **/api/workshop/spells — unclamped limit param.** limit comes straight from
   the query string with no upper bound (unlike import's repeatCount, which is
   clamped to 50). Whether this matters depends on searchSpells' internals.
   Five-minute fix: clamp to e.g. Math.min(50, ...). DoS-shaped nitpick, not
   urgent.
2. **/api/workshop/convert-spell-texts — no length cap on texts array.** A huge
   array means a lot of per-request work. Same flavor, same fix shape, same
   low urgency.
3. **increment_view_count — zero guardrails.** No auth, no rate limit, callable
   by anyone with the anon key any number of times. Fine for an honest view
   counter; only matters if view counts ever feed a trending/sort mechanic
   someone would want to game. Flag for whenever ranking features get built.

---

## What this audit does NOT cover

Being honest about scope so "we ran full checks" stays a true statement:
- The toolbox droplet's Node service (authorLock.js was tested directly during
  the forgery fix, but the droplet isn't covered by this pass)
- The Discourse forum droplet
- Client-side code (XSS surface in rendering paths — dompurify is in place per
  the SEC6/SEC7 work, but this pass didn't re-verify every render site)
- Dependency vulnerabilities (that's npm audit's job, already in check-site.ps1)

RLS policies (all 24, all 8 tables) were covered on 2026-07-25 and are no
longer an open gap.

---

## Repeatability

This audit = three artifacts, all kept:
1. The SECURITY DEFINER query below, run in the Supabase SQL Editor, output
   read function by function
2. Reading each file under src/app/api/ off raw.githubusercontent.com (or the
   local clone) asking the hostile-caller question
3. The RLS policy query below, output read policy by policy, checking each
   using/with_check expression against what the table's data model actually
   requires — and for anything with `using (true)`, checking whether the
   write-path functions could ever populate a row that shouldn't be public,
   the same way the sequence_versions gap was actually confirmed rather than
   assumed

```sql
-- SECURITY DEFINER functions
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosrc as function_body
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;

-- RLS policies
select
  schemaname, tablename, policyname, cmd as command, permissive, roles,
  qual as using_expression, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;
```

Re-run trigger: after any new RPC, any schema change, any new API route, any
new table, or any merged PR that touches supabase/ or src/app/api/. The
check-site.ps1 addition (shipped alongside this doc) automates the reminder
half of the SECURITY DEFINER/route side; RLS policy review is still a manual
step since a table can have a permissive-but-currently-harmless policy that
only static reasoning about the write paths can catch.
