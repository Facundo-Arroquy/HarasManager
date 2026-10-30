#!/usr/bin/env bash
# Verifica que el seed local quedó bien: los 12 usuarios demo pueden iniciar
# sesión y cada uno ve la cantidad de caballos que le corresponde por RLS.
# Sirve también como prueba de humo del aislamiento entre haras.
#
# Requiere el stack local arriba (`supabase start`) y el seed cargado
# (`supabase db reset`). No toca producción. Sale con código 1 si algo no coincide.
set -euo pipefail

cd "$(dirname "$0")/.."

API="${API_URL:-http://127.0.0.1:55321}"
KEY="${ANON_KEY:-$(supabase status -o env 2>/dev/null | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')}"
PASSWORD="Local-dev-2026"

if [ -z "$KEY" ]; then
  echo "No pude obtener la anon key. ¿Está levantado el stack (supabase start)?" >&2
  exit 1
fi

fallos=0

token() { # $1 = email
  curl -s -m 15 -X POST "$API/auth/v1/token?grant_type=password" \
    -H "apikey: $KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASSWORD\"}" \
    | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}

contar() { # $1 = token, $2 = tabla
  curl -s -m 15 -D - -o /dev/null "$API/rest/v1/$2?select=*" \
    -H "apikey: $KEY" -H "Authorization: Bearer $1" \
    -H "Prefer: count=exact" -H "Range: 0-0" \
    | tr -d '\r' | awk -F'/' 'tolower($1) ~ /content-range/ {print $2}'
}

# email | caballos que debe ver | sociedades que debe ver
while IFS='|' read -r email caballos sociedades; do
  tk="$(token "$email")"
  if [ -z "$tk" ]; then
    echo "FALLA  $email: no pudo iniciar sesión"
    fallos=$((fallos + 1))
    continue
  fi
  c="$(contar "$tk" caballo)"
  s="$(contar "$tk" sociedad)"
  if [ "$c" = "$caballos" ] && [ "$s" = "$sociedades" ]; then
    printf "OK     %-36s caballos=%-3s sociedades=%s\n" "$email" "$c" "$s"
  else
    printf "FALLA  %-36s caballos=%s (esperado %s) sociedades=%s (esperado %s)\n" "$email" "$c" "$caballos" "$s" "$sociedades"
    fallos=$((fallos + 1))
  fi
done <<'EOF'
superadmin.demo@haras.com|34|2
admin.demo1@haras.com|12|1
admin.demo2@haras.com|13|1
vet.demo1@haras.com|18|1
vet.demo2@haras.com|13|1
vet.independiente.demo@haras.com|20|0
jugador.demo1@haras.com|12|1
jugador.demo2@haras.com|13|1
peticero.demo1@haras.com|12|1
peticero.demo2@haras.com|13|1
piloto.demo1@haras.com|12|1
piloto.demo2@haras.com|13|1
EOF

if [ "$fallos" -eq 0 ]; then
  echo "Seed OK: 12 usuarios con la visibilidad esperada."
else
  echo "$fallos usuario(s) con problemas." >&2
  exit 1
fi
