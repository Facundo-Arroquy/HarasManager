---
name: equine-management
description: >
  Arquitectura maestra del sistema de gestión equina multi-tenant. Usar este skill
  en CUALQUIER tarea relacionada con este proyecto: diseño de tablas, endpoints,
  componentes React, lógica de permisos, migraciones, o cualquier decisión técnica.
  Si el usuario menciona caballos, historial clínico, sociedades, veterinarios,
  marcas, acceso_veterinario, Supabase multi-tenant, o cualquier módulo de esta app,
  consultar este skill primero sin excepción, si sigue habiendo dudas consultarme.
---

# Equine Management System — Skill Maestro de Arquitectura

## Visión General

Sistema web multi-tenant para gestión equina. Permite a múltiples sociedades
(haciendas, establecimientos) administrar sus animales, historial clínico,
marcas propietarias y usuarios con control total de permisos.

**Escala inicial:** ~10 sociedades, 70–150 caballos c/u, ~15.000 registros clínicos.
**Expansión futura:** más sociedades, más países, adjuntos multimedia (MongoDB Atlas).

---

## Stack Tecnológico — INAMOVIBLE

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Base de datos | PostgreSQL vía Supabase | Relacional, 3FN, multi-tenant con RLS |
| Auth | Supabase Auth | Sin registro público; usuarios creados solo por admin |
| Backend | Node.js + Express (o Supabase Edge Functions para lógica simple) | Liviano, bien integrado con Supabase |
| Frontend | React + Vite | Web responsiva, táctil-friendly, PWA a futuro |
| Deployment | Supabase + Vercel | Simplicidad, escalabilidad |
| Media (futuro) | MongoDB Atlas | Fotos, esquemas interactivos, adjuntos |

**No cambiar el stack sin documentar la razón y actualizar este skill.**

---

## Principios de Arquitectura — OBLIGATORIOS

1. **3FN estricta** — Cada tabla tiene una sola responsabilidad. Sin dependencias
   transitivas. Sin datos repetidos. Toda repetición se reemplaza por FK.

2. **Multi-tenant con Row Level Security (RLS)** — Cada fila en tablas sensibles
   tiene `sociedad_id`. Las políticas RLS de Supabase aíslan los datos por sociedad.
   Un usuario nunca ve datos de otra sociedad salvo que tenga membresía activa.

3. **Catálogos normalizados** — Nunca texto libre donde se pueda evitar. Partes
   del cuerpo, tipos de consulta, razas, pelajes, etc. viven en tablas de catálogo.
   Esto garantiza consistencia en búsquedas y reportes.

4. **Inmutabilidad del historial clínico** — Un registro clínico solo puede ser
   editado por el veterinario que lo creó. Nadie más puede modificarlo ni eliminarlo.
   Se registra `creado_por` en cada registro.

5. **Registro de usuarios solo por administrador** — No hay signup público.
   El admin de cada sociedad crea los usuarios y asigna roles.

6. **Auditoría básica** — Toda tabla principal tiene `created_at` y `updated_at`.
   Tablas críticas (historial, transferencias) tienen además `creado_por`/`registrado_por`.

7. **Separación de responsabilidades** — Frontend no tiene lógica de negocio.
   Toda validación y regla de negocio vive en el backend o en funciones de Supabase.

8. **Propiedad por dominio de email** — Los propietarios no son personas físicas
   registradas manualmente. La marca propietaria se identifica por el dominio del email
   del usuario (e.g. `@losalamos.com` → Estancia Los Álamos). Esto elimina duplicación
   de datos y simplifica el control de acceso.

---

## Modelo de Base de Datos (3FN)

### Catálogos (tablas de referencia, sin `sociedad_id`)

```sql
CREATE TABLE cat_tipo_consulta (id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE cat_parte_cuerpo  (id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE cat_raza          (id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE cat_pelaje        (id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE cat_rol           (id SERIAL PRIMARY KEY, nombre VARCHAR(50)  NOT NULL UNIQUE);
-- Roles: 'admin', 'veterinario', 'piloto', 'jugador', 'peticero'
```

### Entidades principales

```sql
-- Sociedades (tenants)
CREATE TABLE sociedad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,
  cuit VARCHAR(20), direccion TEXT,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios (espejo de Supabase Auth)
-- rol es NULL para usuarios normales (su rol viene de membresia.cat_rol).
-- 'superadmin' y 'veterinario' son roles globales sin sociedad fija, se almacenan aquí.
CREATE TABLE usuario (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL, apellido VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE, telefono VARCHAR(30),
  rol VARCHAR(20),  -- NULL | 'superadmin' | 'veterinario'
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membresía: relación usuario <-> sociedad con rol
CREATE TABLE membresia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  rol_id INTEGER NOT NULL REFERENCES cat_rol(id),
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, sociedad_id, rol_id)
);

-- ─── MARCAS (reemplaza propietario/propiedad) ──────────────────────────────
-- Una marca = una empresa/familia propietaria identificada por dominio de email.
-- Todos los usuarios cuyo email termina en @dominio_email pertenecen a esta marca.
CREATE TABLE marca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  nombre VARCHAR(200) NOT NULL,
  dominio_email VARCHAR(100) NOT NULL,  -- e.g. 'losalamos.com'
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sociedad_id, dominio_email)
);

-- Caballos
CREATE TABLE caballo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  fecha_nacimiento DATE,
  categoria VARCHAR(20) CHECK (categoria IN ('Yegua','Padrillo','Caballo','Potrillo')),
  raza_id INTEGER REFERENCES cat_raza(id),
  pelaje_id INTEGER REFERENCES cat_pelaje(id),
  numero_chip VARCHAR(50), numero_registro VARCHAR(50),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  marca_id UUID REFERENCES marca(id),  -- propietario actual (NULL = sin asignar)
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acceso explícito de un vet a una marca (masivo) o caballo (individual)
-- XOR: o tiene marca_id O tiene caballo_id, nunca ambos ni ninguno
CREATE TABLE acceso_veterinario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES usuario(id),
  marca_id UUID REFERENCES marca(id),    -- NULL si es acceso individual
  caballo_id UUID REFERENCES caballo(id), -- NULL si es acceso masivo
  activo BOOLEAN DEFAULT TRUE,
  otorgado_por UUID NOT NULL REFERENCES usuario(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_xor CHECK (
    (marca_id IS NOT NULL AND caballo_id IS NULL)
    OR
    (marca_id IS NULL AND caballo_id IS NOT NULL)
  )
  -- Dos partial UNIQUE indexes garantizan unicidad (no UNIQUE NULLS NOT DISTINCT):
  -- UNIQUE(vet_id, marca_id)   WHERE marca_id   IS NOT NULL
  -- UNIQUE(vet_id, caballo_id) WHERE caballo_id IS NOT NULL
);

-- Historial de propiedad (transferencias de marca)
-- Inmutable: solo INSERT, nunca UPDATE/DELETE
CREATE TABLE historial_propiedad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  marca_anterior_id UUID REFERENCES marca(id),  -- NULL = primera asignación
  marca_nueva_id UUID NOT NULL REFERENCES marca(id),
  fecha_transferencia DATE NOT NULL,
  registrado_por UUID NOT NULL REFERENCES usuario(id),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Historial Clínico

```sql
CREATE TABLE historial_clinico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  tipo_consulta_id INTEGER NOT NULL REFERENCES cat_tipo_consulta(id),
  fecha_consulta TIMESTAMPTZ NOT NULL,
  diagnostico TEXT, tratamiento TEXT, observaciones TEXT,
  proxima_consulta DATE,
  creado_por UUID NOT NULL REFERENCES usuario(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  -- REGLA RLS: solo creado_por puede hacer UPDATE
);

CREATE TABLE historial_parte_afectada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historial_id UUID NOT NULL REFERENCES historial_clinico(id) ON DELETE CASCADE,
  parte_cuerpo_id INTEGER NOT NULL REFERENCES cat_parte_cuerpo(id),
  lado VARCHAR(20) CHECK (lado IN ('izquierdo','derecho','bilateral','no aplica')),
  descripcion TEXT
);

CREATE TABLE historial_medicamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historial_id UUID NOT NULL REFERENCES historial_clinico(id) ON DELETE CASCADE,
  medicamento VARCHAR(200) NOT NULL,
  dosis VARCHAR(100), via_administracion VARCHAR(100),
  duracion_dias INTEGER CHECK (duracion_dias > 0)
);
```

### Centro de Embriones (crianza)

```sql
CREATE TABLE cria_registro_clinico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  fecha DATE NOT NULL,
  veterinario_id UUID NOT NULL REFERENCES usuario(id),
  ovario_izq TEXT[] NOT NULL DEFAULT '{}',
  ovario_der TEXT[] NOT NULL DEFAULT '{}',
  utero TEXT[] NOT NULL DEFAULT '{}',
  obs_chips TEXT[] NOT NULL DEFAULT '{}',
  padrillo_id UUID REFERENCES caballo(id),
  ov_dias INTEGER,
  review_manana BOOLEAN DEFAULT FALSE,
  review_manana_desc TEXT,
  motivo TEXT, diagnostico TEXT, tratamiento TEXT, observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cria_recordatorio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  tipo VARCHAR(50) NOT NULL,  -- 'IN' | 'OXI' | 'Flushing' | 'Revisión Flushing' | 'Revisión PG' | 'Dar PG' | 'Revisión Strelin' | 'Revisión'
  fecha_vto DATE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'vencido' | 'hecho' | 'cancelado'
  veterinario_id UUID REFERENCES usuario(id),
  notas TEXT,
  auto_generado BOOLEAN DEFAULT TRUE,
  origen_registro_id UUID REFERENCES cria_registro_clinico(id),
  cancel_motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cria_flushing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),  -- donante
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  fecha DATE NOT NULL,
  veterinario_id UUID REFERENCES usuario(id),
  es_negativo BOOLEAN DEFAULT FALSE,
  cantidad INTEGER,
  estadio VARCHAR(50),   -- 'Mórula' | 'Blastocisto temprano' | 'Blastocisto' | 'Blastocisto expandido'
  grado INTEGER,
  tamanio VARCHAR(50),
  zona_pelucida VARCHAR(50),
  padrillo_id UUID REFERENCES caballo(id),
  origen_recordatorio_id UUID REFERENCES cria_recordatorio(id),
  pg_given BOOLEAN DEFAULT FALSE,
  cancelado BOOLEAN DEFAULT FALSE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cria_transferencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  fecha DATE NOT NULL,
  veterinario_id UUID REFERENCES usuario(id),
  registro_id UUID REFERENCES cria_registro_clinico(id),
  caballo_receptora_id UUID NOT NULL REFERENCES caballo(id),
  caballo_donante_id UUID REFERENCES caballo(id),
  padrillo_id UUID REFERENCES caballo(id),
  flushing_id UUID REFERENCES cria_flushing(id),
  cl_calidad VARCHAR(50),
  tono_uterino VARCHAR(50),
  tono_cervical VARCHAR(50),
  clasificacion VARCHAR(50),  -- 'Fresco' | 'Congelado'
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

El campo `rol_reproductivo` ('Donante' | 'Receptora' | null) vive en la tabla `caballo`.

---

## Lógica de Acceso (RLS)

### Funciones auxiliares (SECURITY DEFINER)

| Función | Descripción |
|---------|-------------|
| `tiene_membresia(sociedad_id)` | El usuario autenticado tiene membresía activa en esa sociedad |
| `es_admin(sociedad_id)` | Tiene rol 'admin' en esa sociedad (haras o marca) |
| `es_veterinario(sociedad_id)` | Tiene rol 'veterinario' en esa sociedad |
| `email_dominio()` | `split_part(auth.jwt() ->> 'email', '@', 2)` |
| `get_marca_usuario(sociedad_id)` | Retorna el `id` de la marca cuyo `dominio_email` coincide con el email del usuario |
| `es_admin_haras(sociedad_id)` | Admin con rol 'admin' y SIN marca asociada a su dominio → ve todo el haras |
| `es_admin_marca(marca_id)` | Admin cuyo dominio de email = dominio de esa marca |
| `vet_tiene_acceso(caballo_id)` | El vet tiene acceso masivo (por marca) o individual (por caballo) vía `acceso_veterinario` |

### Quién ve qué

| Rol | Caballos visibles | Historial clínico |
|-----|-------------------|-------------------|
| **Admin haras** (`marcaId=null`) | Todos los caballos de la sociedad | Todos |
| **Admin marca** (`@dominio.com`) | Solo los de su marca | Solo los de sus caballos |
| **Jugador / Peticero** | Solo los de su marca | Solo los de sus caballos |
| **Veterinario** | Solo los con acceso explícito concedido | Solo los de caballos con acceso |

### Política por tabla

- **`marca`**: SELECT = propietario de esa marca OR admin haras. INSERT/UPDATE = admin haras (o admin marca para UPDATE).
- **`caballo`**: SELECT = propietario (mismo dominio) OR vet con acceso OR admin haras. INSERT = solo admin haras. UPDATE = admin haras O admin de la marca del caballo.
- **`historial_clinico`**: SELECT hereda acceso al caballo. INSERT/UPDATE = solo `creado_por` (veterinario).
- **`acceso_veterinario`**: SELECT = vet (sus propios accesos) O admin marca (los que otorgó) O admin haras. INSERT/UPDATE = admin de la marca afectada.
- **`historial_propiedad`**: SELECT = propietario O admin haras. INSERT = solo admin haras. Sin UPDATE/DELETE (inmutable).

---

## Estructura de Carpetas del Proyecto

```
HarasManager/
├── docs/
│   └── SKILL.md                        # Este archivo
├── frontend/                           # React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                     # Spinner, etc.
│   │   │   ├── layout/                 # AppLayout, Sidebar
│   │   │   └── domain/                 # CaballoCard, HistorialCard, NuevaConsultaModal
│   │   ├── pages/
│   │   │   ├── auth/                   # LoginPage (pendiente)
│   │   │   ├── caballos/               # CaballosPage
│   │   │   ├── historial/              # HistorialPage
│   │   │   └── admin/                  # AdminPage (pendiente)
│   │   ├── dev/                        # Solo en DEV — mock system
│   │   │   ├── mockMode.ts             # localStorage toggle
│   │   │   ├── mockUsers.ts            # 5 usuarios de demo con marcaId
│   │   │   ├── mockData.ts             # MOCK_CABALLOS, MOCK_HISTORIAL, MOCK_MARCAS
│   │   │   └── DevPanel.tsx            # Floating panel para cambiar usuario
│   │   ├── hooks/
│   │   │   └── useAuth.ts              # mock-aware, signIn/signOut
│   │   ├── services/
│   │   │   ├── caballoService.ts
│   │   │   ├── historialService.ts
│   │   │   └── catalogoService.ts
│   │   ├── store/
│   │   │   └── authStore.ts            # Zustand: user, session, sociedadActiva, rol, loading
│   │   └── utils/
│   │       └── fecha.ts
│   └── .env.example
└── supabase/
    └── migrations/
        ├── 20260509000001_catalogs.sql
        ├── 20260509000002_core_entities.sql
        ├── 20260509000003_horses_and_owners.sql   # obsoleto, ver nota abajo
        ├── 20260509000004_clinical_history.sql
        ├── 20260509000005_rls_policies.sql
        ├── 20260510000001_marca_model.sql          # DROP propietario/propiedad, ADD marca
        └── 20260510000002_rls_marca_model.sql      # RLS actualizado para modelo de marcas
```

> **Nota:** `20260509000003` creó `propietario` y `propiedad`. Fueron eliminadas por
> `20260510000001_marca_model.sql`. La tabla `propiedad` fue reemplazada por
> `historial_propiedad` y `propietario` por `marca`.

---

## Convenciones de Código

### Base de datos
- Nombres de tablas: `snake_case` en singular (`caballo`, no `caballos`)
- Catálogos: prefijo `cat_` (`cat_raza`, `cat_pelaje`)
- PKs: siempre `UUID` con `gen_random_uuid()` excepto catálogos simples (SERIAL)
- FKs: `tabla_id` (`caballo_id`, `sociedad_id`, `marca_id`)
- Fechas: siempre `TIMESTAMPTZ`, nunca `TIMESTAMP` sin zona

### Frontend (Vite — NO es Next.js)
- **No usar `"use client"` ni `"use server"`** — directivas de Next.js, no aplican aquí
- Tailwind v4: `@import "tailwindcss"` en CSS, plugin `@tailwindcss/vite` en vite.config.ts
- Componentes: `PascalCase` (`CaballoCard.tsx`)
- Hooks: `camelCase` con prefijo `use` (`useAuth.ts`)
- Servicios: `camelCase` con sufijo `Service` (`caballoService.ts`)
- No lógica de negocio en componentes; solo en hooks o services
- Mock mode en `src/dev/` — solo se renderiza si `import.meta.env.DEV`

---

## Roles y Permisos (matriz definitiva)

| Acción | admin haras | admin marca | veterinario | jugador/piloto | peticero |
|--------|-------------|-------------|-------------|----------------|----------|
| Ver todos los caballos del haras | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver caballos de su marca | ✅ | ✅ | Con acceso | ✅ | ✅ |
| Crear registro clínico | ❌ | ❌ | ✅ | ❌ | ❌ |
| Editar su propio registro clínico | ❌ | ❌ | ✅ | ❌ | ❌ |
| Registrar transferencia de marca | ✅ | ❌ | ❌ | ❌ | ❌ |
| Otorgar acceso a vet (masivo/individual) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Crear/gestionar marcas | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear usuarios en la sociedad | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Mock System (desarrollo)

Los 5 usuarios de demo cubren todos los roles y escenarios de acceso:

| ID mock | Usuario | Email | Rol | Ve |
|---------|---------|-------|-----|----|
| `mock-admin-haras` | Carlos Mendoza | admin@haras-demo.com | admin | Todo el haras |
| `mock-veterinario` | Dra. Valentina Ríos | vet@haras-demo.com | veterinario | Caballos con acceso concedido |
| `mock-admin-marca` | Rodrigo Benavídez | admin@losalamos.com | admin | Solo Estancia Los Álamos |
| `mock-jugador` | Martín Urquiza | martin@losalamos.com | jugador | Solo Estancia Los Álamos |
| `mock-peticero` | Diego Suárez | diego@pcba.com.ar | peticero | Solo Polo Club BA |

Marcas demo:
- `mock-marca-001`: Estancia Los Álamos (`losalamos.com`) — caballos cab-001..cab-006
- `mock-marca-002`: Polo Club Buenos Aires (`pcba.com.ar`) — caballos cab-007..cab-008

---

## Funcionalidades Futuras (no implementar aún)

- Silueta interactiva del caballo para marcar lesiones (frontend SVG + MongoDB)
- Adjuntos multimedia por registro clínico (MongoDB Atlas)
- App móvil / PWA
- Expansión multi-país
