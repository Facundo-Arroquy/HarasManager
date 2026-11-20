# Migración a backend propio — dónde vive el plan

**Fecha:** 2026-10-27. **Estado:** repos armados, migración no iniciada.

Se decidió arrancar la migración de HarasManager a una arquitectura con **API FastAPI y
PostgreSQL propio**. El plan **no vive en este repo**: vive en dos repositorios nuevos, uno por
pieza, con su propio `CLAUDE.md`, agentes, tickets y entorno de desarrollo.

| Repo | Qué es | Plan |
|---|---|---|
| `harasmanager-api` | Backend FastAPI + Postgres (Railway), Alembic, uv, Docker, Terraform | `docs/PLAN-MIGRACION.md`: 11 fases, 48 tickets `API-*`, ADRs 001–008 |
| `harasmanager-web` | Este `frontend/` copiado y pasado a bun, con cliente API y feature flags por dominio | `docs/PLAN-MIGRACION.md`: 6 fases, 22 tickets `WEB-*` |

## Decisiones tomadas (detalle en los ADRs del repo api)

- **Supabase Auth se queda.** La API valida el JWT; no hay login nuevo.
- **Postgres propio en Railway**, pero **recién al final**: durante la convivencia la API apunta al
  Postgres de Supabase (misma base, sin dos fuentes de verdad) y el front migra dominio por dominio
  con flags. El movimiento de datos es una sola ventana con ensayo previo (ADR-007).
- **RLS se conserva** también en el Postgres propio, con un shim de `auth.uid()` (ADR-002).
- **Storage sigue en Supabase**; la API emite las signed URLs (ADR-006).
- **Terraform para Railway** (API) y Vercel (front).

## Qué cambia en este repo mientras tanto

- Sigue en producción y sigue recibiendo fixes hasta el cutover.
- Las migraciones de schema siguen aplicándose desde acá con el MCP de Supabase (ADR-004 del repo
  api). Cada función plpgsql nueva es la especificación del endpoint equivalente: seguir anotándola en
  `docs/BACKEND-API-TASKS.md` → "Registro de tasks pendientes de backend".
- `docs/BACKEND-API-TASKS.md` queda como antecedente; el plan vigente es el de los repos nuevos.
- Cuando termine la Fase 11 del repo api, este repo se archiva con un README que apunte a los dos nuevos.
