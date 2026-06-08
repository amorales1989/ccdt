#!/usr/bin/env bash
# Actualiza la DB local con los datos actuales de produccion.
# - Lee (solo SELECT) de la DB cloud linkeada.
# - Recrea el esquema local desde supabase/migrations.
# - Carga los datos reales en la local (127.0.0.1:54322).
# NO modifica produccion en ningun momento.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEED="$ROOT/supabase/seed_data.sql"
LOCAL_DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

echo "==> Verificando que la DB local este corriendo..."
supabase status >/dev/null 2>&1 || { echo "ERROR: supabase local no esta corriendo. Corre 'supabase start'."; exit 1; }

echo "==> Dump de datos de PRODUCCION (solo lectura)..."
supabase db dump --data-only -f "$SEED"

echo "==> Reset de la DB LOCAL (recrea esquema desde migrations)..."
supabase db reset

echo "==> Cargando datos reales en la DB local..."
psql "$LOCAL_DB" -f "$SEED"

echo "==> Listo. DB local actualizada con datos de produccion."
