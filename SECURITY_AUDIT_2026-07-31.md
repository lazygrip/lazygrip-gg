# LazyGrip.net Security Audit — 2026-07-31

Follow-on to SECURITY_AUDIT_2026-07-22.md (updated 2026-07-25). That audit's
own repeatability trigger — "re-run after any new RPC, any schema change, any
new API route, or any merged PR touching supabase/ or src/app/api/" — was hit
repeatedly today: three new SECURITY DEFINER functions created, three existing
ones modified, six API route files touched. This doc closes that loop.

Trigger for this session: an unverified Battle.net account (auth never
completed, no confirmed email, no display name) published a low-effort,
taunting sequence through the normal posting flow. That flow had no gate
beyond "are you signed in as yourself" — which was true and sufficient for
every prior audit's threat model (spoofed ownership), but not for this one
(an authenticated-but-illegitimate account posting at all).

---

## What shipped today

**New SECURITY DEFINER functions:**
- `is_verified_poster(check_user_id uuid) returns boolean` — checks display_name
  is set, auth is fully completed (confirmed email OR completed OAuth sign-in),
  and account is older than 60 minutes. Side-effect-free.
- `check_post_rate_limit(check_author_id uuid) returns boolean` — for accounts
  under 7 days old, caps at 1 post/hour and 3/day via a new
  `post_rate_throttle` table (same shape as the existing
  `view_count_throttle` pattern from migration 006). Has a side effect
  (inserts a throttle row) — called only after `is_verified_poster` passes,
  and only once per real insert attempt.

**Modified SECURITY DEFINER functions** (added calls to both functions above,
right after the existing `auth.uid()` ownership check, before any write):
- `create_draft_sequence` — verification check only (drafts aren't public yet)
- `create_sequence_with_version` — verification + rate limit (publishes
  immediately)
- `publish_draft_sequence` — verification + rate limit (the primary
  draft→publish path)
- `publish_draft_sequences_batch` — verification + rate limit. **This was a
  real, live gap**, not a hypothetical: it has the same ownership check and
  draft-validity checks as `publish_draft_sequence` but was missed in the
  first pass this session, since it wasn't the function exercised by the
  incident that started the session. Found by reading the full inventory of
  SECURITY DEFINER functions rather than only patching the one path that had
  visibly failed. Confirmed fixed via live `pg_get_functiondef()` pull
  showing the new checks in the body, then verified end-to-end through the
  actual site UI (draft created, selected, published via "Publish N
  selected", which calls this exact function).

**Deliberately left unchanged:**
- `publish_sequence_version` — publishes a new *version* of an
  already-published sequence, not new content. A sequence reaching this
  function has, by definition, already passed the gate once via
  `publish_draft_sequence` or `create_sequence_with_version`. Gating this too
  would be redundant, not protective.
- `update_draft_sequence`, `update_sequence_metadata`,
  `update_sequence_with_version`, `delete_sequence_version` — these only ever
  touch content the caller already owns (ownership check already present, per
  2026-07-22 audit). Adding the posting gate here would retroactively lock out
  the 8 existing users (25 sequences, mostly TheKohtas) who are missing a
  display_name from editing their own already-published work — explicitly the
  breakage this session's grandfathering decision was meant to avoid.

**RLS policy (defense-in-depth, not the primary gate):**
`sequences` INSERT policy updated to also call `is_verified_poster()` and
`check_post_rate_limit()`. This only actually covers the one raw `.insert()`
path in post/page.tsx (the collection-publish fallback) — every other posting
path is SECURITY DEFINER and bypasses RLS on write by design (Postgres does
not re-check RLS inside a SECURITY DEFINER function body). Kept anyway as a
second layer for the one path it does cover; the real enforcement lives inside
the RPC function bodies above.

**New file:** `src/lib/rate-limit.ts` — lightweight in-memory (not
DB-backed, unlike `view_count_throttle`) IP rate limiter, wired into the five
public Workshop decode/convert/import/build routes (30 req/min per IP).
Deliberate tradeoff: these are high-frequency, low-stakes, intentionally
public-without-auth endpoints; a DB round-trip per decode call is the wrong
cost for the threat model (a single sustained script, not a coordinated
botnet). Documented in the file itself.

**Dependency bump:** `next` 16.2.10 → 16.2.12 (patch-level, safe). The real
Next.js July 2026 security release (9 CVEs, 4 high / 5 medium, including a
Server Actions DoS) was already covered — the site was on 16.2.11-equivalent
before this session. `npm audit`'s remaining 17 high-severity findings
(`postcss`, `sharp`) are bundled inside `next`'s own internals (confirmed via
`npm ls`), not independently upgradable from `package.json`, and unrelated to
the July CVEs. Do not run `npm audit fix --force` — it proposes downgrading
`next` to `9.3.3`.

---

## check-rpc-audit.ps1 run and false-positive explanation

Ran today, post-changes. Flagged three false positives:
`delete_sequence_version`, `update_sequence_metadata`,
`update_sequence_with_version` — all three showing as missing `auth.uid()`.

**Root cause, not a live bug:** the script's regex scan matched the *first*
occurrence of each function name across migration files in filename order.
`002_schema_sync.sql` contains the original, pre-fix bodies of these three
functions (from before the July 21–22 fixes documented in the prior audit).
The corrected bodies were applied later via `CREATE OR REPLACE` in
`005_security_definer_ownership_checks.sql`. The script had no "last write
wins" resolution across files, so it reported on the superseded body instead
of the one actually live in production.

Confirmed via live `pg_get_functiondef()` pull earlier this session (see
session transcript) that all three functions' *actual running bodies* contain
the `auth.uid()` check. Not a database problem — a tooling gap.

**Fixed:** `check-rpc-audit.ps1` now resolves each function name to its
*last* definition across migration files in sort order (matching how
Postgres itself would apply `CREATE OR REPLACE` semantics) before checking
for `auth.uid()`, instead of stopping at the first match. Re-run after the
fix should show `OK` for all three with `(latest definition: ...)` pointing
at `005_security_definer_ownership_checks.sql`, not `002_schema_sync.sql`.

Also updated:
- `$knownExempt` — added `is_verified_poster` and `check_post_rate_limit`,
  with an explanatory comment: these check *eligibility* of a target account
  (is this author_id allowed to post at all), not *ownership* of a row being
  written. They're called from inside functions that already do the
  `auth.uid() = p_author_id` check themselves before calling these — a
  different, correctly-exempt pattern from the missing-check bug this script
  hunts for.
- `$auditedRoutes` — added `src\app\api\workshop\decode\route.ts`, which
  existed before this session but wasn't in the original audit's route list.
  Read today while adding rate limiting: stateless, no DB writes, no auth
  needed — same clean verdict as its siblings.

---

## Verdict

No new authorization holes found beyond the one closed this session
(`publish_draft_sequences_batch`). The three `check-rpc-audit.ps1` flags were
a tooling false-positive, now fixed at the source so future runs won't repeat
it. `workshop/decode` route reviewed and cleared. Today's new functions
(`is_verified_poster`, `check_post_rate_limit`) are a different, deliberately
different pattern from the ownership-check bug class this audit lineage
exists to catch, and are now correctly exempted rather than silently missing
from the list.

**Open items carried forward from 2026-07-22 (still true, still not
authorization holes):**
1. `/api/workshop/spells` — unclamped `limit` param. Still low urgency.
2. `/api/workshop/convert-spell-texts` — no length cap on `texts` array.
   Still low urgency.
3. `increment_view_count` — no auth, no rate limit. Still fine as an honest
   counter; matters only if view counts ever feed a trending/sort mechanic.

**New open item:**
4. `handle_new_user`, `notify_on_comment`, `notify_on_rating`,
   `update_comment_count`, `update_sequence_rating` were re-confirmed exempt
   today (trigger functions, no caller-supplied `author_id`) but not
   independently re-read line-by-line this session — carried forward as
   "still believed clean per 2026-07-22 read," not "re-verified 2026-07-31."

**Scope note:** this session's sweep also covered SSL/DNS posture for the
main site (Let's Encrypt cert healthy, auto-renewing via Vercel, no CAA
record — optional hardening, not urgent) and confirmed the forum droplet
remains explicitly out of scope, to be audited separately given its
manually-managed infrastructure (SSH, Docker, certbot) differs fundamentally
from the main site's Vercel-managed deploy.

Re-run trigger: same as 2026-07-22 — any new RPC, schema change, new API
route, new table, or merged PR touching `supabase/` or `src/app/api/`.
