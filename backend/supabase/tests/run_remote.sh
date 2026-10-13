#!/usr/bin/env bash
# Corre migraciones, seed y pruebas contra un proyecto REAL de Supabase DESECHABLE (desarrollo).
# Las pruebas crean y borran usuarios y publican recetas: NUNCA contra staging ni producción.
# Uso: CONFIRM_DISPOSABLE=yes DATABASE_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres' tests/run_remote.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Define DATABASE_URL (Project Settings > Database > Connection string, modo directo)}"
[ "${CONFIRM_DISPOSABLE:-}" = "yes" ] || { echo "Define CONFIRM_DISPOSABLE=yes: esto escribe y borra datos."; exit 1; }
PSQL="psql -q -X -v ON_ERROR_STOP=1 $DATABASE_URL"
for f in migrations/*.sql; do echo "== $f"; $PSQL -f "$f"; done
[ -f seed.sql ] && { echo "== seed.sql"; $PSQL -f seed.sql; }
for f in tests/[1-9]*.sql; do echo "== $f"; $PSQL -f "$f"; done
echo "OK: todo pasó en el proyecto real"
