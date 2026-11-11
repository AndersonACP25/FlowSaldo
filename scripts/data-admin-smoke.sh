#!/usr/bin/env bash
set -euo pipefail
test -n "${PG_CONTAINER:?}"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"
cat > "$work/bin/pg-tool" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
tool=$(basename "$0")
args=("$@")
if [[ "$tool" == pg_restore ]]; then
 last=$(("${#args[@]}" - 1))
 remote=$(docker exec "$PG_CONTAINER" mktemp)
 trap 'docker exec "$PG_CONTAINER" rm -f "$remote"' EXIT
 docker cp "${args[$last]}" "$PG_CONTAINER:$remote" >/dev/null
 args[$last]=$remote
fi
docker exec -i -e PGHOST -e PGPORT -e PGDATABASE -e PGUSER -e PGPASSWORD -e PGSSLMODE "$PG_CONTAINER" "$tool" "${args[@]}"
WRAPPER
chmod +x "$work/bin/pg-tool"
for tool in pg_dump pg_restore psql; do ln -s pg-tool "$work/bin/$tool"; done
export PATH="$work/bin:$PATH"
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=flowsaldo PGPASSWORD=flowsaldo_local PGSSLMODE=prefer
export PGDATABASE=flowsaldo DATABASE_URL=postgresql://flowsaldo:flowsaldo_local@127.0.0.1:5432/flowsaldo
snapshot() {
 psql -XqAtw <<'SQL'
SELECT (SELECT count(*) FROM "Movement"),
       (SELECT count(*) FROM "FinancialAccount"),
       (SELECT count(*) FROM "Reconciliation"),
       (SELECT count(*) FROM "BudgetPeriod"),
       (SELECT count(*) FROM "AppOwner"),
       (SELECT md5(COALESCE(string_agg(id || ':' || "amountMinor"::text, ',' ORDER BY id), '')) FROM "Movement");
SQL
}
before=$(snapshot)
pnpm data:admin backup "$work/FlowSaldo.dump"
if pnpm data:admin restore "$work/FlowSaldo.dump"; then exit 1; fi
psql -XqAtw -v ON_ERROR_STOP=1 -c 'CREATE DATABASE flowsaldo_restore_smoke'
export PGDATABASE=flowsaldo_restore_smoke DATABASE_URL=postgresql://flowsaldo:flowsaldo_local@127.0.0.1:5432/flowsaldo_restore_smoke
cp "$work/FlowSaldo.dump" "$work/Tampered.dump"
cp "$work/FlowSaldo.dump.sha256" "$work/Tampered.dump.sha256"
printf 'changed' >> "$work/Tampered.dump"
if pnpm data:admin restore "$work/Tampered.dump"; then exit 1; fi
pnpm data:admin restore "$work/FlowSaldo.dump"
test "$(snapshot)" = "$before"
test "$(psql -XqAtw -c 'SELECT (SELECT count(*) FROM "AccessSession")+(SELECT count(*) FROM "RecoveryCode")+(SELECT count(*) FROM "AuthThrottle")+(SELECT count(*) FROM "CleanupPreview")')" = 0
if pnpm data:admin erase flowsaldo; then exit 1; fi
test "$(snapshot)" = "$before"
pnpm data:admin erase flowsaldo_restore_smoke
test "$(snapshot | cut -d'|' -f1-5)" = '0|0|0|0|0'
test "$(psql -XqAtw -c 'SELECT (SELECT count(*) FROM "Category" WHERE system),(SELECT count(*) FROM "FinanceLock")')" = '1|1'
printf '%s\n' 'PASS CORE DATA ADMIN: verified restore, checksum and target guards, exclusion of credentials, complete erase of isolated restored database'
