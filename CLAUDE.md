# HarasManager — Briefing para Claude Code

## Qué es este proyecto

Sistema web multi-tenant para gestión equina (haras y establecimientos).
MVP en producción y desarrollo activo.

- **Repo:** https://github.com/Facundo-Arroquy/HarasManager
- **Devs:** Facundo Arroquy + colaborador
- **Stack:** React 19 + Vite + TypeScript + Tailwind v4 + Zustand + React Router v7
- **DB / Auth:** Supabase directo desde el frontend (sin backend)
- **Deploy:** Vercel conectado a `main`

---

## Antes de escribir cualquier código

1. Leer `docs/SKILL.md` — arquitectura completa, modelo de DB, RLS, roles y convenciones. No tomar ninguna decisión técnica sin consultarlo.
2. Leer `TASKS.md` — ver qué está pendiente y quién tiene asignado qué antes de tocar archivos.
3. No inventar tablas ni columnas — si algo no está en el SKILL, preguntar antes de crear.

---

## Cómo correr el proyecto

Se desarrolla contra la base **local** (Docker), nunca contra producción. Detalle en `docs/ENTORNO-LOCAL.md`.

```bash
supabase start               # desde la raíz del repo: levanta la base local
cd frontend
npm install
cp .env.example .env.local   # VITE_SUPABASE_URL=http://127.0.0.1:55321 y VITE_SUPABASE_ANON = la key de `supabase status`
npm run dev
```

Hasta la F2 del plan de migración la base local está vacía (sin usuarios ni datos).

---

## Estructura de carpetas relevante

```
HarasManager/
├── CLAUDE.md               ← este archivo
├── TASKS.md                ← tickets pendientes
├── docs/SKILL.md           ← arquitectura completa (leer siempre)
├── docs/PLAN-MIGRACION-BACKEND.md ← plan por fases de la API (F0 a F30)
├── docs/ENTORNO-LOCAL.md   ← base local con Docker
└── frontend/src/
    ├── components/
    │   ├── domain/         ← componentes de negocio
    │   ├── layout/         ← AppLayout, Sidebar, MobileDrawer
    │   ├── centro-cria/    ← modales del módulo de embriones
    │   └── ui/             ← genéricos (Spinner, etc.)
    ├── pages/              ← una carpeta por sección
    ├── services/           ← todas las llamadas a Supabase
    ├── store/              ← Zustand (authStore, crianzaStore)
    ├── hooks/              ← useAuth
    ├── types/              ← tipos TypeScript
    └── utils/              ← helpers
```

---

## Reglas obligatorias

**Frontend**
- Esto es **Vite**, no Next.js — nunca usar `"use client"` ni `"use server"`
- Tailwind v4: usar `@import "tailwindcss"` en CSS
- Lógica de negocio solo en hooks o services, nunca en componentes

**Base de datos**
- Tablas: `snake_case` singular (`caballo`, no `caballos`)
- Catálogos: prefijo `cat_` (`cat_raza`, `cat_pelaje`)
- PKs: UUID con `gen_random_uuid()` (catálogos simples usan SERIAL)
- Siempre `TIMESTAMPTZ`, nunca `TIMESTAMP` sin zona
- Toda tabla con datos de negocio tiene `sociedad_id` (multi-tenant)
- Cada vez que se agrega o modifica una tabla, columna, función o política RLS, **actualizar `docs/SKILL.md`** en el mismo PR

**Supabase**
- No crear usuarios desde el frontend — solo el admin invita usuarios
- El historial clínico es inmutable: solo el vet que lo creó puede editarlo
- No saltear RLS — toda consulta respeta el modelo de permisos

**Backend (en migración)**

Hoy el frontend todavía habla directo con Supabase. La migración a una API
FastAPI está decidida y se hace por fases cortas (máximo 2 días cada una):
`docs/PLAN-MIGRACION-BACKEND.md` dice qué se hace y en qué orden, y
`docs/BACKEND-API-TASKS.md` tiene el detalle técnico y el Registro de pendientes.

- **Si implementás algo que el día de mañana tendrá que existir en el backend,
  anotalo en la tabla "Registro de tasks pendientes de backend" al final de ese
  documento**, en el mismo PR. Una fila con fecha, de dónde salió, y qué habría
  que implementar. Esto evita tener que redescubrirlo el día que se arranque.
- Aplica sobre todo a: funciones plpgsql de negocio (son la especificación del
  endpoint equivalente), lógica de negocio que quede en stores o components del
  front, y cualquier cosa que debería ser un job programado pero hoy se dispara
  cuando el usuario abre la app.
- No hace falta anotar CRUD común ni cambios de UI.

**Lo que NO hacer**
- No guardar en este repositorio público datos de clientes, credenciales ni detalles sensibles de seguridad
- No crear un backend Express (no está en el plan del MVP)
- No saltear las fases de `docs/PLAN-MIGRACION-BACKEND.md`: el backend se construye en local contra la base de Docker, una fase por PR, y no se prende en producción hasta el cutover (F29)
- No hardcodear `sociedad_id` ni `usuario_id`
- No agregar dependencias sin verificar que Supabase no lo resuelve ya
- **No agregar sección de "Transferencias" en la página de Caballos** — fue eliminada intencionalmente. La transferencia de embriones se gestiona exclusivamente desde "Centro de Cría".

---

## Flujo de trabajo con Git

- `main` → producción (Vercel + Supabase prod). Solo recibe PRs desde `develop`
- `develop` → integración: el filtro previo a producción
- Cada feature o fix va en su propia rama que **parte de `develop`**: `feat/nombre` o `fix/nombre`
- Antes de arrancar: `git pull origin develop`
- Al terminar: PR a `develop` con revisión del otro dev
- Llevar a producción: PR `develop` → `main`. Al mergearlo se aplican las migraciones nuevas a la base de prod
- Todo hotfix que entre directo a `main` se mergea a `develop` el mismo día
- Ver `TASKS.md` para saber qué tiene asignado cada uno y no pisarse

---

## Migraciones de Supabase

Las migraciones están en `supabase/migrations/` con el formato `YYYYMMDDHHMMSS_descripcion.sql`.
El punto de partida es `20261025000000_baseline_prod.sql` (schema de prod al 2026-10-25); las
anteriores están en `supabase/migrations-archivo/` y no se ejecutan.

**Flujo:** `supabase migration new nombre` → escribir el SQL → `supabase db reset` en la base
local (Docker, ver `docs/ENTORNO-LOCAL.md`) → probar contra la app → PR a `develop`.
Una migración nunca se prueba por primera vez en producción.

**A producción** llegan al mergear `develop` → `main`. Hasta que exista el GitHub Action
(F27 del plan) se aplican a mano con el **MCP server de Supabase** (`apply_migration`), solo
desde `main` y con aprobación explícita. No usar `supabase db push` ni el SQL Editor manual
hasta entonces. Durante el desarrollo, el MCP contra prod es solo de lectura.

Antes de tocar cualquier tabla, consultar `docs/SKILL.md` para entender la estructura real.
Después de aplicar una migración, actualizar `docs/SKILL.md` en el mismo PR.
