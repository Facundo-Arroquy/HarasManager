---
name: equine-management
description: >
  Arquitectura maestra del sistema de gestión equina multi-tenant. Usar este skill
  en CUALQUIER tarea relacionada con este proyecto: diseño de tablas, endpoints,
  componentes React, lógica de permisos, migraciones, o cualquier decisión técnica.
  Si el usuario menciona caballos, historial clínico, sociedades, veterinarios,
  propietarios, acceso_vet, Supabase multi-tenant, o cualquier módulo de esta app,
  consultar este skill primero sin excepción, si sigue habiendo dudas consultarme.
---

# Equine Management System — Skill Maestro de Arquitectura

> ## ⚠️ Estado del modelo (2026-06-11)
>
> Este documento refleja el **schema vivo en producción**, no las migraciones del repo.
> El equipo aplica migraciones a mano en el SQL Editor; varias quedaron sin aplicar
> y generaron drift. Antes de proponer cualquier fix sobre RLS, funciones o tablas,
> **verificar el schema vivo vía el MCP de Supabase** (`list_tables`, `pg_policy`,
> `pg_proc`) — no confiar en lo que dicen las migraciones.
>
> **Modelo abandonado** (en migraciones pero NO en prod): `marca`, `acceso_veterinario`,
> `historial_propiedad`, columna `caballo.marca_id`, funciones `get_marca_usuario` /
> `email_dominio` / `es_admin_haras` / `es_admin_marca`. La granularidad de propiedad
> es por **sociedad**, no por marca/dominio. Ver task 35 del kanban.

## Visión General

Sistema web multi-tenant para gestión equina. Permite a múltiples sociedades
(haciendas, establecimientos) administrar sus animales, historial clínico,
propietarios y usuarios con control total de permisos.

**Escala inicial:** ~10 sociedades, 70–150 caballos c/u, ~15.000 registros clínicos.
**Expansión futura:** más sociedades, más países, adjuntos multimedia.

---

## Stack Tecnológico — INAMOVIBLE

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Base de datos | PostgreSQL vía Supabase | Relacional, 3FN, multi-tenant con RLS |
| Auth | Supabase Auth | Sin registro público; usuarios creados solo por admin |
| Frontend | React + Vite | Web responsiva, táctil-friendly |
| Deployment | Supabase + Vercel | Simplicidad, escalabilidad |

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

4. **Inmutabilidad del historial clínico** — Un registro clínico solo puede ser
   editado por el veterinario que lo creó. Nadie más puede modificarlo ni eliminarlo.
   Se registra `creado_por` en cada registro.

5. **Registro de usuarios solo por administrador** — No hay signup público.
   El admin de cada sociedad crea los usuarios y asigna roles.

6. **Auditoría básica** — Toda tabla principal tiene `created_at` y `updated_at`.
   Tablas críticas tienen además `creado_por`/`registrado_por`.

7. **Separación de responsabilidades** — Frontend no tiene lógica de negocio.
   Toda validación y regla de negocio vive en funciones SECURITY DEFINER de Supabase.

---

## Modelo de Base de Datos (3FN)

### Catálogos (tablas de referencia, sin `sociedad_id`)

```sql
CREATE TABLE cat_tipo_consulta (id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE cat_parte_cuerpo  (id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE cat_raza          (id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE cat_pelaje        (id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE cat_rol           (id SERIAL PRIMARY KEY, nombre VARCHAR(50)  NOT NULL UNIQUE);
-- Roles en cat_rol: 'admin', 'veterinario', 'piloto', 'jugador', 'peticero'
```

### Entidades principales

```sql
-- Sociedades (tenants)
CREATE TABLE sociedad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,
  cuit VARCHAR(20), direccion TEXT,
  activa BOOLEAN DEFAULT TRUE,
  acceso_centro_cria BOOLEAN DEFAULT FALSE,  -- habilita el módulo de embriones para la sociedad
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios (espejo de Supabase Auth)
-- rol global: NULL = rol definido solo por membresia | 'superadmin' | 'veterinario' | 'admin'
-- acceso_centro_cria: solo aplica para veterinarios; lo gestiona el superadmin
CREATE TABLE usuario (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL, apellido VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE, telefono VARCHAR(30),
  rol TEXT DEFAULT 'admin',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  acceso_centro_cria BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Trigger: handle_new_auth_user → INSERT en usuario al crear en auth.users
-- Trigger: bloquear_self_escalation → impide que usuario edite su propio rol/activo/acceso_centro_cria/email

-- Membresía: relación usuario <-> sociedad con rol
CREATE TABLE membresia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  rol_id INTEGER NOT NULL REFERENCES cat_rol(id),
  activa BOOLEAN DEFAULT TRUE,
  acceso_centro_cria BOOLEAN DEFAULT FALSE,  -- acceso al centro de embriones para este usuario en esta sociedad
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, sociedad_id, rol_id)
);

-- Campos / potreros dentro de una sociedad
CREATE TABLE campo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);

-- Propietarios de caballos (persona física o jurídica)
CREATE TABLE propietario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,
  documento VARCHAR(50),
  telefono VARCHAR(50),
  email VARCHAR(255),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de propiedad: quién es/fue dueño de cada caballo
-- Solo INSERT; sin UPDATE/DELETE (inmutable)
CREATE TABLE propiedad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  propietario_id UUID NOT NULL REFERENCES propietario(id),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,          -- NULL = propietario actual
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
  subcategoria TEXT,                           -- texto libre por categoría
  raza_id INTEGER REFERENCES cat_raza(id),
  pelaje_id INTEGER REFERENCES cat_pelaje(id),
  numero_chip VARCHAR(50), numero_registro VARCHAR(50),
  sociedad_id UUID REFERENCES sociedad(id),    -- NULL si es caballo de un vet sin sociedad asignada
  campo_id UUID REFERENCES campo(id),          -- potrero actual
  rol_reproductivo TEXT CHECK (rol_reproductivo IN ('Donante','Receptora')),  -- NULL = sin rol
  -- Estado actual dentro del flujo reproductivo (máquina de estados — migración 20260612000001)
  -- Donante: revision | strelling | inseminacion | oxy | ov | flushing | pg | espera
  -- Receptora: revision | ov | disponible | transferida | eco1 | eco2 | eco3 | prenada | vacia
  estado_reproductivo TEXT CHECK (estado_reproductivo IS NULL OR estado_reproductivo = ANY (ARRAY[
    'revision','strelling','inseminacion','oxy','ov','flushing','pg','espera',
    'disponible','transferida','eco1','eco2','eco3','prenada','vacia'
  ])),
  padre_id UUID REFERENCES caballo(id),        -- FK al padrillo si está registrado
  padre_nombre TEXT,                           -- nombre libre si el padre no está en sistema
  madre_id UUID REFERENCES caballo(id),
  madre_nombre TEXT,
  prenada BOOLEAN DEFAULT FALSE,
  fecha_prenez DATE,
  en_venta_pendiente BOOLEAN DEFAULT FALSE,    -- bloquea nueva venta mientras hay una activa
  vet_owner_id UUID REFERENCES usuario(id),    -- vet que creó el caballo antes de asignarlo a sociedad
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acceso explícito de un vet a un caballo (granular, caballo por caballo)
CREATE TABLE acceso_vet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES usuario(id),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  otorgado_por UUID REFERENCES usuario(id),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vet_id, caballo_id)
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
  imagen_url TEXT,                             -- URL de imagen adjunta (Supabase Storage)
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
  caballo_id UUID NOT NULL REFERENCES caballo(id),   -- donante
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  fecha DATE NOT NULL,
  veterinario_id UUID NOT NULL REFERENCES usuario(id),
  ovario_izq TEXT[] NOT NULL DEFAULT '{}',
  ovario_der TEXT[] NOT NULL DEFAULT '{}',
  utero TEXT[] NOT NULL DEFAULT '{}',
  obs_chips TEXT[] NOT NULL DEFAULT '{}',
  padrillo_id UUID REFERENCES caballo(id),
  ov_dias SMALLINT,
  review_manana BOOLEAN DEFAULT FALSE,
  review_manana_desc TEXT,
  motivo TEXT, diagnostico TEXT, tratamiento TEXT, observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cria_recordatorio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  tipo TEXT NOT NULL,  -- 'IN' | 'OXI' | 'Flushing' | 'Revisión Flushing' | 'Revisión PG' | 'Dar PG' | 'Revisión Strelin' | 'Revisión'
  fecha_vto DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','vencido','hecho','cancelado')),
  veterinario_id UUID REFERENCES usuario(id),
  notas TEXT,
  auto_generado BOOLEAN DEFAULT FALSE,
  origen_registro_id UUID REFERENCES cria_registro_clinico(id),
  cancel_motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cria_flushing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),   -- donante
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  fecha DATE NOT NULL,
  veterinario_id UUID NOT NULL REFERENCES usuario(id),
  es_negativo BOOLEAN DEFAULT FALSE,
  cantidad SMALLINT,
  -- estadio/grado/tamanio/zona_pelucida fueron movidos a tabla embrion (migración 20260612000001)
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
  veterinario_id UUID NOT NULL REFERENCES usuario(id),
  registro_id UUID NOT NULL REFERENCES cria_registro_clinico(id),
  caballo_receptora_id UUID NOT NULL REFERENCES caballo(id),
  caballo_donante_id UUID NOT NULL REFERENCES caballo(id),
  padrillo_id UUID REFERENCES caballo(id),
  flushing_id UUID REFERENCES cria_flushing(id),
  embrion_id UUID REFERENCES embrion(id),                    -- embrión específico transferido
  cl_calidad TEXT,
  tono_uterino TEXT,
  tono_cervical TEXT,
  clasificacion TEXT,     -- 'Fresco' | 'Congelado'
  sexo_embrion TEXT,      -- 'macho' | 'hembra' | 'no_determinado'
  fecha_sexado DATE,
  -- GENERATED ALWAYS AS STORED: fecha + 335 días 12 hs
  fecha_probable_parto DATE GENERATED ALWAYS AS ((fecha + INTERVAL '335 days 12 hours')::date) STORED,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un embrión por flushing; hereda padrillo_id del flushing
CREATE TABLE embrion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  flushing_id UUID NOT NULL REFERENCES cria_flushing(id),
  padrillo_id UUID REFERENCES caballo(id),        -- heredado del flushing
  caballo_donante_id UUID NOT NULL REFERENCES caballo(id),
  estadio TEXT,   -- 'Mórula' | 'Blastocisto temprano' | 'Blastocisto' | 'Blastocisto expandido'
  grado SMALLINT CHECK (grado >= 1 AND grado <= 4),
  tamanio TEXT,
  zona_pelucida TEXT,
  estado TEXT NOT NULL DEFAULT 'disponible'
    CHECK (estado IN ('disponible','transferido','descartado','congelado')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eco 1 / 2 / 3 post-transferencia
CREATE TABLE cria_ecografia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  transferencia_id UUID NOT NULL REFERENCES cria_transferencia(id),
  caballo_receptora_id UUID NOT NULL REFERENCES caballo(id),
  veterinario_id UUID NOT NULL REFERENCES usuario(id),
  numero SMALLINT NOT NULL CHECK (numero IN (1,2,3)),
  fecha DATE NOT NULL,
  resultado TEXT NOT NULL CHECK (resultado IN ('prenada','abortada','pendiente')),
  ovario_izq TEXT[] NOT NULL DEFAULT '{}',
  ovario_der TEXT[] NOT NULL DEFAULT '{}',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (transferencia_id, numero)
);

-- Plazos configurables por sociedad (sociedad_id NULL = default global)
CREATE TABLE cria_parametro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID REFERENCES sociedad(id),  -- NULL = global
  clave TEXT NOT NULL,
  descripcion TEXT,
  valor_dias SMALLINT,
  valor_horas SMALLINT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (sociedad_id, clave)
);
-- Claves disponibles: dias_strelling_alerta, dias_inseminacion_alerta, horas_oxy_alerta,
--   dias_flushing_alerta, dias_espera_ciclo, horas_strelling_receptora, horas_ovusynch_receptora,
--   dias_ov_eco1, dias_eco1_eco2, dias_eco2_eco3

-- Auditoría inmutable de cambios de estado_reproductivo (solo INSERT)
CREATE TABLE cria_estado_transicion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  estado_anterior TEXT,   -- NULL = primer estado
  estado_nuevo TEXT NOT NULL,
  motivo TEXT,
  registro_origen_id UUID REFERENCES cria_registro_clinico(id),
  flushing_origen_id UUID REFERENCES cria_flushing(id),
  transferencia_origen_id UUID REFERENCES cria_transferencia(id),
  creado_por UUID NOT NULL REFERENCES usuario(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Ventas de caballos

```sql
-- Registro de una venta entre sociedades o a externo no registrado
CREATE TABLE venta_caballo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  -- snapshot de datos del caballo al momento de la venta
  caballo_nombre TEXT NOT NULL,
  caballo_categoria TEXT,
  padre_nombre TEXT,
  madre_nombre TEXT,
  sociedad_vendedora_id UUID NOT NULL REFERENCES sociedad(id),
  tipo_comprador TEXT NOT NULL CHECK (tipo_comprador IN ('registrado','no_registrado')),
  sociedad_compradora_id UUID REFERENCES sociedad(id),  -- solo si tipo_comprador='registrado'
  comprador_nombre TEXT,
  comprador_contacto TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','cancelada','expirada')),
  fecha_operacion DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  precio_venta NUMERIC,
  moneda TEXT DEFAULT 'USD',
  notas TEXT,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);
-- ejecutar_venta_caballo(): mueve caballo a sociedad compradora y marca estado='aceptada'
-- cancelar_venta_caballo(): marca estado='cancelada' y libera en_venta_pendiente en caballo
```

### Alertas

```sql
-- Alertas de seguimiento: con sociedad (admin) o sin sociedad (vet personal)
CREATE TABLE alerta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID REFERENCES sociedad(id),  -- NULL = alerta personal del vet
  motivo TEXT NOT NULL,
  fecha_alerta DATE NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  creado_por UUID NOT NULL REFERENCES auth.users(id),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Relación M:N alerta <-> caballo
CREATE TABLE alerta_caballo (
  alerta_id UUID NOT NULL REFERENCES alerta(id),
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  PRIMARY KEY (alerta_id, caballo_id)
);
```

### Términos y condiciones

```sql
CREATE TABLE terminos_condiciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL UNIQUE,
  titulo TEXT NOT NULL DEFAULT 'Términos y Condiciones',
  contenido TEXT NOT NULL,
  activo BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE terminos_aceptacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  version_id UUID NOT NULL REFERENCES terminos_condiciones(id),
  aceptado_en TIMESTAMPTZ DEFAULT NOW()
);
```

### Leads (landing page)

```sql
-- INSERT permitido para anon (formulario público de contacto)
CREATE TABLE lead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  nombre_establecimiento TEXT NOT NULL,
  cantidad_animales TEXT,
  modulos_interes TEXT[],
  mensaje TEXT,
  telefono TEXT,
  estado TEXT NOT NULL DEFAULT 'nuevo',
  notas TEXT,
  origen TEXT NOT NULL DEFAULT 'landing',
  responsable TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ
);
```

---

## Lógica de Acceso (RLS)

### Funciones auxiliares RLS (SECURITY DEFINER)

| Función | Descripción |
|---------|-------------|
| `tiene_membresia(sociedad_id)` | El usuario tiene membresía activa en esa sociedad |
| `es_admin(sociedad_id)` | Tiene rol 'admin' activo en esa sociedad |
| `es_veterinario(sociedad_id)` | Tiene rol 'veterinario' en membresia **o** `usuario.rol = 'veterinario'` |
| `is_superadmin()` | `usuario.rol = 'superadmin' AND activo = true` |
| `puede_gestionar_campo(sociedad_id)` | Tiene rol admin, jugador o piloto activo en esa sociedad |
| `vet_tiene_acceso(caballo_id)` | Solo verifica que el auth sea veterinario activo (no revisa `acceso_vet`); usado en políticas de centro de embriones |
| `vet_tiene_acceso_caballo(caballo_id)` | Verifica fila activa en `acceso_vet` para ese caballo específico |

### Funciones de negocio (SECURITY DEFINER, llamadas desde frontend)

| Función | Descripción |
|---------|-------------|
| `crear_caballo_veterinario(...)` | Crea caballo sin `sociedad_id` + inserta en `acceso_vet` automáticamente |
| `actualizar_caballo_veterinario(p_caballo_id, ...)` | Actualiza caballo si el vet tiene acceso verificado |
| `toggle_prenada_veterinario(p_caballo_id, p_prenada, p_fecha_prenez)` | Marca/desmarca preñez; solo para Yeguas |
| `transferir_caballos_vet(p_caballo_ids, p_sociedad_destino_id)` | Asigna caballos del vet a una sociedad |
| `ejecutar_venta_caballo(p_venta_id)` | Cierra venta: mueve caballo a compradora o lo desactiva |
| `cancelar_venta_caballo(p_venta_id)` | Cancela venta pendiente y libera `en_venta_pendiente` |
| `buscar_usuario_por_email(p_email)` | Busca usuario activo; solo accesible para admin/superadmin |
| `get_veterinarios_plataforma()` | Lista todos los vets activos de la plataforma |
| `get_caballos_veterinario()` | Lista caballos accesibles por el vet autenticado (via `acceso_vet`) |
| `get_alertas_vet()` | Alertas de los próximos 30 días del vet autenticado |
| `get_consultas_recientes_vet(p_limit)` | Consultas recientes creadas por el vet autenticado |
| `get_sociedades_activas()` | Lista de todas las sociedades activas |

### Triggers

| Trigger | Función | Evento |
|---------|---------|--------|
| `on_auth_user_created` | `handle_new_auth_user()` | AFTER INSERT en `auth.users` → crea fila en `usuario` |
| `bloquear_self_escalation_trigger` | `bloquear_self_escalation()` | BEFORE UPDATE en `usuario` → impide auto-escalación de rol/activo/acceso_centro_cria/email |
| `set_updated_at` | `trigger_set_updated_at()` | BEFORE UPDATE en tablas con `updated_at` |

### Quién ve qué

| Rol | Caballos visibles | Historial clínico |
|-----|-------------------|-------------------|
| **superadmin** | Todos | Todos |
| **Admin** (membresia rol='admin') | Todos los de su sociedad | Todos los de su sociedad |
| **Jugador / Piloto / Peticero** | Todos los de su sociedad | Todos los de su sociedad |
| **Veterinario** (global) | Solo los que tiene en `acceso_vet` activo | Solo los de caballos con acceso |

### Política RLS por tabla

**`sociedad`**
- SELECT: `tiene_membresia(id)` o `is_superadmin()`
- UPDATE: `es_admin(id)` o `is_superadmin()`
- INSERT: solo `is_superadmin()`

**`usuario`**
- SELECT propio: `id = auth.uid()`
- SELECT por admin: admin de alguna sociedad donde el usuario tiene membresia
- SELECT vets: cualquier autenticado puede ver usuarios con `rol = 'veterinario'`
- SELECT superadmin: `is_superadmin()`
- UPDATE propio: `id = auth.uid()` — bloqueado por trigger para rol/activo/acceso_centro_cria/email
- UPDATE superadmin: `is_superadmin()`

**`membresia`**
- SELECT: propia (`usuario_id = auth.uid()`) o admin de esa sociedad o superadmin
- INSERT/UPDATE: `es_admin(sociedad_id)`
- DELETE: `is_superadmin()`

**`campo`**
- SELECT: `tiene_membresia(sociedad_id)` o vet activo o superadmin
- INSERT/UPDATE: `puede_gestionar_campo(sociedad_id)`
- DELETE: miembro con rol admin/jugador/piloto

**`propietario`**
- SELECT: `tiene_membresia(sociedad_id)`
- INSERT/UPDATE: `es_admin(sociedad_id)`

**`propiedad`**
- SELECT: `tiene_membresia` (vía caballo.sociedad_id)
- INSERT: `es_admin` (vía caballo.sociedad_id)

**`caballo`**
- SELECT: `tiene_membresia(sociedad_id)` o `vet_tiene_acceso(id)` o `vet_tiene_acceso_caballo(id)` o superadmin
- INSERT admin: `es_admin(sociedad_id)`
- INSERT vet: `vet_owner_id = auth.uid() AND sociedad_id IS NULL` (vet crea sin sociedad)
- UPDATE admin: `es_admin(sociedad_id)`
- UPDATE vet: `vet_tiene_acceso(id)`

**`acceso_vet`**
- SELECT admin: miembro activo de la sociedad del caballo
- SELECT vet: `vet_id = auth.uid()`
- INSERT admin: miembro activo de la sociedad del caballo
- INSERT vet: `vet_id = auth.uid()` (vet se auto-inserta via función)
- UPDATE admin: miembro activo de la sociedad del caballo

**`historial_clinico`**
- SELECT: `tiene_membresia` del caballo o fila activa en `acceso_vet`
- INSERT: vet (`creado_por = auth.uid()` y rol veterinario)
- UPDATE: solo `creado_por = auth.uid()`

**`historial_parte_afectada` / `historial_medicamento`**
- SELECT: `tiene_membresia` (vía caballo)
- INSERT/UPDATE: `creado_por` del historial = `auth.uid()`

**`cria_registro_clinico` / `cria_recordatorio` / `cria_flushing` / `cria_transferencia`**
- SELECT: `tiene_membresia(sociedad_id)` o `vet_tiene_acceso(caballo_id)`
- INSERT: `vet_tiene_acceso(caballo_id)` (solo vets activos)
- UPDATE: `veterinario_id = auth.uid()` o `es_admin(sociedad_id)` (en recordatorio)

**`embrion`**
- SELECT: `tiene_membresia(sociedad_id)` o `is_superadmin()`
- INSERT: `vet_tiene_acceso(caballo_donante_id)`
- UPDATE: `vet_tiene_acceso(caballo_donante_id)` o `es_admin(sociedad_id)` o `is_superadmin()`

**`cria_ecografia`**
- SELECT: `tiene_membresia(sociedad_id)` o `vet_tiene_acceso(caballo_receptora_id)` o `is_superadmin()`
- INSERT: `vet_tiene_acceso(caballo_receptora_id)`
- UPDATE: `veterinario_id = auth.uid()` o `es_admin(sociedad_id)` o `is_superadmin()`

**`cria_parametro`**
- SELECT: `sociedad_id IS NULL` (globales, visibles para todos) o `tiene_membresia(sociedad_id)` o `is_superadmin()`
- INSERT/UPDATE: `sociedad_id IS NULL AND is_superadmin()` o `es_admin(sociedad_id)`

**`cria_estado_transicion`**
- SELECT: `tiene_membresia(sociedad_id)` o `is_superadmin()`
- INSERT: `vet_tiene_acceso(caballo_id)` o `es_admin(sociedad_id)` o `is_superadmin()`
- Sin UPDATE/DELETE (tabla append-only)

**`venta_caballo`**
- SELECT: miembro de sociedad vendedora o compradora
- INSERT: admin de sociedad vendedora

**`alerta`**
- SELECT/INSERT/UPDATE/DELETE con sociedad: miembro activo de esa sociedad
- SELECT/INSERT/UPDATE/DELETE sin sociedad: `creado_por = auth.uid()` (alerta personal del vet)

**`alerta_caballo`**
- Hereda acceso de la alerta asociada

**`terminos_condiciones`**
- SELECT: cualquier autenticado (solo los activos)

**`terminos_aceptacion`**
- SELECT/INSERT: `usuario_id = auth.uid()`

**`lead`**
- INSERT: anon y authenticated (formulario público)
- SELECT/UPDATE: cualquier authenticated

**Catálogos** (`cat_*`)
- SELECT: cualquier autenticado (`true`)

---

## Estructura de Carpetas del Proyecto

```
HarasManager/
├── CLAUDE.md
├── TASKS.md
├── docs/
│   └── SKILL.md                        # Este archivo
├── frontend/                           # React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                     # Spinner, etc.
│   │   │   ├── layout/                 # AppLayout, Sidebar, BottomNav
│   │   │   ├── centro-cria/            # Modales del módulo de embriones
│   │   │   └── domain/                 # CaballoCard, HistorialCard, modales
│   │   ├── pages/                      # Una carpeta por sección
│   │   ├── services/                   # Todas las llamadas a Supabase
│   │   ├── store/                      # Zustand (authStore, crianzaStore)
│   │   ├── hooks/                      # useAuth, etc.
│   │   ├── types/                      # Tipos TypeScript
│   │   ├── utils/                      # Helpers
│   │   └── dev/                        # Mock system (SOLO desarrollo local)
│   │       ├── mockMode.ts
│   │       ├── mockUsers.ts
│   │       ├── mockData.ts
│   │       └── DevPanel.tsx
│   └── .env.example
└── supabase/
    └── migrations/                     # Historial documental de cambios a la DB
        └── *.sql
```

---

## Migraciones

Las migraciones **se aplican manualmente** pegando el SQL en el **SQL Editor de Supabase Dashboard**.
No se usa `supabase db push` ni `supabase migration up`. Supabase no registra qué migraciones
fueron ejecutadas (la tabla de tracking está vacía), por lo que los archivos en
`supabase/migrations/` son exclusivamente historial documental para recrear el esquema.

**Flujo para aplicar una migración:**
1. Crear el archivo `.sql` en `supabase/migrations/` con formato `YYYYMMDDNNNNN_descripcion.sql`
2. Ir a Supabase Dashboard → SQL Editor
3. Pegar el contenido y ejecutar
4. Hacer commit del archivo en la rama correspondiente
5. Actualizar este SKILL.md en el mismo PR

---

## Convenciones de Código

### Base de datos
- Nombres de tablas: `snake_case` en singular (`caballo`, no `caballos`)
- Catálogos: prefijo `cat_` (`cat_raza`, `cat_pelaje`)
- PKs: siempre `UUID` con `gen_random_uuid()` excepto catálogos simples (SERIAL)
- FKs: `tabla_id` (`caballo_id`, `sociedad_id`)
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

| Acción | superadmin | admin | veterinario | jugador/piloto/peticero |
|--------|------------|-------|-------------|------------------------|
| Ver todos los caballos del haras | ✅ | ✅ | Con `acceso_vet` | ✅ (misma sociedad) |
| Crear/editar caballo (sociedad) | ✅ | ✅ | ❌ | ❌ |
| Crear caballo propio (sin sociedad) | — | — | ✅ | ❌ |
| Crear registro clínico | — | ❌ | ✅ | ❌ |
| Editar su propio registro clínico | — | ❌ | ✅ | ❌ |
| Gestionar propietarios | ✅ | ✅ | ❌ | ❌ |
| Otorgar acceso a vet | ✅ | ✅ | ❌ | ❌ |
| Crear usuarios en la sociedad | ✅ | ✅ | ❌ | ❌ |
| Vender caballos | ✅ | ✅ | ❌ | ❌ |
| Gestionar campos/potreros | ✅ | ✅ | ❌ (solo lectura) | ✅ |
| Acceso centro de embriones | — | Según `sociedad.acceso_centro_cria` | Según `usuario.acceso_centro_cria` | ❌ |

---

## Mock System (desarrollo)

Los usuarios de demo cubren los roles principales:

| ID mock | Usuario | Email | Rol |
|---------|---------|-------|-----|
| `mock-admin-haras` | Carlos Mendoza | admin@haras-demo.com | admin |
| `mock-veterinario` | Dra. Valentina Ríos | vet@haras-demo.com | veterinario |
| `mock-admin-estancia` | Rodrigo Benavídez | admin@losalamos.com | admin |
| `mock-jugador` | Martín Urquiza | martin@losalamos.com | jugador |
| `mock-peticero` | Diego Suárez | diego@pcba.com.ar | peticero |

---

## Funcionalidades Futuras (no implementar aún)

- Silueta interactiva del caballo para marcar lesiones (frontend SVG)
- Adjuntos multimedia por registro clínico (MongoDB Atlas o Supabase Storage)
- App móvil / PWA
- Expansión multi-país
