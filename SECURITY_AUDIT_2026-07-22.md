# LazyGrip.net Security Audit — 2026-07-22

Full hostile-caller pass over both layers: every SECURITY DEFINER function in the
live Supabase database, and every API route in the deployed Next.js app. This is
the same style of audit Sataana runs (AI reading the actual code asking "who can
call this, what does it check, what happens if a hostile user passes someone
else's ID"), done deliberately on our side instead of waiting for the next
private disclosure.

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
- RLS policies on tables (the comments SELECT policy work was separate; a full
  policy-by-policy pass has not been done in one sitting)
- The toolbox droplet's Node service (authorLock.js was tested directly during
  the forgery fix, but the droplet isn't covered by this pass)
- The Discourse forum droplet
- Client-side code (XSS surface in rendering paths — dompurify is in place per
  the SEC6/SEC7 work, but this pass didn't re-verify every render site)
- Dependency vulnerabilities (that's npm audit's job, already in check-site.ps1)

---

## Repeatability

This audit = two artifacts, both kept:
1. The SQL query below, run in the Supabase SQL Editor, output read function by
   function
2. Reading each file under src/app/api/ off raw.githubusercontent.com (or the
   local clone) asking the hostile-caller question

```sql
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosrc as function_body
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;
```

Re-run trigger: after any new RPC, any schema change, any new API route, or any
merged PR that touches supabase/ or src/app/api/. The check-site.ps1 addition
(shipped alongside this doc) automates the reminder half of this.
