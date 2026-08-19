# check-rpc-audit.ps1
# Companion to check-site.ps1 -- covers the gap that build/lint/audit checks
# can't see: authorization logic inside SQL functions and new API routes.
#
# What this DOES automatically:
# 1. Scans every SECURITY DEFINER function defined in supabase/migrations/
#    and flags any whose body contains no auth.uid() reference.
# 2. Lists every API route file under src/app/api/ and compares against a
#    known-audited list, flagging anything new since the last full audit.
#
# What this CANNOT do automatically (and says so):
# - Read the LIVE database. The repo's migrations can lag or drift from
#   production (that exact drift caused real problems in July 2026), so a
#   clean result here does NOT prove the live DB is clean. The script prints
#   the SQL query to run in the Supabase SQL Editor for the real live check.
#
# Run from the repo root: .\check-rpc-audit.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== RPC / Route Authorization Audit ===" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# Part 1: SECURITY DEFINER functions in committed migrations
# ---------------------------------------------------------------------------
Write-Host "[1/3] Scanning supabase/migrations for SECURITY DEFINER functions..." -ForegroundColor Cyan

$migrationsPath = "supabase\migrations"
if (-not (Test-Path $migrationsPath)) {
    Write-Host "  supabase\migrations not found -- run this from the repo root." -ForegroundColor Red
    exit 1
}

# Every name here needs a REASON, not just a category, because "known exempt"
# is not one pattern -- three different ones live in this list and conflating
# them is exactly what let check_post_rate_limit hide here incorrectly for
# weeks (found and fixed 2026-08-19, see migration 022). It took an
# author_id parameter and had NO auth.uid() check AND no grant restriction --
# genuinely exploitable by anon, not a false positive. Removed from this list
# entirely: it does not belong in "known exempt", it belongs in the audit
# that scans grants, once that exists (see note in Part 3).
#
# Reason 1 -- TRIGGER: fires on INSERT/DELETE/UPDATE via Postgres itself,
# takes no parameters, no caller-supplied id of any kind to check.
# Reason 2 -- READ-ONLY ELIGIBILITY CHECK: takes an id, but only returns a
# boolean/read, never writes, and is called from inside an RPC that has
# ALREADY verified auth.uid() = p_author_id before calling it. The ownership
# check happens one level up; re-checking inside the read-only helper would
# be redundant, not protective.
# Reason 3 -- SERVICE-ROLE-ONLY: confirmed via live grant check
# (information_schema.routine_privileges) that EXECUTE is revoked from
# anon/authenticated and granted only to service_role/postgres. There is no
# auth.uid() to check because the only legitimate caller has no user session
# at all -- it's the server's own service-role key (see migration 013).
#
# If you add a NEW function to this list, pick which of the three reasons
# actually applies and say so -- "trigger/counter" was used as a catch-all
# in the past and that imprecision is what let a real bug hide here.
$knownExempt = @(
    # Reason 1: trigger functions, no parameters, no caller-supplied id.
    "handle_new_user",
    "increment_view_count",
    "increment_copy_count",
    "notify_on_comment",
    "notify_on_rating",
    "notify_on_reply",
    "update_comment_count",
    "update_sequence_rating",
    "update_sequence_save_count",

    # Reason 2: read-only eligibility checks, ownership verified by the
    # calling RPC before these are ever invoked. Added 2026-07-31
    # (is_verified_poster) and 2026-08-19 (the rest, found misclassified
    # during that day's false-positive review).
    "is_verified_poster",
    "has_completed_onboarding",
    "has_custom_username",

    # Reason 3: service-role-only, confirmed via live grant check
    # (migration 013). No anon/authenticated grant exists to exploit.
    "lookup_discord_id_by_user_id",
    "lookup_profile_by_discord_id"
)

$flagged = @()
$latestDefs = @{}

Get-ChildItem $migrationsPath -Filter "*.sql" | Sort-Object Name | ForEach-Object {
    $content = Get-Content $_.FullName -Raw

    # Find each CREATE [OR REPLACE] FUNCTION block that declares security definer.
    # Function bodies are dollar-quoted; capture from CREATE up to the closing
    # dollar-quote tag. Case-insensitive throughout.
    $pattern = '(?is)create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(.*?security\s+definer.*?as\s+(\$[a-z0-9_]*\$)(.*?)\2'
    $matches2 = [regex]::Matches($content, $pattern)

    foreach ($m in $matches2) {
        $fnName = $m.Groups[1].Value
        $body = $m.Groups[3].Value

        # CREATE OR REPLACE means a later file's definition supersedes an
        # earlier one -- e.g. 002_schema_sync.sql has the original (buggy)
        # bodies of several functions that were fixed via CREATE OR REPLACE
        # in a later-numbered migration (005). Overwrite rather than append,
        # so by the time we're done, $latestDefs holds only the final body
        # each function actually resolves to -- matching how Postgres itself
        # would apply these migrations in order.
        $latestDefs[$fnName] = [pscustomobject]@{ Function = $fnName; File = $_.Name; Body = $body }
    }
}

$checkedCount = $latestDefs.Count
foreach ($fnName in ($latestDefs.Keys | Sort-Object)) {
    $def = $latestDefs[$fnName]

    if ($knownExempt -contains $fnName) {
        Write-Host "  SKIP  $fnName (known exempt, see reason categories above knownExempt)" -ForegroundColor DarkGray
        continue
    }

    if ($def.Body -notmatch 'auth\.uid\s*\(\s*\)') {
        $flagged += [pscustomobject]@{ Function = $fnName; File = $def.File }
        Write-Host "  FAIL  $fnName in $($def.File) (latest definition) -- SECURITY DEFINER with NO auth.uid() reference" -ForegroundColor Red
    }
    else {
        Write-Host "  OK    $fnName (latest definition: $($def.File))" -ForegroundColor Green
    }
}

Write-Host ""
if ($flagged.Count -gt 0) {
    Write-Host "  $($flagged.Count) function(s) flagged. This is the exact bug pattern found in" -ForegroundColor Red
    Write-Host "  delete_sequence_version, update_sequence_metadata, and" -ForegroundColor Red
    Write-Host "  update_sequence_with_version in July 2026. Read each flagged body" -ForegroundColor Red
    Write-Host "  and either add the check, or determine which knownExempt reason" -ForegroundColor Red
    Write-Host "  (trigger / read-only-eligibility-check / service-role-only) actually" -ForegroundColor Red
    Write-Host "  applies and add it with that reason. If it takes a caller-suppliable" -ForegroundColor Red
    Write-Host "  id AND writes data AND has no grant restriction, that is not exempt --" -ForegroundColor Red
    Write-Host "  that is the check_post_rate_limit bug from 2026-08-19 (migration 022)." -ForegroundColor Red
}
else {
    Write-Host "  All $checkedCount SECURITY DEFINER function definitions in migrations pass." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Part 2: API route inventory vs last-audited list
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[2/3] Checking for API routes added since the last full audit..." -ForegroundColor Cyan

# Every route file read line-by-line in the 2026-07-22 audit
# (see SECURITY_AUDIT_2026-07-22.md). Update this list whenever a new route
# gets its own hostile-caller read.
# 2026-07-31: added workshop/decode (existing route, missed by the original
# audit's list -- confirmed stateless/no-auth-needed same as its siblings).
# All six decode/convert/import/build routes below also got IP rate limiting
# added 2026-07-31 (src/lib/rate-limit.ts) -- this script only tracks route
# existence, not content changes, so that's noted here rather than something
# this script would catch on its own.
# 2026-08-19: nine routes flagged NEW by this script's own Part 2 output
# (admin/sequence-thread, comments + comments/delete + comments/edit,
# relay/discord-comment + delete + edit, relay-identity, sequences/delete)
# still need their hostile-caller read and addition to this list -- carried
# forward as an open item from this session, not silently resolved.
$auditedRoutes = @(
    "src\app\api\cron\patch-reminder\route.ts",
    "src\app\api\decode-grip\route.ts",
    "src\app\api\notify-discord\route.ts",
    "src\app\api\workshop\build\route.ts",
    "src\app\api\workshop\convert\route.ts",
    "src\app\api\workshop\convert-spell-texts\route.ts",
    "src\app\api\workshop\decode\route.ts",
    "src\app\api\workshop\import\route.ts",
    "src\app\api\workshop\spells\route.ts"
)

$currentRoutes = Get-ChildItem "src\app\api" -Recurse -Filter "route.ts" |
    ForEach-Object { $_.FullName.Substring((Get-Location).Path.Length + 1) }

$newRoutes = $currentRoutes | Where-Object { $auditedRoutes -notcontains $_ }
$removedRoutes = $auditedRoutes | Where-Object { $currentRoutes -notcontains $_ }

if ($newRoutes) {
    foreach ($r in $newRoutes) {
        Write-Host "  NEW   $r -- not covered by the last audit, needs a hostile-caller read" -ForegroundColor Yellow
    }
}
if ($removedRoutes) {
    foreach ($r in $removedRoutes) {
        Write-Host "  GONE  $r -- was audited, no longer exists (fine, just noting)" -ForegroundColor DarkGray
    }
}
if (-not $newRoutes) {
    Write-Host "  No new API routes since the last full audit ($($currentRoutes.Count) routes present)." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Part 3: The live-database check this script cannot do for you
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/3] Live database check (manual -- repo files can drift from prod):" -ForegroundColor Cyan
Write-Host ""
Write-Host "  A clean Part 1 only proves the MIGRATION FILES are clean. The July 2026" -ForegroundColor Yellow
Write-Host "  incidents were all cases where live DB and repo disagreed. For the real" -ForegroundColor Yellow
Write-Host "  check, paste this into the Supabase SQL Editor and read every body that" -ForegroundColor Yellow
Write-Host "  takes a p_author_id parameter, confirming it compares against auth.uid():" -ForegroundColor Yellow
Write-Host ""
Write-Host "  select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosrc" -ForegroundColor White
Write-Host "  from pg_proc p join pg_namespace n on p.pronamespace = n.oid" -ForegroundColor White
Write-Host "  where n.nspname = 'public' and p.prosecdef = true order by p.proname;" -ForegroundColor White
Write-Host ""
Write-Host "  2026-08-19 addition: auth.uid() presence is not the only thing that" -ForegroundColor Yellow
Write-Host "  matters -- check_post_rate_limit had no auth.uid() check AND was" -ForegroundColor Yellow
Write-Host "  grantable to anon/PUBLIC, live in production, until fixed same day" -ForegroundColor Yellow
Write-Host "  (migration 022). Also run this query and confirm no SECURITY DEFINER" -ForegroundColor Yellow
Write-Host "  function that writes data is reachable by anon or PUBLIC unless it" -ForegroundColor Yellow
Write-Host "  genuinely needs to be (e.g. signup-time triggers):" -ForegroundColor Yellow
Write-Host ""
Write-Host "  select routine_name, grantee, privilege_type" -ForegroundColor White
Write-Host "  from information_schema.routine_privileges" -ForegroundColor White
Write-Host "  where routine_schema = 'public' and grantee in ('anon', 'PUBLIC')" -ForegroundColor White
Write-Host "  order by routine_name;" -ForegroundColor White
Write-Host ""
Write-Host "  Re-run this whole audit after: any new RPC, any schema change, any new" -ForegroundColor Yellow
Write-Host "  API route, or any merged PR touching supabase/ or src/app/api/." -ForegroundColor Yellow
Write-Host ""

if ($flagged.Count -gt 0) { exit 1 } else { exit 0 }
