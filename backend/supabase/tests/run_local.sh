#!/usr/bin/env bash
# Reconstruye la base de Supabase LOCAL (Docker) y corre las pruebas SQL.
# Funciona en Windows (Git Bash), Mac, Linux y CI. Requiere `npx supabase start` antes.
# Uso: backend/supabase/tests/run_local.sh [--no-reset]
set -euo pipefail
cd "$(dirname "$0")/../.."    # backend/
if [ "${1:-}" != "--no-reset" ]; then
  npx supabase db reset >/dev/null 2>&1 || { echo "Falló supabase db reset"; npx supabase db reset; exit 1; }
fi
DB=$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -1)
[ -n "$DB" ] || { echo "Supabase local no está corriendo: npx supabase start"; exit 1; }
total=0
for f in supabase/tests/[1-9]*.sql; do
  out=$(docker exec -i "$DB" psql -q -X -v ON_ERROR_STOP=1 -U postgres -d postgres < "$f" 2>&1) || {
    echo "$out" | grep -v "^NOTICE:  ok - " ; echo "FALLÓ: $f"; exit 1; }
  n=$(echo "$out" | grep -c "ok - " || true)
  total=$((total + n))
  echo "ok  $f ($n)"
done
echo "OK: $total verificaciones"
