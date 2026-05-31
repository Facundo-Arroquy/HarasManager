# HarasManager — Briefing para Claude Code

## Qué es este proyecto

Sistema web multi-tenant para gestión equina (haras y establecimientos).
MVP en desarrollo activo, sin producción aún.

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

```bash
cd frontend
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

---

## Estructura de carpetas relevante

```
HarasManager/
├── CLAUDE.md               ← este archivo
├── TASKS.md                ← tickets pendientes
├── docs/SKILL.md           ← arquitectura completa (leer siempre)
└── frontend/src/
    ├── components/
    │   ├── domain/         ← componentes de negocio
    │   ├── layout/         ← AppLayout, Sidebar, BottomNav
    │   ├── centro-cria/    ← modales del módulo de embriones
    │   └── ui/             ← genéricos (Spinner, etc.)
    ├── pages/              ← una carpeta por sección
    ├── services/           ← todas las llamadas a Supabase
    ├── store/              ← Zustand (authStore, crianzaStore)
    ├── hooks/              ← useAuth
    ├── types/              ← tipos TypeScript
    ├── utils/              ← helpers
    └── dev/                ← mock system (SOLO desarrollo local)
```

---

## Reglas obligatorias

**Frontend**
- Esto es **Vite**, no Next.js — nunca usar `"use client"` ni `"use server"`
- Tailwind v4: usar `@import "tailwindcss"` en CSS
- Lógica de negocio solo en hooks o services, nunca en componentes
- `src/dev/` es solo para desarrollo local, nunca llega a producción

**Base de datos**
- Tablas: `snake_case` singular (`caballo`, no `caballos`)
- Catálogos: prefijo `cat_` (`cat_raza`, `cat_pelaje`)
- PKs: UUID con `gen_random_uuid()` (catálogos simples usan SERIAL)
- Siempre `TIMESTAMPTZ`, nunca `TIMESTAMP` sin zona
- Toda tabla con datos de negocio tiene `sociedad_id` (multi-tenant)

**Supabase**
- No crear usuarios desde el frontend — solo el admin invita usuarios
- El historial clínico es inmutable: solo el vet que lo creó puede editarlo
- No saltear RLS — toda consulta respeta el modelo de permisos

**Lo que NO hacer**
- No crear un backend Express (no está en el plan del MVP)
- No hardcodear `sociedad_id` ni `usuario_id`
- No agregar dependencias sin verificar que Supabase no lo resuelve ya

---

## Flujo de trabajo con Git

- `main` → rama de producción / demo (Vercel)
- Cada feature o fix va en su propia rama: `feat/nombre` o `fix/nombre`
- Antes de arrancar: `git pull origin main`
- Al terminar: PR a `main` con revisión del otro dev
- Ver `TASKS.md` para saber qué tiene asignado cada uno y no pisarse

---

## Migraciones de Supabase

⚠️ Las migraciones **no están en el repo** todavía. El esquema actual de la DB
está documentado en `docs/SKILL.md`. Antes de tocar cualquier tabla, consultar
ese archivo para entender la estructura real.
