#!/usr/bin/env bash
# Compara el schema de producción contra la base local (Docker).
#
#   public           -> diff completo del volcado de ambas bases
#   storage.objects  -> diff de las policies
#
# Solo LEE producción. Requiere el CLI de Supabase logueado y linkeado
# (`supabase login` + `supabase link`), Docker y el stack local arriba
# (`supabase start`). Tarda unos minutos: el volcado remoto es lento.
#
# Termina con código 1 si hay diferencias. Correrlo antes de abrir un PR
# `develop` -> `main` (ver docs/ENTORNO-LOCAL.md).
set -euo pipefail

cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

dump() { # $1 = --linked | --local, $2 = schema, $3 = archivo
  supabase db dump "$1" --schema "$2" -f "$3" > /dev/null
}

# Al re-parsear un CHECK, Postgres lo reescribe con otra forma y el mismo
# significado. Se compara el nombre de la constraint, no el texto de la expresión.
normalizar_public() {
  sed -E 's/(CONSTRAINT "[^"]+" CHECK ).*/\1<expresión omitida>/' "$1"
}

policies_storage() { # imprime solo los CREATE POLICY sobre storage.objects
  awk '/^CREATE POLICY .* ON "storage"."objects"/{p=1} p{print} p&&/;$/{p=0}' "$1"
}

echo "Volcando public (prod y local)..."
dump --linked public "$tmp/prod_public.sql"
dump --local  public "$tmp/local_public.sql"

echo "Volcando storage (prod y local)..."
dump --linked storage "$tmp/prod_storage.sql"
dump --local  storage "$tmp/local_storage.sql"

estado=0

if diff <(normalizar_public "$tmp/prod_public.sql") <(normalizar_public "$tmp/local_public.sql") > "$tmp/diff_public.txt"; then
  echo "OK    public: idéntico a producción"
else
  echo "DIFF  public (< prod, > local):"
  cat "$tmp/diff_public.txt"
  estado=1
fi

if diff <(policies_storage "$tmp/prod_storage.sql") <(policies_storage "$tmp/local_storage.sql") > "$tmp/diff_storage.txt"; then
  echo "OK    storage.objects: policies idénticas a producción"
else
  echo "DIFF  storage.objects (< prod, > local):"
  cat "$tmp/diff_storage.txt"
  estado=1
fi

exit "$estado"
