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

> ## ⚠️ Estado del modelo (2026-06-18)
>
> Este documento refleja el **schema vivo en producción**, no las migraciones del repo.
> Las migraciones se aplican vía MCP (`apply_migration`); antes se aplicaban a mano,
> lo que generó drift. Antes de proponer cualquier fix sobre RLS, funciones o tablas,
> **verificar el schema vivo vía el MCP de Supabase** (`list_tables`, `pg_policy`,
> `pg_proc`) — no confiar solo en las migraciones del repo.
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
| Auth | Supabase Auth | Sin registro público salvo vets independientes; resto de usuarios creados solo por admin |
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

5. **Registro de usuarios solo por administrador, con una excepción** — Para
   usuarios de una sociedad, no hay signup público: el admin los crea y les
   asigna rol. Única excepción: veterinarios independientes vía
   `/registro-veterinario` (ver "Suscripción de veterinarios independientes"
   más abajo), que se autoregistran sin pertenecer a ninguna sociedad.

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
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios (espejo de Supabase Auth)
-- rol global: NULL = rol definido solo por membresia | 'superadmin' | 'veterinario' | 'admin'
CREATE TABLE usuario (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL, apellido VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE, telefono VARCHAR(30),
  rol TEXT DEFAULT 'admin',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Trigger: handle_new_auth_user → INSERT en usuario al crear en auth.users
-- Trigger: bloquear_self_escalation → impide que usuario edite su propio rol/activo/email

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

-- Campos / potreros. Pertenecen a una sociedad O a un veterinario, nunca a
-- ambos: los campos de vet agrupan los caballos que maneja por su cuenta
-- (los que tienen `sociedad_id IS NULL`). Migración `campo_propio_de_veterinario`.
CREATE TABLE campo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID REFERENCES sociedad(id),    -- NULL si el campo es de un vet
  vet_owner_id UUID REFERENCES usuario(id),    -- NULL si el campo es de una sociedad
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  CONSTRAINT campo_duenio_check CHECK (
    (sociedad_id IS NOT NULL AND vet_owner_id IS NULL)
    OR
    (sociedad_id IS NULL AND vet_owner_id IS NOT NULL)
  )
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
  -- Pedigree. Regla de UI (definición de Gero, 2026-08-02): el combo de padre
  -- ofrece solo categorías 'Caballo' y 'Padrillo', el de madre solo 'Yegua', y
  -- ambos INCLUYEN animales dados de baja/muertos (`activo = false`) porque el
  -- pedigree es histórico. Ver CATEGORIAS_PADRE/CATEGORIAS_MADRE en
  -- services/caballoService.ts.
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

-- Tags de caballos (migración 20260802120000)
-- Catálogo + M:N en vez de una columna booleana: sumar un tag nuevo no
-- requiere migración ni cambios de UI. Arranca con 'Jugador' (animales
-- destinados o usados para juego/deporte).
-- Los tags se pueden poner en cualquier categoría (CATEGORIAS_CON_TAGS en
-- services/tagService.ts): "asignable a caballos y yeguas" se lee como
-- cualquier equino, macho o hembra.
CREATE TABLE cat_tag (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  color TEXT,                                  -- clave de color para la UI
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Pre-cargado: 'Jugador'

CREATE TABLE caballo_tag (
  caballo_id UUID NOT NULL REFERENCES caballo(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES cat_tag(id) ON DELETE CASCADE,
  creado_por UUID REFERENCES usuario(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (caballo_id, tag_id)
);

-- Sistema de módulos por empresa (migración 20260810140000)
-- Catálogo + 3 tablas puente en vez de columnas booleanas repetidas en
-- sociedad/membresia/usuario (acceso_centro_cria x3): sumar un módulo nuevo
-- es un INSERT en cat_modulo, no una migración de schema. Reemplaza el bug
-- real donde sociedad.acceso_centro_cria terminó GENERATED ALWAYS AS
-- (plan <> 'silver') STORED por una PR sin mergear (#47) y los UPDATE a mano
-- del superadmin empezaron a fallar en silencio.
CREATE TABLE cat_modulo (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Pre-cargado: 'centro_cria' ("Centro de Embriones"), 'polo' ("Polo")

-- sociedad_modulo: habilitado a nivel organización. Solo superadmin escribe
-- (no hereda el vector es_admin(id) que sí tiene sociedad_update).
CREATE TABLE sociedad_modulo (
  sociedad_id UUID NOT NULL REFERENCES sociedad(id) ON DELETE CASCADE,
  modulo_id INTEGER NOT NULL REFERENCES cat_modulo(id) ON DELETE CASCADE,
  habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sociedad_id, modulo_id)
);

-- membresia_modulo: override individual por usuario dentro de su sociedad.
-- Escribe el admin de la empresa o superadmin (igual que membresia hoy).
CREATE TABLE membresia_modulo (
  membresia_id UUID NOT NULL REFERENCES membresia(id) ON DELETE CASCADE,
  modulo_id INTEGER NOT NULL REFERENCES cat_modulo(id) ON DELETE CASCADE,
  habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (membresia_id, modulo_id)
);

-- usuario_modulo: acceso para veterinarios globales (sin sociedad/membresía).
-- Solo superadmin escribe.
CREATE TABLE usuario_modulo (
  usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  modulo_id INTEGER NOT NULL REFERENCES cat_modulo(id) ON DELETE CASCADE,
  habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, modulo_id)
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

### Suscripción de veterinarios independientes

```sql
-- Freemium: hasta 5 caballos propios (sociedad_id IS NULL) gratis por vet, y
-- hasta 25 con la membresía paga;
-- a partir del 6to hace falta una fila 'activa' acá. Fase 1: activación
-- manual por superadmin, sin pasarela de pago (migración 20260811150000).
CREATE TABLE suscripcion_veterinario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  estado TEXT NOT NULL DEFAULT 'inactiva' CHECK (estado IN ('activa', 'inactiva', 'cancelada')),
  activado_por UUID REFERENCES usuario(id),
  fecha_activacion TIMESTAMPTZ,
  fecha_vencimiento TIMESTAMPTZ,        -- NULL = sin vencimiento
  proveedor_pago TEXT,                  -- NULL en Fase 1; 'mercadopago' en Fase 2
  external_subscription_id TEXT,        -- id de preapproval de MercadoPago, Fase 2
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- UNIQUE en usuario_id: una fila por vet
```

Auto-registro público (`/registro-veterinario`, migración `20260811160000`):
el trigger `handle_new_auth_user` lee `rol_solicitado` del metadata de
`auth.signUp()` — si es `'veterinario'`, pone `usuario.rol = 'veterinario'`
e inserta la fila inicial `'inactiva'` acá mismo, en la misma transacción.
Sin ese flag, el comportamiento es idéntico al de antes (`rol = 'admin'`).

**Dependencia de infraestructura (no vive en migraciones):** este flujo asume
"Confirm email" prendido en el Dashboard de Supabase (Authentication → Sign
In / Providers → Email). Con eso prendido, `signUp()` no devuelve sesión y
`RegistroVeterinarioPage` muestra el paso "revisá tu email"; con eso apagado,
el usuario queda logueado al instante sin verificar nada (el código soporta
ambos casos, ver comentario en `RegistroVeterinarioPage.tsx::handleSubmit`).
No hay ninguna tool de MCP que exponga este toggle ni el SMTP config del
proyecto — es 100% manual en el Dashboard.

El 2026-08-12 el toggle estuvo apagado sin documentar en ningún lado
(confirmado por logs de Auth: un signup a las 16:13 exigió confirmación y
bloqueó el login siguiente con `email_not_confirmed`; otro a las 16:30 tuvo
`immediate_login_after_signup`). Se reactivó ese mismo día. Verificado con un
signup real vía `POST /auth/v1/signup`: con dominio `gmail.com` responde 200,
sin sesión, con `confirmation_sent_at` seteado y `confirmed_at` en null — el
mailer del proyecto sí encola el correo (no se confirmó visualmente que
llegue a una bandeja de entrada real, pero no hay error del lado de GoTrue).
Ojo: con dominios claramente falsos (`example.com`) devuelve `500
unexpected_failure` con el mensaje de gomail rechazando el destinatario — es
esperable, no es un bug. Si se vuelve a tocar el toggle, dejar rastro acá.

**Downgrade: qué pasa cuando la suscripción deja de estar activa**
(migraciones `20260812120000`–`20260812120300`)

El gate original solo se evaluaba al crear. Eso dejaba un agujero: un vet que
pagaba un mes, cargaba 50 caballos y dejaba de pagar se quedaba con los 50 para
siempre, porque nada volvía a mirar el estado hacia atrás. Ahora:

1. `RequireAuth` llama a `vet_estado_limite()` al entrar (solo si
   `rol = 'veterinario'`), y espera la respuesta antes de renderizar.
2. Si `debe_regularizar` (más caballos propios que el límite que le aplica —
   `vet_limite_aplicable()`, o sea 5 sin membresía y 25 con ella; antes exigía además que
   sin suscripción vigente), se monta `LimiteCaballosVetModal` — bloqueante, sin
   forma de cerrarlo. Los T&C tienen prioridad si ambos están pendientes.
3. El vet tiene dos salidas: seleccionar caballos con checkbox y darlos de baja
   con `dar_de_baja_caballos_veterinario()` hasta volver al límite, o retomar la
   membresía (botón deshabilitado hasta la Fase 2 de MercadoPago).
4. Es **baja lógica**, no borrado: `vet_caballos_propios()` cuenta solo activos,
   así que alcanza para regularizar, y el historial clínico, la sanidad y el
   pedigree quedan intactos por si el vet vuelve a suscribirse.
5. La vuelta es **manual**: `/panel-vet` tiene una sección "Dados de baja"
   (`CaballosDadosDeBajaVet`) donde el vet ve los inactivos y elige cuáles
   reactivar. No es automática al reactivar la suscripción a propósito — hoy
   no se distingue una baja por límite de una baja por venta o muerte del
   animal, y revivir un caballo vendido porque el vet volvió a pagar sería
   peor que pedirle que lo elija.

Si la verificación falla (red, RLS), no se bloquea al vet: el gate del alta
sigue viviendo en `crear_caballo_veterinario`, así que un error acá no habilita
nada que no estuviera habilitado.

**Fase 2: cobro con MercadoPago** (migraciones `20260813120000`–`20260813120100`)

```sql
-- Cuánto sale la membresía. El precio vive en la base y no en el código para
-- que cambiarlo no requiera un deploy; el checkout lee siempre la fila activa.
CREATE TABLE plan_suscripcion_vet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,          -- 'mensual'
  nombre TEXT NOT NULL,                 -- lo ve el vet en el checkout de MP
  precio NUMERIC(12,2) NOT NULL CHECK (precio > 0),
  moneda TEXT NOT NULL DEFAULT 'ARS',   -- currency_id de MercadoPago
  frecuencia INTEGER NOT NULL DEFAULT 1,
  frecuencia_tipo TEXT NOT NULL DEFAULT 'months' CHECK (frecuencia_tipo IN ('days','months')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Índice único parcial ((TRUE)) WHERE activo: un solo plan vigente por vez.

-- Auditoría de cobros. No es tabla de estado — el estado sigue siendo el de
-- suscripcion_veterinario. UNIQUE(proveedor, external_payment_id) hace que el
-- webhook sea idempotente: MercadoPago reintenta hasta recibir un 200.
CREATE TABLE pago_veterinario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  suscripcion_id UUID REFERENCES suscripcion_veterinario(id),
  proveedor TEXT NOT NULL DEFAULT 'mercadopago',
  external_payment_id TEXT NOT NULL,
  external_preapproval_id TEXT,
  estado TEXT NOT NULL,                 -- estado crudo de MP (approved, rejected, …)
  monto NUMERIC(12,2), moneda TEXT, fecha_pago TIMESTAMPTZ,
  payload JSONB,                        -- respuesta cruda del recurso consultado
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`suscripcion_veterinario` suma `plan_id`, `fecha_cancelacion` y el estado
`'pendiente'` (preapproval creado, medio de pago sin cargar — no habilita nada).

El flujo:

1. El vet toca "Retomar membresía" (modal del límite) o "Suscribirme"
   (`MembresiaVetCard`, en `/config-vet/suscripcion`). Ambos llaman a la Edge Function
   **`crear-suscripcion-vet`**, que crea un preapproval en MercadoPago con
   `status: 'pending'` y devuelve el `init_point` del checkout. El `usuario_id`
   sale del JWT: acá no se tocan datos de tarjeta, así que el proyecto queda
   fuera del alcance de PCI.
2. `mp_registrar_preapproval()` guarda el id **antes** de mandar al vet al
   checkout — es lo que después le permite al webhook saber de quién es el
   evento. Si el vet ya tenía un preapproval en `'pendiente'` (abrió el checkout
   y lo abandonó), se lo da de baja en MercadoPago antes de crear el nuevo: su
   `init_point` sigue vivo, y dejar dos links válidos con uno solo registrado
   significa que si el vet vuelve al viejo, paga y nunca nos enteramos.
3. El vet paga en MercadoPago y vuelve a `/suscripcion/resultado`, que consulta
   el estado en intervalos. Esa ruta vive **fuera de `RequireAuth`** a propósito:
   ese guard monta el modal bloqueante del límite, y el vet que acaba de pagar
   quedaría atrapado detrás justo mientras se espera la confirmación.
4. Quien activa la membresía es la Edge Function **`mercadopago-webhook`**, no
   el redirect (que el vet puede no completar nunca). Valida la firma HMAC del
   header `x-signature` antes de mirar el contenido, y **no confía en el body**:
   consulta `GET /preapproval/{id}` o `/authorized_payments/{id}` con el access
   token. Se despliega con `--no-verify-jwt` — MercadoPago no manda JWT de
   Supabase, y con la verificación puesta Supabase rechazaría todas las
   notificaciones antes de que la función corra.
5. `mp_sincronizar_suscripcion()` mapea el estado (`pending`→`pendiente`,
   `authorized`→`activa`, `paused`→`inactiva`, `cancelled`→`cancelada`) y pone
   `fecha_vencimiento = next_payment_date + 3 días` de gracia: con la fecha
   pelada, entre el vencimiento y la llegada del webhook del cobro nuevo habría
   una ventana en la que un vet al día se come el modal bloqueante.

La baja la hace la Edge Function **`cancelar-suscripcion-vet`** (`PUT
/preapproval/{id}` con `status: cancelled`), desde la misma tarjeta del panel.
El id de preapproval se lee de la base a partir del usuario del JWT, no del
body: así nadie puede cancelarle la membresía a otro. La doc de MercadoPago se
contradice sobre si el valor va con una o dos eles, así que la función prueba
los dos antes de dar el error por bueno.

`vet_suscripcion_activa()` cambió con esto: ahora una suscripción `'cancelada'`
**con `fecha_vencimiento` futura sigue contando como activa**. Cancelar no debe
cortar el acceso en el acto — el vet ya pagó ese mes. Una cancelación de Fase 1
(manual del superadmin, sin vencimiento) sigue cortando ya.

Las tres funciones `mp_*` están revocadas de `PUBLIC`/`anon`/`authenticated` y
solo las puede ejecutar `service_role`: si `authenticated` pudiera llamarlas,
cualquier vet se activaría la membresía pasando un id de preapproval.

Secrets de las Edge Functions: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `APP_URL`.
Ninguna es `VITE_*` — no van al build del frontend. El paso a paso de
configuración está en `docs/specs/mercadopago-setup.md`.

### Baja definitiva de un usuario (superadmin)

El caso real: un veterinario se registró de prueba o con datos mal y necesita
volver a registrarse desde cero con el mismo email. Eso requiere borrar en dos
sistemas que no comparten transacción, y en orden.

Lo resuelve la Edge Function **`eliminar-usuario`**, que el superadmin dispara
desde el botón de la papelera en la pestaña Veterinarios:

1. **Cancela la suscripción en MercadoPago** si hay un preapproval vivo. Va
   primero a propósito: si el usuario desapareciera de la base con el
   preapproval activo, MercadoPago le seguiría cobrando la tarjeta y ya no
   quedaría de nuestro lado a quién atribuir el cobro. Si falla, aborta sin
   borrar nada.
2. Llama a `superadmin_eliminar_usuario()`, que valida y purga el esquema
   `public` en una sola transacción (ver la tabla de funciones de negocio).
3. Recién entonces borra de `auth.users` con la Admin API, que es lo que libera
   el email. Si este último paso falla, lo informa explícitamente en vez de
   devolver éxito: el perfil ya no está, pero el email sigue tomado hasta
   borrarlo desde Authentication → Users.

**El historial clínico no se elimina nunca**, ni siquiera el que está sobre los
caballos propios del vet: es el registro médico del animal y le sobrevive. Si
el usuario escribió alguno, la baja se rechaza entera. Es deliberado que falle
ruidosamente — un botón de "eliminar" que se lleva puesto el historial de un
haras es mucho peor que uno que a veces dice que no.

Los planes sanitarios y el centro de cría se tratan distinto: si el vet solo
fue el **autor** sobre un caballo que no es suyo (el caso típico — un vet
tratante sin caballos propios), la autoría se desvincula y el registro queda.
Solo bloquean si están sobre un caballo **propio** del vet, porque ese caballo
se borra con él.

### Torneos (asignación de caballos por jugador)

```sql
-- Migración 20260803120000. Módulo de administración: el admin arma el torneo
-- con sus jugadores participantes y reparte los caballos con tag "Jugador" en
-- un tablero kanban (columna de disponibles + una columna por jugador).
-- El torneo no se borra al terminar: queda como historial de conformación de
-- equipos, consultable por temporada.
CREATE TABLE torneo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id  UUID NOT NULL REFERENCES sociedad(id),
  nombre       TEXT NOT NULL,
  temporada    TEXT,                       -- "2026", "Alta 2026", etc.
  fecha_inicio DATE, fecha_fin DATE,
  estado       TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo','finalizado','cancelado')),
  notas        TEXT,
  creado_por   UUID REFERENCES usuario(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

-- Una columna del kanban. `usuario_id` es opcional a propósito: en polo el
-- jugador no siempre es usuario de la plataforma (definición 2026-08-03).
CREATE TABLE torneo_jugador (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id  UUID NOT NULL REFERENCES torneo(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuario(id),   -- NULL = jugador externo al sistema
  nombre     TEXT NOT NULL,
  orden      SMALLINT NOT NULL DEFAULT 0,   -- orden de las columnas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (torneo_id, nombre),
  UNIQUE (id, torneo_id)                    -- habilita la FK compuesta de abajo
);

CREATE TABLE torneo_asignacion (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id  UUID NOT NULL REFERENCES torneo(id) ON DELETE CASCADE,
  jugador_id UUID NOT NULL,
  caballo_id UUID NOT NULL REFERENCES caballo(id) ON DELETE CASCADE,
  orden      SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (torneo_id, caballo_id),           -- evita la asignación duplicada
  FOREIGN KEY (jugador_id, torneo_id)
    REFERENCES torneo_jugador (id, torneo_id) ON DELETE CASCADE
);
-- Sin UNIQUE sobre `orden`: reordenar dentro de una columna chocaría fila por
-- fila. La escritura va siempre por `guardar_asignaciones_torneo()`.
-- El orden de la columna "Disponibles" no se persiste: se arma alfabéticamente
-- en cada carga a partir de los caballos con tag "Jugador" sin asignar.
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
  -- 'pendiente' = consulta agendada desde el calendario, sin ficha clínica
  -- cargada todavía; pasa a 'realizada' al completarla (migración 20260806120000)
  estado TEXT NOT NULL DEFAULT 'realizada'
    CHECK (estado IN ('pendiente','realizada')),
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

-- Trabajos sanitarios multi-caballo (migración 20260728181738)
-- Un trabajo (ej: desparasitar) se arma como una lista de caballos programada
-- para un día; al completarlo se escribe una fila en el historial_clinico de
-- cada caballo no excluido.
CREATE TABLE cat_trabajo_sanitario (           -- catálogo editable (NULL = global)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID REFERENCES sociedad(id),    -- NULL = trabajo global
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (sociedad_id, nombre)
);
-- Globales pre-cargados: Desparasitación, Vacunación, Herrado,
--   Control odontológico, Extracción de sangre.

CREATE TABLE trabajo_sanitario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Los trabajos cargados juntos desde "Nuevo plan sanitario" comparten plan_id:
  -- son las columnas de una misma grilla caballo × trabajo (migración 20260806130000)
  plan_id UUID NOT NULL DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  nombre TEXT NOT NULL,
  fecha_programada DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','realizado','cancelado')),
  tratamiento TEXT, observaciones TEXT,
  fecha_realizado DATE,
  creado_por UUID NOT NULL REFERENCES usuario(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trabajo_sanitario_caballo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabajo_id UUID NOT NULL REFERENCES trabajo_sanitario(id) ON DELETE CASCADE,
  caballo_id UUID NOT NULL REFERENCES caballo(id),
  excluido BOOLEAN NOT NULL DEFAULT false,       -- checkbox de exclusión al completar
  -- Resultado por caballo y trabajo (migración 20260806130000). NULL = sin marcar
  -- todavía. Solo 'realizado' escribe historial; 'pendiente' es lo que se
  -- reprograma en un plan nuevo. Se mantiene sincronizado con `excluido`.
  estado TEXT CHECK (estado IN ('realizado','no_realizado','pendiente')),
  historial_id UUID REFERENCES historial_clinico(id),  -- fila creada al completar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trabajo_id, caballo_id)
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
  numero SMALLINT NOT NULL CHECK (numero >= 1),   -- habitualmente 1..3; migración 20260728232404 relajó el IN (1,2,3)
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

-- Catálogo editable de acciones/tratamientos del registro (obs_chips) — antes
-- hardcodeado como CHIPS_OBS en el frontend.
-- Migración 20260730120000: la lista es de cada VETERINARIO, no de la sociedad
-- (definición de Gero: "la lista la define cada veterinario"). Reemplaza el
-- modelo por sociedad de 20260729161500, donde el vet no veía los chips porque
-- no tiene membresía. Cada vet arranca con la lista vacía y la arma él.
CREATE TABLE cat_chip_obs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veterinario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (veterinario_id, nombre)
);
-- Sin filas pre-cargadas. Los nombres que disparan recordatorios automáticos
-- (Strelin, IN, OV, PG, Flushing, Transferida) NO están protegidos: el vet
-- puede sacarlos y la UI se lo avisa. Esa lista vive en el frontend
-- (CHIPS_CON_RECORDATORIO en types/crianza.ts), junto a las reglas que la leen.

-- Plazos de recordatorios por veterinario (migración 20260730120000).
-- Antes vivían en localStorage, con lo cual el plazo aplicado era el del
-- navegador y no el del vet. Si no hay fila, el frontend usa los defaults.
CREATE TABLE cria_plazo_vet (
  veterinario_id              UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  donante_strelin_a_in        SMALLINT NOT NULL DEFAULT 1,
  donante_in_a_oxi            SMALLINT NOT NULL DEFAULT 1,
  donante_ov_a_flushing       SMALLINT NOT NULL DEFAULT 6,
  donante_pg_a_revision_pg    SMALLINT NOT NULL DEFAULT 3,
  donante_flushing_a_revision SMALLINT NOT NULL DEFAULT 4,
  receptora_pg_a_revision_pg  SMALLINT NOT NULL DEFAULT 4,
  receptora_ov_a_dar_pg       SMALLINT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cria_plazo_vet_rangos CHECK (todos los valores BETWEEN 1 AND 30)
);
-- NOTA: `cria_parametro` (por sociedad, clave/valor) sigue existiendo pero
-- nunca se conectó al frontend. Los plazos del centro son `cria_plazo_vet`.

-- Ranking de padrillos preferidos por donante (migración 20260802120200)
-- Definición de Gero (2026-08-02): hasta 10 padrillos por donante, ordenados
-- por prioridad (1 = más recomendado). La lista es del ESTABLECIMIENTO, no del
-- vet: la arman admin o veterinario, y el vet solo con las donantes y
-- padrillos a los que el admin le dio acceso (`acceso_vet`).
-- Se muestra al elegir padrillo en la inseminación: los rankeados van primero
-- con su número de prioridad.
CREATE TABLE cria_padrillo_preferido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  donante_id  UUID NOT NULL REFERENCES caballo(id) ON DELETE CASCADE,
  padrillo_id UUID NOT NULL REFERENCES caballo(id) ON DELETE CASCADE,
  prioridad   SMALLINT NOT NULL CHECK (prioridad BETWEEN 1 AND 10),
  creado_por  UUID REFERENCES usuario(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (donante_id <> padrillo_id),
  UNIQUE (donante_id, padrillo_id),
  UNIQUE (donante_id, prioridad)
);
-- El reordenamiento choca contra UNIQUE (donante_id, prioridad), así que la
-- escritura va siempre por `guardar_ranking_padrillos()` (borra + reinserta en
-- una transacción). El frontend nunca hace UPDATE fila por fila.

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

> **Sin UI desde 2026-08-07.** La sección "Alertas" del frontend se eliminó: los
> planes sanitarios ya se ven en Sanidad y en Calendario, y las alertas del panel
> del vet salen del RPC `get_alertas_vet` (historial), no de estas tablas. Las
> tablas y sus políticas siguen en la base con los datos históricos; nada las
> escribe ni las lee hoy.

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
| `vet_tiene_acceso(caballo_id)` | Verifica fila activa en `acceso_vet` para ese caballo **y** que el usuario sea veterinario activo; usado en políticas de centro de embriones (corregida en `20260611155651` — antes ignoraba el parámetro) |
| `vet_tiene_acceso_caballo(caballo_id)` | Verifica fila activa en `acceso_vet` para ese caballo específico |
| `vet_limite_gratuito()` | Constante del plan gratuito (hoy 5). Única fuente del número: la comparten `vet_puede_agregar_caballo` y `vet_estado_limite` para que no se desincronicen (migración `20260812120000`). **Con EXECUTE para `anon`** (migración `20260812130000`): es solo un entero sin datos de usuario, y la página pública de registro la necesita para no hardcodear el número en el marketing copy |
| `vet_limite_pago()` | Constante del plan con membresía (hoy 25). La membresía **no es ilimitada** (migración `20260813120200`) |
| `vet_limite_aplicable(usuario_id)` | Devuelve 25 o 5 según haya membresía vigente. Es la única fuente del tope: la consultan el alta, la reactivación y el chequeo retroactivo. **Revocada de `authenticated`**: toma el usuario por parámetro y es `SECURITY DEFINER`, así que abierta permitiría deducir si otro vet paga (migración `20260813120200`) |
| `_vet_valida_propios(p_caballo_ids, p_activo_esperado)` | Helper interno: aborta si algún id no es un caballo propio del vet en el estado esperado. Compartido por `dar_de_baja_caballos_veterinario` y `reactivar_caballos_veterinario` para no duplicar el bloque de validación (antes estaba copiado literal en ambas). **Sin EXECUTE para nadie** — solo se llama desde esas dos funciones, que corren como `postgres` (migración `20260812130000`) |
| `vet_suscripcion_activa(usuario_id)` | TRUE si el vet tiene `suscripcion_veterinario` en estado `activa` y no vencida. **Sin EXECUTE para `authenticated`** (migración `20260812120500`): es `SECURITY DEFINER` y toma el usuario por parámetro, así que expuesta al cliente dejaba a cualquier logueado averiguar si otro paga. Solo se llama desde adentro de otras `SECURITY DEFINER`, que corren como `postgres` |
| `vet_caballos_propios(usuario_id)` | Cantidad de caballos propios **activos** del vet (`vet_owner_id`, `sociedad_id IS NULL`, `activo = true`). Que cuente solo activos es lo que hace que la baja lógica alcance para regularizar el límite. **Sin EXECUTE para `authenticated`**, por lo mismo que la anterior |
| `vet_puede_agregar_caballo(usuario_id)` | TRUE si `vet_caballos_propios < vet_limite_aplicable()`. Gate al **crear** (migración `20260811150100`, reescrita en `20260812120000` y `20260813120200`) |

### Funciones de negocio (SECURITY DEFINER, llamadas desde frontend)

| Función | Descripción |
|---------|-------------|
| `crear_caballo_veterinario(...)` | Crea caballo sin `sociedad_id` + inserta en `acceso_vet` automáticamente. Toma `pg_advisory_xact_lock` por vet antes de chequear el cupo (migración `20260812130000`) — sin eso, doble clic o dos pestañas podían leer el mismo conteo antes de que cualquiera de las dos commiteara y evadir el límite. Rechaza con `RAISE EXCEPTION` si `vet_puede_agregar_caballo(auth.uid())` da falso (migración `20260811150200`) — **es el enforcement real del límite**, no una policy RLS: la función es `SECURITY DEFINER` con dueño `postgres` (`rolbypassrls = true`), así que su INSERT interno nunca pasa por RLS de `caballo`. Levanta **dos SQLSTATE distintos** porque la salida de cada tope es distinta: `HM001` cuando se llenó el plan gratuito (el front ofrece el checkout) y `HM002` cuando se llenó la membresía (el vet ya paga, no hay nada que venderle: el front lo manda a soporte) — el código de error estable es de `20260812130000`, antes el frontend matcheaba el texto del mensaje. El frontend distingue por código y no por texto — `esLimiteCaballosVet` / `esLimiteMembresiaVet` en `utils/error.ts` (migración `20260813120300`) |
| `actualizar_caballo_veterinario(p_caballo_id, ...)` | Actualiza caballo si el vet tiene acceso verificado |
| `toggle_prenada_veterinario(p_caballo_id, p_prenada, p_fecha_prenez)` | Marca/desmarca preñez; solo para Yeguas |
| `transferir_caballos_vet(p_caballo_ids, p_sociedad_destino_id)` | Asigna caballos del vet a una sociedad |
| `ejecutar_venta_caballo(p_venta_id)` | Cierra venta: mueve caballo a compradora o lo desactiva |
| `cancelar_venta_caballo(p_venta_id)` | Cancela venta pendiente y libera `en_venta_pendiente` |
| `buscar_usuario_por_email(p_email)` | Busca usuario activo; solo accesible para admin/superadmin |
| `get_veterinarios_plataforma()` | Lista todos los vets activos de la plataforma |
| `get_caballos_veterinario()` | Lista caballos accesibles por el vet autenticado (via `acceso_vet`) |
| `get_alertas_vet()` | Alertas de los próximos 30 días del vet autenticado. Excluye caballos dados de baja (`c.activo = true`, migración `20260812120300`) — antes un caballo inactivo seguía generando alertas para siempre |
| `get_consultas_recientes_vet(p_limit)` | Consultas recientes creadas por el vet autenticado |
| `get_sociedades_activas()` | Lista de todas las sociedades activas |
| `registrar_transferencia_embrionaria(...)` | Transferencia completa en una transacción: registro clínico con chip "Transferida" + `cria_transferencia` + embrión a `'transferido'`. Toma `FOR UPDATE` sobre el embrión para evitar doble transferencia. Devuelve `jsonb` con los tres ids (migración `20260724000626`) |
| `ancestros_caballo(p_caballo_id, p_gen)` | Ancestros de un caballo hasta N generaciones (incluye el propio en nivel 0). Base del cálculo de parentesco (migración `20260802120100`) |
| `es_familiar_directo(p_a, p_b, p_gen)` | TRUE si los dos comparten un ancestro dentro de `p_gen` generaciones. Con el default (2) cubre padres, abuelos, hijos, nietos, hermanos/medios hermanos y tíos |
| `get_padrillos_familiares(p_donante_id, p_padrillo_ids)` | De la lista de padrillos que muestra la UI, cuáles son familiares y con qué parentesco ('Padre', 'Abuelo', 'Hijo', 'Nieto', 'Hermano', 'Familiar'). Alimenta la etiqueta roja del selector |
| `guardar_ranking_padrillos(p_donante_id, p_padrillo_ids)` | Reemplaza el ranking completo de una donante en una transacción; la prioridad sale del orden del array. Valida tope de 10, sin repetidos, y permiso de admin de la sociedad o vet con acceso a la donante **y a cada padrillo** (migración `20260802120200`) |
| `get_caballos_pedigree_vet()` | Candidatos a padre/madre para el vet, **incluyendo los dados de baja** — `get_caballos_veterinario()` filtra `activo = true` y el pedigree es histórico (migración `20260802120300`) |
| `vet_estado_limite()` | Estado del límite del vet autenticado: `caballos_propios`, `limite` (el aplicable), `limite_gratuito`, `limite_con_membresia`, `suscripcion_activa`, `excedente`, `debe_regularizar`. Es el chequeo **retroactivo** que faltaba — `vet_puede_agregar_caballo` solo mira al crear, así que un vet que pagó un mes, cargó de más y dejó de pagar se quedaba con el excedente para siempre. El frontend la llama en `RequireAuth` y, si `debe_regularizar`, muestra el modal bloqueante. Desde `20260813120200` devuelve los dos topes por separado —para que la UI no repita los números— y `debe_regularizar` ya no exige que la suscripción esté inactiva: también se pasa un vet que paga y superó los 25 (migraciones `20260812120000` / `20260813120200`) |
| `get_caballos_propios_vet()` | Caballos propios del vet con `consultas` y `ultima_consulta`, para que pueda elegir cuáles dar de baja en el modal de regularización. A diferencia de `get_caballos_veterinario()`, **no** incluye los caballos de haras a los que tiene acceso clínico: esos no cuentan para el límite ni puede darlos de baja (migración `20260812120200`) |
| `get_caballos_propios_vet_inactivos()` | Caballos propios **dados de baja** del vet, con `fecha_baja` (aproximada por `updated_at`, no hay columna de baja en `caballo`). Alimenta la sección "Dados de baja" de `/panel-vet` (migración `20260812120400`) |
| `reactivar_caballos_veterinario(p_caballo_ids)` | Vuelve a poner `activo = true`. Aplica el **mismo gate que el alta**: solo se puede reactivar hasta llenar el cupo del límite aplicable — si no, dar de baja los 50 para pasar el modal y reactivarlos enseguida sería una evasión trivial. Desde `20260813120200` el cupo se controla también con membresía activa, porque el plan pago dejó de ser ilimitado (migraciones `20260812120400` / `20260813120200`). Toma el mismo `pg_advisory_xact_lock` por vet que `crear_caballo_veterinario` antes de calcular el cupo, y delega la validación de ownership en `_vet_valida_propios` (migración `20260812130000`) — sin el lock, reactivar en paralelo desde dos pestañas podía superar el cupo igual que el alta |
| `dar_de_baja_caballos_veterinario(p_caballo_ids)` | Baja lógica en lote (`activo = false`) de caballos propios del vet. Hace falta como `SECURITY DEFINER` porque la única policy de UPDATE sobre `caballo` es `es_admin(sociedad_id)` y los caballos de vet tienen `sociedad_id IS NULL` — el vet no puede darlos de baja con un update directo. Si algún id no es propio o ya está inactivo, **aborta la operación entera** en vez de saltearlo (delegado en `_vet_valida_propios` desde `20260812130000`). No toca `acceso_vet`, para que reactivarlos sea un solo UPDATE (migración `20260812120100`) |
| `superadmin_caballos_propios_por_vet(p_vet_ids)` | RPC en lote: cantidad de caballos propios activos por cada id de `p_vet_ids`. Restringida a `is_superadmin()` (`RAISE EXCEPTION` si no). Única fuente de verdad para el panel de superadmin — antes `superAdminService.listarVeterinarios()` reimplementaba el mismo predicado con una query directa a `caballo` desde el cliente (migración `20260812130000`) |
| `superadmin_eliminar_usuario(p_usuario_id)` | Borrado **definitivo** de un usuario y sus datos propios, en una transacción. Restringida a `is_superadmin()`; rechaza borrarse a uno mismo y borrar a otro superadmin. **El historial clínico nunca se elimina**: `historial_clinico.creado_por` es NOT NULL, así que no se puede desvincular la autoría, y el registro es del animal —le sobrevive al vet que lo escribió—; siempre bloquea, sea de quien sea el caballo. Los planes sanitarios (`trabajo_sanitario.creado_por`) y el centro de cría (`cria_registro_clinico`/`cria_ecografia`/`cria_flushing`/`cria_transferencia`/`cria_estado_transicion`/`cria_recordatorio`/`cria_padrillo_preferido`) son distintos: si el vet solo es el **autor** sobre un caballo que no es suyo, la autoría se desvincula (columna a `NULL`) y el registro queda intacto — es del caballo, no del usuario (migración `20260814130000`, esas columnas dejaron de ser NOT NULL). Solo bloquea si el registro está sobre uno de sus **propios** caballos, porque ese caballo se borra con él y ahí no hay forma segura de decidir en automático. Los demás bloqueos (membresías, pagos, propiedades, torneos, caballos de terceros que usan los suyos en el pedigree) siguen abortando la baja entera con `HM409` y el detalle de qué la frena. **No toca `auth.users`** — eso lo hace la Edge Function `eliminar-usuario` (migración `20260814120000`) |
| `guardar_asignaciones_torneo(p_torneo_id, p_jugador_id, p_caballo_ids)` | Reescribe la columna de un jugador en el kanban del torneo, en una transacción: suelta los caballos de su jugador anterior, borra la columna y reinserta con el orden del array. `p_jugador_id` NULL devuelve los caballos a "Disponibles". Valida torneo `activo`, admin de la sociedad, jugador del torneo, sin repetidos, y caballo activo + de la sociedad + con tag "Jugador" (migración `20260803120000`) |
| `completar_trabajo_sanitario(p_trabajo_id)` | Marca un `trabajo_sanitario` como realizado e inserta una fila en `historial_clinico` por cada caballo no excluido (asegura el `cat_tipo_consulta` con el nombre del trabajo). Valida `tiene_membresia`. Solo `authenticated`. Devuelve la cantidad cargada (migración `20260728181738`). Es el flujo viejo, el de la sección Sanidad |
| `cerrar_plan_sanitario(p_items jsonb)` | Cierra la grilla de un plan en una transacción: `p_items` es `[{caballo_row_id, estado}]` sobre `trabajo_sanitario_caballo`. Guarda el `estado` de cada celda (sincronizando `excluido`) y escribe `historial_clinico` **solo** para los `'realizado'` sin historial previo. Cada `trabajo_sanitario` pasa a `'realizado'` cuando ya no le quedan celdas en NULL. Permiso: `tiene_membresia` **o** `is_superadmin()` **o** `creado_por = auth.uid()` (a diferencia de la anterior, deja cerrar al vet que lo creó). Solo `authenticated`. Devuelve cuántos historiales creó (migración `20260806130000`) |
| `set_sociedad_modulo(p_sociedad_id, p_modulo_codigo, p_habilitado)` | Resuelve `codigo → modulo_id` e inserta/actualiza `sociedad_modulo`. `SECURITY INVOKER` — la RLS de `sociedad_modulo` (solo superadmin escribe) hace la autorización real (migración `20260810140000`) |
| `set_membresia_modulo(p_membresia_id, p_modulo_codigo, p_habilitado)` | Igual que la anterior pero sobre `membresia_modulo`. `SECURITY INVOKER` (migración `20260810140000`) |
| `set_usuario_modulo(p_usuario_id, p_modulo_codigo, p_habilitado)` | Igual pero sobre `usuario_modulo` (veterinarios globales). `SECURITY INVOKER` (migración `20260810140000`) |
| `get_mis_accesos_modulo()` | Devuelve `(modulo_codigo, org_habilitado, usuario_habilitado)` para todos los módulos activos, para el usuario autenticado — un solo round-trip que reemplaza dos consultas secuenciales que hacía el frontend. `SECURITY INVOKER`: la RLS de cada tabla puente ya permite al usuario leer sus propias filas, no hace falta escalar privilegios (migración `20260810140000`) |

### Triggers

| Trigger | Función | Evento |
|---------|---------|--------|
| `on_auth_user_created` | `handle_new_auth_user()` | AFTER INSERT en `auth.users` → crea fila en `usuario` |
| `bloquear_self_escalation` | `bloquear_self_escalation()` | BEFORE UPDATE en `usuario` → impide auto-escalación de rol/activo/email |
| `set_updated_at` | `trigger_set_updated_at()` | BEFORE UPDATE en tablas con `updated_at` |
| `set_updated_at_sociedad_modulo` / `set_updated_at_membresia_modulo` / `set_updated_at_usuario_modulo` | `trigger_set_updated_at()` | BEFORE UPDATE en las 3 tablas puente de módulos (migración `20260810140000`) |
| `trg_bloquear_padrillo_familiar` | `bloquear_padrillo_familiar()` | BEFORE INSERT OR UPDATE OF padrillo_id, caballo_id en `cria_registro_clinico` → rechaza si el padrillo es familiar directo (2 generaciones) de la yegua. El frontend además deshabilita la opción, pero la regla vive acá (migración `20260802120100`) |
| `trg_cancelar_pendientes_baja` | `cancelar_pendientes_por_baja()` | AFTER UPDATE OF activo en `caballo` (cuando `activo` → false) → cancela `cria_recordatorio` pendientes/vencidos y excluye al caballo de `trabajo_sanitario` pendientes. Conserva el historial (migración `20260729144522`) |
| `trg_validar_campo_caballo` | `validar_campo_caballo()` | BEFORE INSERT OR UPDATE OF campo_id, sociedad_id, vet_owner_id en `caballo` → un caballo solo puede estar en un campo de su mismo dueño (sociedad con sociedad, vet con vet). Si el caballo **cambia de dueño** (transferencia entre sociedades, o de vet a organización) el `campo_id` se pone en NULL en vez de abortar; asignar a mano un campo ajeno sí es error (migración `caballo_campo_mismo_duenio` + `caballo_campo_limpiar_al_cambiar_duenio`) |

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
- UPDATE propio: `id = auth.uid()` — bloqueado por trigger para rol/activo/email
- UPDATE superadmin: `is_superadmin()`

**`membresia`**
- SELECT: propia (`usuario_id = auth.uid()`) o admin de esa sociedad o superadmin
- INSERT/UPDATE: `es_admin(sociedad_id)`
- DELETE: `is_superadmin()`

**`campo`**
- SELECT: `tiene_membresia(sociedad_id)` o superadmin
- SELECT vet: vet activo, solo sobre campos de sociedad (`vet_owner_id IS NULL`)
- SELECT vet propio: `vet_owner_id = auth.uid()` — un vet no ve los campos de otro vet
- INSERT/UPDATE: `puede_gestionar_campo(sociedad_id)`
- INSERT vet: `vet_owner_id = auth.uid() AND sociedad_id IS NULL` y rol veterinario activo
- UPDATE/DELETE vet: `vet_owner_id = auth.uid()`
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
- INSERT vet: `vet_owner_id = auth.uid() AND sociedad_id IS NULL AND vet_puede_agregar_caballo(auth.uid())` (vet crea sin sociedad, con gate del límite freemium — defensa en profundidad: el enforcement real vive en `crear_caballo_veterinario`, ver más abajo; migración `20260811150200`)
- UPDATE admin: `es_admin(sociedad_id)` — **es la única policy de UPDATE de la tabla**
- UPDATE vet: no existe como policy. Un caballo propio del vet tiene `sociedad_id NULL`,
  con lo que `es_admin(NULL)` es false y **todo UPDATE directo del vet no afecta ninguna
  fila y no da error** (la RLS filtra en silencio). El vet escribe siempre por RPC
  `SECURITY DEFINER`: `actualizar_caballo_veterinario`, `toggle_prenada_veterinario`,
  `dar_de_baja_caballos_veterinario`, `reactivar_caballos_veterinario`.
  Verificado contra producción el 2026-08-14; antes este documento afirmaba que existía
  una policy `vet_tiene_acceso(id)` para UPDATE, que no está en la base.

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

**`cat_trabajo_sanitario`**
- SELECT: `sociedad_id IS NULL` (globales) o `tiene_membresia(sociedad_id)` o `is_superadmin()`
- INSERT/UPDATE/DELETE: `es_admin(sociedad_id)` para los propios; globales solo `is_superadmin()`

**`trabajo_sanitario`** (migración `20260729150553` sumó acceso de veterinarios)
- SELECT/UPDATE: `tiene_membresia(sociedad_id)` o `is_superadmin()` o `creado_por = auth.uid()`
- INSERT: `creado_por = auth.uid()` **y** (`tiene_membresia(sociedad_id)` o el vet tiene un `acceso_vet` activo sobre algún caballo de esa sociedad)
- DELETE: `es_admin(sociedad_id)` o `is_superadmin()`

**`trabajo_sanitario_caballo`**
- ALL: `vet_tiene_acceso(caballo_id)` o (vía `trabajo_sanitario` padre) `tiene_membresia(t.sociedad_id)` / `is_superadmin()` / `t.creado_por = auth.uid()`

**`cria_registro_clinico` / `cria_recordatorio` / `cria_flushing` / `cria_transferencia`**
- SELECT: `tiene_membresia(sociedad_id)` o `vet_tiene_acceso(caballo_id)`
- INSERT: `vet_tiene_acceso(caballo_id)` (solo vets activos)
- UPDATE: `veterinario_id = auth.uid()` o `es_admin(sociedad_id)` (en recordatorio)

**`embrion`**
- SELECT: `tiene_membresia(sociedad_id)` o `vet_tiene_acceso(caballo_donante_id)` o `is_superadmin()` (migración `20260723231443`)
- INSERT: `vet_tiene_acceso(caballo_donante_id)`
- UPDATE: `vet_tiene_acceso(caballo_donante_id)` o `es_admin(sociedad_id)` o `is_superadmin()`

**`cria_ecografia`**
- SELECT: `tiene_membresia(sociedad_id)` o `vet_tiene_acceso(caballo_receptora_id)` o `is_superadmin()`
- INSERT: `vet_tiene_acceso(caballo_receptora_id)`
- UPDATE: `veterinario_id = auth.uid()` o `es_admin(sociedad_id)` o `is_superadmin()`

**`cat_tag`** (migración `20260802120000`)
- SELECT: cualquier autenticado
- INSERT/UPDATE/DELETE: solo `is_superadmin()`

**`caballo_tag`**
- SELECT: `tiene_membresia` (vía `caballo.sociedad_id`) o `vet_tiene_acceso(caballo_id)` o `is_superadmin()`
- INSERT/UPDATE/DELETE: `es_admin` (vía `caballo.sociedad_id`) o `vet_tiene_acceso(caballo_id)` o `is_superadmin()`

**`cat_modulo`** (migración `20260810140000`)
- SELECT: cualquier autenticado
- INSERT/UPDATE/DELETE: solo `is_superadmin()`

**`sociedad_modulo`**
- SELECT: `tiene_membresia(sociedad_id)` o `is_superadmin()`
- INSERT/UPDATE/DELETE: solo `is_superadmin()` (no hereda el `es_admin(id)` que sí tiene `sociedad_update`)

**`membresia_modulo`**
- SELECT: propia (vía `membresia.usuario_id = auth.uid()`) o `es_admin` (vía `membresia.sociedad_id`) o `is_superadmin()`
- INSERT/UPDATE/DELETE: `es_admin` (vía `membresia.sociedad_id`) o `is_superadmin()`

**`usuario_modulo`**
- SELECT: propia (`usuario_id = auth.uid()`) o `is_superadmin()`
- INSERT/UPDATE/DELETE: solo `is_superadmin()`

**`cria_padrillo_preferido`** (migración `20260802120200`)
- SELECT: `tiene_membresia(sociedad_id)` o `vet_tiene_acceso(donante_id)` o `is_superadmin()`
- INSERT/UPDATE/DELETE: `es_admin(sociedad_id)` o `vet_tiene_acceso(donante_id)` o `is_superadmin()` — en la práctica se escribe siempre vía `guardar_ranking_padrillos()`

**`torneo` / `torneo_jugador` / `torneo_asignacion`** (migración `20260803120000`)
- SELECT: `tiene_membresia(sociedad_id)` o `is_superadmin()` — el jugador y el piloto ven la conformación de equipos
- INSERT/UPDATE/DELETE: `es_admin(sociedad_id)` o `is_superadmin()`
- En las tablas hijas la sociedad se resuelve con un `EXISTS` contra el `torneo` padre
- Las asignaciones se escriben en la práctica vía `guardar_asignaciones_torneo()`

**`cria_parametro`**
- SELECT: `sociedad_id IS NULL` (globales, visibles para todos) o `tiene_membresia(sociedad_id)` o `is_superadmin()`
- INSERT/UPDATE: `sociedad_id IS NULL AND is_superadmin()` o `es_admin(sociedad_id)`

**`cria_estado_transicion`**
- SELECT: `tiene_membresia(sociedad_id)` o `is_superadmin()`
- INSERT: `vet_tiene_acceso(caballo_id)` o `es_admin(sociedad_id)` o `is_superadmin()`
- Sin UPDATE/DELETE (tabla append-only)

**`cat_chip_obs`** (migración `20260730120000` — pasó de por-sociedad a por-veterinario)
- SELECT: `veterinario_id = auth.uid()` o `is_superadmin()`
- INSERT/UPDATE/DELETE: `veterinario_id = auth.uid()` (cada vet solo su propia lista)

**`cria_plazo_vet`**
- SELECT: `veterinario_id = auth.uid()` o `is_superadmin()`
- INSERT/UPDATE: `veterinario_id = auth.uid()`
- Sin DELETE

**`venta_caballo`**
- SELECT: miembro de sociedad vendedora o compradora
- INSERT: admin de sociedad vendedora

**`alerta`**
- SELECT/INSERT/UPDATE/DELETE con sociedad: miembro activo de esa sociedad
- SELECT/INSERT/UPDATE/DELETE sin sociedad: `creado_por = auth.uid()` (alerta personal del vet)

**`alerta_caballo`**
- Hereda acceso de la alerta asociada

**`suscripcion_veterinario`**
- SELECT: `usuario_id = auth.uid()` o `is_superadmin()`
- INSERT/UPDATE: solo `is_superadmin()` (activación/desactivación manual, Fase 1). La fila inicial `inactiva` la crea el trigger `handle_new_auth_user` con `SECURITY DEFINER`, que bypasea RLS
- Sin DELETE

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
│   │   └── utils/                      # Helpers
│   └── .env.example
└── supabase/
    └── migrations/                     # Historial documental de cambios a la DB
        └── *.sql
```

---

## Migraciones

Las migraciones **se aplican directamente con el MCP server de Supabase** (`apply_migration`).
No se usa `supabase db push` ni `supabase migration up`.

**Flujo para aplicar una migración:**
1. Crear el archivo `.sql` en `supabase/migrations/` con formato `YYYYMMDDNNNNN_descripcion.sql`
2. Aplicar con el MCP: `mcp__supabase__apply_migration` con el contenido del archivo
3. Hacer commit del archivo en la rama correspondiente
4. Actualizar este SKILL.md en el mismo PR

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
| Gestionar campos/potreros de la sociedad | ✅ | ✅ | ❌ (solo lectura) | ✅ |
| Gestionar sus propios campos (`/config-vet/campos`) | — | — | ✅ | ❌ |
| Crear torneos y asignar caballos | ✅ | ✅ | ❌ | ❌ (solo lectura) |
| Acceso centro de embriones | — | Según `sociedad_modulo`+`membresia_modulo` ('centro_cria') | Según `usuario_modulo` ('centro_cria') | ❌ |
| Acceso Polo / Torneos | — | Según `sociedad_modulo`+`membresia_modulo` ('polo') | ❌ | ✅ jugador/piloto según módulo; peticero ❌ (roles fijos, no depende del módulo) |

---

## Datos de prueba

No hay mock system: el frontend siempre habla con Supabase. Para probar se usan
sociedades reales de demo en el proyecto de producción (`Demo 1` y `Demo 2`),
con usuarios reales invitados a cada una.

---

## Funcionalidades Futuras (no implementar aún)

- Silueta interactiva del caballo para marcar lesiones (frontend SVG)
- Adjuntos multimedia por registro clínico (MongoDB Atlas o Supabase Storage)
- App móvil / PWA
- Expansión multi-país
