#!/usr/bin/env bash
# Regenera el esquema de la DB LOCAL a partir del de PRODUCCION.
# - Lee (solo el esquema, sin datos) de la DB cloud linkeada. NO modifica produccion.
# - Deja UNA migracion base en supabase/migrations y archiva las anteriores.
# - Resetea la DB local: se pierden los datos locales (el fixture de tests crea los suyos).
#
# OJO: despues de esto, `supabase db push` intentaria aplicar la baseline sobre prod.
# Este repo no usa push (los cambios se aplican a mano); no empezar a usarlo sin
# marcar antes la baseline como ya aplicada (`supabase migration repair`).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG="$ROOT/supabase/migrations"
HIST="$ROOT/supabase/migrations_historico"
TMP="$ROOT/.baseline.tmp.sql"
BASE="$MIG/$(date -u +%Y%m%d%H%M%S)_baseline.sql"

echo "==> Dump del ESQUEMA de produccion (solo lectura)..."
supabase db dump --linked --schema public,api -f "$TMP"
test -s "$TMP" || { echo "ERROR: el dump salio vacio."; rm -f "$TMP"; exit 1; }

echo "==> Archivando las migraciones anteriores en supabase/migrations_historico/..."
mkdir -p "$HIST"
shopt -s nullglob
for f in "$MIG"/*.sql; do mv "$f" "$HIST/"; done

mv "$TMP" "$BASE"
echo "==> Baseline: $(basename "$BASE") ($(wc -l < "$BASE") lineas)"

echo "==> Reset de la DB LOCAL (borra los datos locales)..."
supabase db reset

echo "==> Listo. Verificar con: cd ../ccdt-Back && npm test"
