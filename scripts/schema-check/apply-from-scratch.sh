#!/usr/bin/env bash
#
# Apply every migration, in order, to an EMPTY database, and report which ones
# fail. Compares the result against scripts/schema-check/known-failures.txt and
# exits non-zero on any difference in either direction.
#
# WHY THIS EXISTS. On 2026-09-17 a from-scratch apply was measured for the first
# time and 8 of 30 migrations failed. Migration 003 is missing from the repo
# entirely -- the sequence runs 001, 002, 004 -- so public.sequences comes out
# with 28 columns where production has 41, and 024 alters a copy_count_throttle
# table that nothing creates. None of it was visible, because every migration had
# only ever been applied to a database that already had the missing objects.
# See issue #78.
#
# Needs: psql on PATH, and a reachable empty PostgreSQL. Reads PGHOST/PGPORT/
# PGUSER/PGPASSWORD the way psql does.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="${MIGRATIONS_DIR:-$HERE/../../supabase/migrations}"
STUB="$HERE/supabase-stub.sql"
BASELINE="$HERE/known-failures.txt"
DB="${SCHEMA_CHECK_DB:-lazygrip_from_scratch}"

psql -q -c "drop database if exists $DB;"  >/dev/null || exit 3
psql -q -c "create database $DB;"          >/dev/null || exit 3

if ! OUT=$(psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$STUB" 2>&1); then
    echo "HARNESS FAILURE: the Supabase stand-in did not apply."
    echo "This is the harness being wrong, not a migration being wrong."
    echo "$OUT"
    exit 3
fi

declare -a ACTUAL=()
PASS=0
for f in $(ls "$MIGRATIONS"/*.sql | sort); do
    b=$(basename "$f")
    if ERR=$(psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" 2>&1); then
        PASS=$((PASS + 1))
        printf '  ok    %s\n' "$b"
    else
        ACTUAL+=("$b")
        printf '  FAIL  %s\n' "$b"
        printf '%s\n' "$ERR" | grep -E '^(psql:)?.*ERROR' | head -1 | sed 's/^/          /'
    fi
done

# tr -d '\r': the repo is checked out CRLF on Windows, and a trailing \r
# would make every filename compare unequal.
EXPECTED=$(tr -d '\r' < "$BASELINE" | grep -v '^#' | grep -v '^[[:space:]]*$' | awk '{print $1}' | sort)
ACTUAL_S=$(printf '%s\n' "${ACTUAL[@]+"${ACTUAL[@]}"}" | grep -v '^$' | sort)

echo
echo "applied clean: $PASS   failed: $(printf '%s\n' "$ACTUAL_S" | grep -c .)   of $(ls "$MIGRATIONS"/*.sql | wc -l)"

NEW=$(comm -13 <(printf '%s\n' "$EXPECTED") <(printf '%s\n' "$ACTUAL_S"))
FIXED=$(comm -23 <(printf '%s\n' "$EXPECTED") <(printf '%s\n' "$ACTUAL_S"))

RC=0
if [ -n "$NEW" ]; then
    echo
    echo "NEW FAILURES -- a migration that used to apply to an empty database no longer does:"
    printf '%s\n' "$NEW" | sed 's/^/  /'
    RC=1
fi
if [ -n "$FIXED" ]; then
    echo
    echo "FIXED, and the baseline still lists them. Remove these lines from"
    echo "scripts/schema-check/known-failures.txt in the same change that fixed them:"
    printf '%s\n' "$FIXED" | sed 's/^/  /'
    RC=1
fi
[ $RC -eq 0 ] && echo && echo "failure set matches the baseline."
exit $RC
