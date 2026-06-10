---
name: equine-management
description: >
  Arquitectura maestra del sistema de gestión equina multi-tenant. Usar este skill
  en CUALQUIER tarea relacionada con este proyecto: diseño de tablas, endpoints,
  componentes React, lógica de permisos, migraciones, o cualquier decisión técnica.
  Si el usuario menciona caballos, historial clínico, sociedades, veterinarios,
  acceso_vet, Supabase multi-tenant, o cualquier módulo de esta app,
  consultar este skill primero sin excepción, si sigue habiendo dudas consultarme.
---

# Equine Management System — Skill Maestro de Arquitectura

## Visión General

Sistema web multi-tenant para gestión equina. Permite a múltiples sociedades
(haciendas, establecimientos) administrar sus animales, historial clínico,
propietarios y usuarios con control total de permisos.

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
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  acceso_centro_cria BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios (espejo de Supabase Auth)
-- rol es NULL para usuarios normales (su rol viene de membresia.cat_rol).
-- 'superadmin' y 'veterinario' son roles globales sin sociedad fija, se almacenan aquí.
CREATE TABLE usuario (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL, apellido VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE, telefono VARCHAR(30),
  rol TEXT DEFAULT 'admin',  -- NULL | 'superadmin' | 'veterinario' | 'admin'
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  acceso_centro_cria BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membresía: relación usuario <-> sociedad con rol
CREATE TABLE membresia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  rol_id INTEGER NOT NULL REFERENCES cat_rol(id),
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  acceso_centro_cria BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, sociedad_id, rol_id)
);

-- Campos físicos (potreros/lotes dentro de la sociedad)
CREATE TABLE campo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Propietarios (personas/empresas dueñas de caballos)
CREATE TABLE propietario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,
  documento VARCHAR(50),
  telefono VARCHAR(30),
  email VARCHAR(255),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Propiedad: relación vigente y futura entre caballo y propietario
CREATE TABLE propiedad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  propietario_id UUID NOT NULL REFERENCES propietario(id),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  registrado_por UUID NOT NULL REFERENCES usuario(id),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caballos
CREATE TABLE caballo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  fecha_nacimiento DATE,
  categoria VARCHAR(20) CHECK (categoria IN ('Yegua','Padrillo','Caballo','Potrillo')),
  subcategoria TEXT,
  raza_id INTEGER REFERENCES cat_raza(id),
  pelaje_id INTEGER REFERENCES cat_pelaje(id),
  numero_chip VARCHAR(50), numero_registro VARCHAR(50),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  campo_id UUID REFERENCES campo(id),
  padre_id UUID REFERENCES caballo(id),
  madre_id UUID REFERENCES caballo(id),
  padre_nombre TEXT,
  madre_nombre TEXT,
  vet_owner_id UUID REFERENCES usuario(id),
  rol_reproductivo TEXT CHECK (rol_reproductivo IN ('Donante','Receptora')),
  prenada BOOLEAN DEFAULT FALSE,
  fecha_prenez DATE,
  en_venta_pendiente BOOLEAN DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acceso explícito de un vet a un caballo individual
CREATE TABLE acceso_vet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES usuario(id),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  otorgado_por UUID REFERENCES usuario(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
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
  imagen_url TEXT,
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

### Alertas

```sql
CREATE TABLE alerta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID REFERENCES sociedad(id),
  motivo TEXT NOT NULL,
  fecha_alerta DATE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por UUID NOT NULL REFERENCES usuario(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE alerta_caballo (
  alerta_id UUID NOT NULL REFERENCES alerta(id),
  caballo_id UUID NOT NULL REFERENCES caballo(id)
);
```

### Términos y Condiciones

```sql
CREATE TABLE terminos_condiciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL UNIQUE,
  titulo TEXT NOT NULL DEFAULT 'Términos y Condiciones',
  contenido TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE terminos_aceptacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  version_id UUID NOT NULL REFERENCES terminos_condiciones(id),
  aceptado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, version_id)
);
```

### Ventas y Leads (CRM)

```sql
-- Registro de ventas de caballos entre sociedades o a externos
CREATE TABLE venta_caballo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  caballo_nombre TEXT NOT NULL, caballo_categoria TEXT,
  padre_nombre TEXT, madre_nombre TEXT,
  sociedad_vendedora_id UUID NOT NULL REFERENCES sociedad(id),
  tipo_comprador TEXT NOT NULL,         -- 'sociedad' | 'externo'
  sociedad_compradora_id UUID REFERENCES sociedad(id),
  comprador_nombre TEXT, comprador_contacto TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'confirmado' | 'cancelado'
  fecha_operacion DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  precio_venta NUMERIC, moneda TEXT DEFAULT 'USD',
  notas TEXT, creado_por UUID REFERENCES usuario(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prospectos de nuevos clientes (landing page)
CREATE TABLE lead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL, email TEXT NOT NULL,
  nombre_establecimiento TEXT NOT NULL,
  cantidad_animales TEXT, modulos_interes TEXT[],
  mensaje TEXT, telefono TEXT,
  estado TEXT NOT NULL DEFAULT 'nuevo',   -- 'nuevo' | 'contactado' | 'ganado' | 'perdido'
  notas TEXT, origen TEXT NOT NULL DEFAULT 'landing',
  responsable TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Lógica de Acceso (RLS)

### Funciones auxiliares (SECURITY DEFINER)

| Función | Descripción |
|---------|-------------|
| `tiene_membresia(sociedad_id)` | El usuario autenticado tiene membresía activa en esa sociedad |
| `es_admin(sociedad_id)` | Tiene rol 'admin' en esa sociedad |
| `es_veterinario(sociedad_id)` | Tiene `usuario.rol = 'veterinario'` y `activo = TRUE` |
| `is_superadmin()` | Tiene `usuario.rol = 'superadmin'` |
| `vet_tiene_acceso(caballo_id)` | El vet tiene `usuario.rol = 'veterinario'` y `activo = TRUE` |
| `get_caballos_veterinario(vet_id)` | Caballos accesibles para el vet vía `acceso_vet` (con propietario) |
| `actualizar_caballo_veterinario(...)` | Actualiza campos de caballo desde sesión de vet |
| `toggle_prenada_veterinario(caballo_id, prenada, fecha)` | Activa/desactiva preñada de una yegua |
| `buscar_usuario_por_email(email)` | Búsqueda de usuario por email (service_role) |
| `bloquear_self_escalation()` | Trigger que impide que un usuario modifique su propio `rol`/`activo`/`acceso_centro_cria`/`email` |

### Quién ve qué

| Rol | Caballos visibles | Historial clínico |
|-----|-------------------|-------------------|
| **Admin** | Todos los caballos de la sociedad | Todos |
| **Miembro** (jugador, peticero, piloto) | Los de la sociedad vía membresía activa | Los de caballos visibles |
| **Veterinario** | Solo los con acceso explícito concedido vía `acceso_vet` | Solo los de caballos con acceso |
| **Superadmin** | Todos (cross-sociedad) | Todos |

### Política por tabla

- **`usuario`**: SELECT = propio O admin de la sociedad. UPDATE propio (`usuario_update_propio`) solo permite editar `nombre`, `apellido` y `telefono`. Los campos `rol`, `activo`, `acceso_centro_cria` y `email` están bloqueados para auto-modificación mediante el trigger `bloquear_self_escalation`.
- **`caballo`**: SELECT = miembro activo de la sociedad OR vet con acceso (`acceso_vet`). INSERT = solo admin. UPDATE = admin O vet (campos limitados).
- **`historial_clinico`**: SELECT hereda acceso al caballo. INSERT/UPDATE = solo `creado_por` (veterinario).
- **`acceso_vet`**: Acceso individual por caballo. INSERT/UPDATE = admin de la sociedad.
- **`propietario`/`propiedad`**: Gestión de propietarios dentro de la sociedad. INSERT/UPDATE = admin.

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
│   │   │   ├── mockUsers.ts            # usuarios de demo
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
        ├── 20260509000003_horses_and_owners.sql
        ├── 20260509000004_clinical_history.sql
        ├── 20260509000005_rls_policies.sql
        ├── 20260510000003_campo.sql
        ├── 20260511000001_invite_trigger.sql
        ├── 20260522000001_centro_cria.sql
        ├── 20260524000000_superadmin_rls.sql
        ├── 20260524000001_terminos_condiciones.sql
        ├── 20260524000002_alertas.sql
        ├── 20260524000003_actualizar_caballo_vet.sql
        ├── 20260528000001_fix_vet_tiene_acceso.sql
        ├── 20260601000001_fix_actualizar_caballo_vet_rol_reproductivo.sql
        ├── 20260601000002_fix_get_caballos_vet_rol_reproductivo.sql
        ├── 20260601000003_rls_vet_campo_marca.sql
        ├── 20260601000004_get_caballos_vet_propietario.sql
        ├── 20260603000001_buscar_usuario_por_email.sql
        ├── 20260603000002_fix_rls_vet_global.sql
        ├── 20260605000001_prenada.sql
        └── 20260611000001_bloquear_self_escalation.sql
```

---

## Migraciones

Las migraciones **se aplican manualmente** pegando el SQL en el **SQL Editor de Supabase Dashboard**.
No se usa `supabase db push` ni `supabase migration up` — la CLI no trackea qué migraciones
fueron ejecutadas, por lo que correr esos comandos intentaría aplicar todo de nuevo.

Los archivos en `supabase/migrations/` sirven como historial documentado de los cambios a la DB
y como fuente de verdad para recrear el esquema en un entorno nuevo.

**Flujo para aplicar una migración:**
1. Crear el archivo `.sql` en `supabase/migrations/` siguiendo el formato `YYYYMMDDNNNNN_descripcion.sql`
2. Ir a Supabase Dashboard → SQL Editor
3. Pegar el contenido del archivo y ejecutar
4. Hacer commit del archivo en la rama correspondiente

---

## Convenciones de Código

### Base de datos
- Nombres de tablas: `snake_case` en singular (`caballo`, no `caballos`)
- Catálogos: prefijo `cat_` (`cat_raza`, `cat_pelaje`)
- PKs: siempre `UUID` con `gen_random_uuid()` excepto catálogos simples (SERIAL)
- FKs: `tabla_id` (`caballo_id`, `sociedad_id`, `propietario_id`)
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

| Acción | admin | veterinario | jugador/piloto | peticero | superadmin |
|--------|-------|-------------|----------------|----------|------------|
| Ver todos los caballos de la sociedad | ✅ | Con acceso | ✅ | ✅ | ✅ |
| Crear registro clínico | ❌ | ✅ | ❌ | ❌ | ❌ |
| Editar su propio registro clínico | ❌ | ✅ | ❌ | ❌ | ❌ |
| Otorgar acceso a vet (por caballo) | ✅ | ❌ | ❌ | ❌ | ✅ |
| Gestionar propietarios | ✅ | ❌ | ❌ | ❌ | ✅ |
| Crear usuarios en la sociedad | ✅ | ❌ | ❌ | ❌ | ✅ |
| Gestionar todas las sociedades | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Mock System (desarrollo)

Los usuarios de demo cubren los roles principales:

| ID mock | Usuario | Email | Rol | Ve |
|---------|---------|-------|-----|----|
| `mock-admin` | Carlos Mendoza | admin@haras-demo.com | admin | Todos los caballos de la sociedad |
| `mock-veterinario` | Dra. Valentina Ríos | vet@haras-demo.com | veterinario | Caballos con acceso concedido |
| `mock-jugador` | Martín Urquiza | martin@haras-demo.com | jugador | Caballos de la sociedad |
| `mock-peticero` | Diego Suárez | diego@haras-demo.com | peticero | Caballos de la sociedad |

---

## Funcionalidades Futuras (no implementar aún)

- Silueta interactiva del caballo para marcar lesiones (frontend SVG + MongoDB)
- Adjuntos multimedia por registro clínico (MongoDB Atlas)
- App móvil / PWA
- Expansión multi-país
