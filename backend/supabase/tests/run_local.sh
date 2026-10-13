#!/usr/bin/env bash
# Pruebas de la base en Supabase LOCAL (Docker). Funciona en Windows (Git Bash), Mac, Linux y CI.
# Requiere `npx supabase start` antes.
#   Fase 1 · reglas: base desde cero + tests/fixtures.sql (datos de prueba) + tests/[1-9]*.sql
#   Fase 2 · catálogo real: base desde cero + catalog/*.sql (el seed de verdad) + tests/catalog/*.sql
# Al terminar, la base local queda con el catálogo real, lista para desarrollar la app.
set -euo pipefail
cd "$(dirname "$0")/../.."    # backend/

DB=$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -1)
[ -n "$DB" ] || { echo "Supabase local no está corriendo: npx supabase start"; exit 1; }

total=0
run_sql() {   # run_sql <archivo>: ejecuta y cuenta las verificaciones "ok - "
  local out n
  out=$(docker exec -i "$DB" psql -q -X -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1" 2>&1) || {
    echo "$out" | grep -v "^NOTICE:  ok - "; echo "FALLÓ: $1"; exit 1; }
  n=$(echo "$out" | grep -c "ok - " || true)
  total=$((total + n))
  echo "ok  $1 ($n)"
}

reset() {     # reset [args de supabase db reset]
  npx supabase db reset "$@" >/dev/null 2>&1 || { echo "Falló supabase db reset $*"; npx supabase db reset "$@"; exit 1; }
}

echo "== Fase 1: reglas de negocio (datos de prueba)"
reset --sql-paths ./tests/fixtures.sql
run_sql supabase/tests/helpers.sql
for f in supabase/tests/[1-9]*.sql; do run_sql "$f"; done

echo "== Fase 2: catálogo real"
reset
run_sql supabase/tests/helpers.sql
for f in supabase/tests/catalog/*.sql; do run_sql "$f"; done

echo "OK: $total verificaciones"
