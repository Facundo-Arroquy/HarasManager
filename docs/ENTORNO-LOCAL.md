# Entorno local con Docker

Base de Supabase en tu máquina, separada de producción. Es donde se prueba todo
cambio de schema antes de llevarlo a `main`. Contexto: `docs/PLAN-MIGRACION-BACKEND.md`.

## Requisitos

- Docker Desktop corriendo, con **al menos 6 GB de RAM** (Settings → Resources). Con 4 GB
  alcanza para este stack solo; si tenés otro stack de Supabase arriba, no.
- [CLI de Supabase](https://supabase.com/docs/guides/cli) 2.x.
- Para comparar contra prod (opcional): `supabase login` y `supabase link --project-ref <ref>`.

## Uso diario

```bash
supabase start        # levanta la base y los servicios (la primera vez baja imágenes)
supabase status       # URLs y keys locales
supabase db reset     # borra la base local y reaplica las migraciones desde cero
supabase stop         # apaga todo (la data se conserva en volúmenes de Docker)
```

| Servicio | URL |
|---|---|
| API (lo que usa el front) | `http://127.0.0.1:55321` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` |
| Studio (explorar la base) | `http://127.0.0.1:55323` |
| Mail de prueba (Mailpit) | `http://127.0.0.1:55324` |

Los puertos son 553xx a propósito: el rango por defecto (543xx) lo suele usar otro
proyecto de Supabase en la misma máquina. Las keys locales son las de desarrollo que
imprime `supabase status`; **no sirven contra producción** ni hay que guardarlas en el repo.

## Cómo se arma el schema

`supabase/migrations/20261025000000_baseline_prod.sql` es el schema de producción al
2026-10-25. Las 137 migraciones anteriores quedaron en `supabase/migrations-archivo/`
(no se ejecutan; ver el README de esa carpeta). Todo cambio nuevo es **una migración
nueva en `supabase/migrations/`**:

```bash
supabase migration new nombre_del_cambio   # crea el archivo vacío con timestamp
# editar el SQL
supabase db reset                          # probar desde cero
```

Realtime y Analytics están apagados en `supabase/config.toml` (la app no los usa y
ahorran ~900 MB de RAM). El seed está apagado hasta la F2: el `seed.sql` actual usa un
modelo que nunca se aplicó en prod.

## Comparar con producción

```bash
./scripts/db-compare.sh
```

Compara `public` y las policies de `storage.objects` entre prod y local. Solo lee prod.
Correrlo antes de abrir un PR `develop` → `main`. Sale con código 1 si hay diferencias.

## Problemas conocidos

- **`supabase start` o `docker pull` se cuelgan bajando imágenes.** El helper de
  credenciales de Docker Desktop (`credsStore: desktop`) se traba con `public.ecr.aws`.
  Se saltea con una config vacía:

  ```bash
  mkdir -p ~/.docker-sin-creds && echo '{}' > ~/.docker-sin-creds/config.json
  DOCKER_CONFIG=~/.docker-sin-creds supabase start
  ```

  Una vez que las imágenes están en la máquina, ya no hace falta.
- **Puerto ocupado.** Cambiar los `port` de `supabase/config.toml` (y el `project_id`
  si otro stack usa el mismo nombre).
- **`supabase db dump --linked` tarda ~1 min por schema.** Es la latencia hasta
  `us-west-1`, no un cuelgue.

## Antes del primer deploy automático (F27)

El historial de migraciones de **producción** (`supabase_migrations.schema_migrations`)
tiene 115 versiones con los timestamps que puso el MCP; el repo ahora tiene una sola
(la baseline). Para que `supabase db push` funcione hay que, **una vez y con aprobación
explícita**, marcar esas 115 como revertidas y la baseline como aplicada
(`supabase migration repair`). Es una escritura sobre metadatos de prod, por eso no se
hace en la F1.
