#!/usr/bin/env bash
# Applies the real migrations to a throwaway local PostgreSQL database (with a
# tiny Supabase stand-in) and runs the functional + concurrency tests.
#
# Usage: PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres scripts/db-test/run.sh
# Needs PostgreSQL 14+ client tools and a superuser connection. Never point
# this at the production database: it drops and recreates $DB.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${DB:-campusconnect_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f scripts/db-test/supabase-stub.sql
"${PSQL[@]}" -d "$DB" -f drizzle/migrations/0000_migration.sql
"${PSQL[@]}" -d "$DB" -f scripts/db-test/legacy-pass.sql
for f in drizzle/migrations/0[0-9][0-9][1-9]_*.sql; do "${PSQL[@]}" -d "$DB" -f "$f"; done
"${PSQL[@]}" -d "$DB" -o /dev/null -f scripts/db-test/tests.sql 2>&1 | sed -E "s/^psql:[^ ]+ NOTICE:  /  /"

q() { "${PSQL[@]}" -d "$DB" -At -c "$1"; }
fail() { echo "FAILED: $1"; exit 1; }
EV=$(q "select v from t.kv where k = 'race_ev'")

echo "concurrency: 20 simultaneous registrations for 5 seats"
for i in $(seq 1 20); do
  "${PSQL[@]}" -d "$DB" -At -c "set role anon; select registration_code from public.register_for_event('$EV', 'Racer $i', 'RACE$(printf %04d "$i")', 'Civil Engineering')" >/dev/null 2>&1 &
done
wait
[ "$(q "select count(*) from registrations where event_id = '$EV'")" = 5 ] || fail "overbooked"
[ "$(q "select confirmed_count from events where id = '$EV'")" = 5 ] || fail "counter drift"
echo "  ok - exactly 5 registered, counter = 5"

echo "concurrency: 10 simultaneous registrations with the same PRN"
q "update events set capacity = 100 where id = '$EV'" >/dev/null
for i in $(seq 1 10); do
  "${PSQL[@]}" -d "$DB" -At -c "set role anon; select 1 from public.register_for_event('$EV', 'Twin $i', 'SAMEPRN01', 'Civil Engineering')" >/dev/null 2>&1 &
done
wait
[ "$(q "select count(*) from registrations where prn = 'SAMEPRN01'")" = 1 ] || fail "duplicate PRN"
echo "  ok - exactly 1 registration for the PRN"

echo "concurrency: 10 simultaneous check-ins of one pass"
TOK=$("${PSQL[@]}" -d "$DB" -At -c "set role anon; select token from public.register_for_event('$EV', 'Door Test', 'DOOR0001', 'Civil Engineering')" | tail -n1)
ORG=$(q "select v from t.kv where k = 'org'")
OUT=$(mktemp)
for i in $(seq 1 10); do
  "${PSQL[@]}" -d "$DB" -At -c "set role authenticated; select set_config('request.jwt.claim.sub', '$ORG', false); select result from public.check_in_pass('$TOK')" 2>&1 | tail -n1 >>"$OUT" &
done
wait
[ "$(grep -c '^checked_in$' "$OUT")" = 1 ] || { cat "$OUT"; fail "pass checked in more than once"; }
[ "$(grep -c '^already_checked_in$' "$OUT")" = 9 ] || { cat "$OUT"; fail "unexpected check-in results"; }
rm -f "$OUT"
echo "  ok - 1 checked_in, 9 already_checked_in"

echo "ALL DATABASE TESTS PASSED"
