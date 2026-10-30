#!/usr/bin/env bash
# Regenera el contrato OpenAPI del backend y el cliente TypeScript del front.
#
#   ./scripts/generar-cliente-api.sh           escribe backend/openapi.json y frontend/src/api/schema.d.ts
#   ./scripts/generar-cliente-api.sh --check   no escribe nada: sale con código 1 si alguno está desactualizado
#
# Correrlo cada vez que se cambia un endpoint o un schema del backend, y commitear el resultado.
# Requiere `uv` (backend) y `npx` (front). No necesita la base ni el backend levantados.
#
# El generador se corre con `npx` y no es dependencia del front: `openapi-typescript` declara
# `typescript@^5` como peer y el proyecto usa TypeScript 6, así que npm se niega a instalarlo
# junto. La versión está fijada acá para que la salida sea siempre la misma.
set -euo pipefail

OPENAPI_TYPESCRIPT_VERSION="7.13.0"

cd "$(dirname "$0")/.."
raiz="$(pwd)"

modo="generar"
case "${1:-}" in
  "") ;;
  --check) modo="verificar" ;;
  *) echo "Uso: $0 [--check]" >&2; exit 2 ;;
esac

if [ "$modo" = "generar" ]; then
  contrato="$raiz/backend/openapi.json"
  tipos="$raiz/frontend/src/api/schema.d.ts"
else
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  contrato="$tmp/openapi.json"
  tipos="$tmp/schema.d.ts"
fi

(cd backend && uv run python -m scripts.exportar_openapi "$contrato" > /dev/null)
(cd frontend && npx --yes "openapi-typescript@$OPENAPI_TYPESCRIPT_VERSION" "$contrato" -o "$tipos" > /dev/null)

if [ "$modo" = "generar" ]; then
  echo "Contrato: backend/openapi.json"
  echo "Tipos:    frontend/src/api/schema.d.ts"
  exit 0
fi

estado=0
if ! diff -q "$contrato" backend/openapi.json > /dev/null; then
  echo "DESACTUALIZADO  backend/openapi.json" >&2
  estado=1
fi
if ! diff -q "$tipos" frontend/src/api/schema.d.ts > /dev/null; then
  echo "DESACTUALIZADO  frontend/src/api/schema.d.ts" >&2
  estado=1
fi
if [ "$estado" -eq 0 ]; then
  echo "OK: el contrato y el cliente están al día."
else
  echo "Correr ./scripts/generar-cliente-api.sh y commitear el resultado." >&2
fi
exit "$estado"
