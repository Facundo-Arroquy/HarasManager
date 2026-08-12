# MercadoPago — registro de acciones en la base y cómo volver atrás

Este documento existe por una razón concreta: las migraciones del proyecto se
aplican con el MCP de Supabase **directo contra producción**, así que conviene
tener escrito de antemano cómo deshacer cada cosa.

---

## 1. Registro de acciones sobre la base

### Estado actual: **las dos migraciones están aplicadas** (2026-08-12)

Se aplicaron con el MCP de Supabase (`apply_migration`), con los nombres
`plan_y_pagos_vet_mercadopago` y `rpc_mercadopago_vet`, tras el visto bueno
explícito. Antes de eso la base no había sido modificada.

Verificación posterior a la aplicación:

| Objeto | Resultado |
|---|---|
| Tablas | `plan_suscripcion_vet`, `pago_veterinario` creadas |
| Funciones | `mp_registrar_preapproval`, `mp_sincronizar_suscripcion`, `mp_registrar_pago` creadas |
| Columnas | `plan_id`, `fecha_cancelacion` agregadas a `suscripcion_veterinario` |
| CHECK de estado | `('activa','inactiva','pendiente','cancelada')` |
| Plan cargado | `Membresía veterinario — mensual` · 1000.00 ARS · cada 1 `months` |

### Cronología completa

| # | Qué se ejecutó | Tipo | ¿Persistió? |
|---|---|---|---|
| 1 | `SELECT` sobre `information_schema.columns` (`suscripcion_veterinario`, `usuario`) | lectura | — |
| 2 | `SELECT` sobre `pg_proc` / `pg_constraint` (definiciones de funciones y constraints) | lectura | — |
| 3 | `SELECT` de conteos por estado en `suscripcion_veterinario` | lectura | — |
| 4 | DDL completo de las dos migraciones, dentro de `BEGIN … ROLLBACK` | prueba | **no — revertido** |
| 5 | Pruebas funcionales de las RPC sobre dos vets reales, dentro de `BEGIN … ROLLBACK` | prueba | **no — revertido** |
| 6 | Prueba del índice único parcial sobre una tabla `TEMP`, dentro de `BEGIN … ROLLBACK` | prueba | **no** |
| 7 | `apply_migration` de `plan_y_pagos_vet_mercadopago` | **DDL** | **sí** |
| 8 | `apply_migration` de `rpc_mercadopago_vet` | **DDL** | **sí** |
| 9 | `SELECT` de verificación post-aplicación | lectura | — |
| 10 | `UPDATE auth.users SET email_confirmed_at = now()` para el vet de prueba `test_user_3055276528951504274@testuser.com` | **dato** | **sí** |
| 11 | `UPDATE plan_suscripcion_vet SET precio = 100` y limpieza del preapproval de prueba que había quedado en la fila del vet `@testuser.com` | **dato** | **sí** |
| 12 | `mp_sincronizar_suscripcion()` a mano para el vet `facarroquy@gmail.com`, con el estado real leído de la API de MercadoPago (el webhook todavía no llegaba) | **dato** | **sí** |
| 13 | `apply_migration` de `tope_pago_vet` — la membresía deja de ser ilimitada y pasa a 25 caballos | **DDL** | **sí** |
| 14 | `apply_migration` de `soporte_al_tope_de_membresia` — el alta levanta `HM002` en vez de `HM001` cuando el tope alcanzado es el de la membresía | **DDL** | **sí** |

El punto 10 no tiene nada que ver con las migraciones: es un usuario de prueba
creado a mano para el QA, cuyo email `@testuser.com` no puede recibir el mail de
confirmación. Si se quiere limpiar después de las pruebas, se borra el usuario
entero desde Authentication → Users en el dashboard de Supabase (borra también
su fila en `usuario` y en `suscripcion_veterinario` por cascada de la app, no de
la base — conviene verificar).

Los puntos 4 y 5 tocaron filas reales de `suscripcion_veterinario` (los vets
`bd19f32c…` y `736ef791…`) **dentro de una transacción que terminó en
`ROLLBACK`**: no quedó rastro de esas pruebas. Comprobable con

```sql
select count(*) from suscripcion_veterinario
 where external_subscription_id in ('PRE-TEST-1', 'PRE-TEST-2');  -- debe dar 0
```

A partir del punto 7, **para volver atrás hay que correr el rollback de la
sección 3**.

### Resultado de las pruebas (para no tener que repetirlas)

| Paso | Resultado |
|---|---|
| El vet abre el checkout | `estado = pendiente`, `vet_suscripcion_activa = false` |
| Llega el webhook `authorized` | `estado = activa`, acceso `true`, vence 2026-09-15 (1 mes + 3 días de gracia) |
| El mismo webhook de pago llega dos veces | 1 sola fila en `pago_veterinario` |
| Llega el webhook `cancelled` | `estado = cancelada`, **el acceso se conserva** hasta el vencimiento |
| Un vet ya activo reabre el checkout | sigue `activa`, no pierde el acceso |
| Se intenta un segundo plan `activo = true` | rechazado por el índice único parcial |

---

## 2. Qué cambia cuando se apliquen las migraciones

`20260813120000_plan_y_pagos_vet_mercadopago.sql`

- **Crea** la tabla `plan_suscripcion_vet` (+ índice único parcial, trigger de
  `updated_at`, RLS y 3 policies) e **inserta** una fila `mensual` con precio
  placeholder `1000.00`.
- **Agrega** a `suscripcion_veterinario` las columnas `plan_id` y
  `fecha_cancelacion`.
- **Reemplaza** el CHECK `suscripcion_veterinario_estado_check` para admitir
  `'pendiente'`.
- **Crea** el índice `suscripcion_veterinario_external_subscription_id_idx`.
- **Crea** la tabla `pago_veterinario` (+ 2 índices, RLS y 1 policy).

`20260813120100_rpc_mercadopago_vet.sql`

- **Reemplaza** la función existente `vet_suscripcion_activa(uuid)`.
- **Crea** `mp_registrar_preapproval`, `mp_sincronizar_suscripcion` y
  `mp_registrar_pago`, con sus REVOKE/GRANT.

Ninguna migración borra datos ni modifica filas existentes.

---

## 2 bis. Volver atrás solo el tope de 25

Si lo único que se quiere deshacer es el límite de la membresía —volver a que
pagar signifique caballos ilimitados— sin tocar el resto de la integración,
alcanza con esto:

```sql
BEGIN;

-- La membresía vuelve a no tener tope.
CREATE OR REPLACE FUNCTION vet_puede_agregar_caballo(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT vet_caballos_propios(p_usuario_id) < vet_limite_gratuito()
      OR vet_suscripcion_activa(p_usuario_id);
$$;

-- Y el estado vuelve a mirar solo el plan gratuito.
DROP FUNCTION IF EXISTS vet_estado_limite();
CREATE FUNCTION vet_estado_limite()
RETURNS TABLE(caballos_propios INTEGER, limite INTEGER, suscripcion_activa BOOLEAN,
              excedente INTEGER, debe_regularizar BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.propios, d.limite, d.susc,
         GREATEST(d.propios - d.limite, 0),
         d.propios > d.limite AND NOT d.susc
  FROM (SELECT vet_caballos_propios(auth.uid()) AS propios,
               vet_limite_gratuito() AS limite,
               vet_suscripcion_activa(auth.uid()) AS susc) d;
$$;
REVOKE ALL ON FUNCTION vet_estado_limite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vet_estado_limite() TO authenticated, service_role;

COMMIT;
```

**El frontend hay que revertirlo también**: `EstadoLimiteVet` perdería dos
campos y varios componentes los leen. En la práctica conviene revertir el commit
entero en vez de correr solo este SQL.

Las funciones `vet_limite_pago()` y `vet_limite_aplicable()` pueden quedar sin
uso; borrarlas es opcional.

## 3. Cómo volver atrás

> ⚠️ **Lo único que se pierde es el historial de pagos.** `DROP TABLE
> pago_veterinario` borra el registro de todos los cobros que hayan llegado por
> webhook. Si ya hubo pagos reales, exportá la tabla antes:
>
> ```sql
> create table pago_veterinario_backup as select * from pago_veterinario;
> ```
>
> El resto es reversible sin pérdida: las suscripciones en `'pendiente'` pasan a
> `'inactiva'`, que es el estado que habrían tenido sin esta feature.

Ejecutar el bloque completo con el MCP de Supabase (`apply_migration`), en este
orden — está pensado para correr entero de una:

```sql
-- ─── ROLLBACK de la integración con MercadoPago ───
-- Revierte 20260813120000 y 20260813120100 y deja la base como quedó
-- después de 20260812120600.
BEGIN;

-- 1. El estado 'pendiente' deja de existir: las suscripciones que quedaron a
--    mitad de checkout vuelven a 'inactiva', que es lo que eran antes.
UPDATE suscripcion_veterinario SET estado = 'inactiva' WHERE estado = 'pendiente';

-- 2. Restaurar el CHECK original de estado.
ALTER TABLE suscripcion_veterinario DROP CONSTRAINT suscripcion_veterinario_estado_check;
ALTER TABLE suscripcion_veterinario
  ADD CONSTRAINT suscripcion_veterinario_estado_check
  CHECK (estado = ANY (ARRAY['activa'::text, 'inactiva'::text, 'cancelada'::text]));

-- 3. Quitar las columnas nuevas (plan_id tiene la FK a plan_suscripcion_vet:
--    hay que sacarla antes de poder dropear esa tabla).
ALTER TABLE suscripcion_veterinario
  DROP COLUMN IF EXISTS plan_id,
  DROP COLUMN IF EXISTS fecha_cancelacion;

DROP INDEX IF EXISTS suscripcion_veterinario_external_subscription_id_idx;

-- 4. Tablas nuevas. OJO: acá se pierde el historial de pagos (ver aviso arriba).
DROP TABLE IF EXISTS pago_veterinario;
DROP TABLE IF EXISTS plan_suscripcion_vet;

-- 5. Funciones nuevas.
DROP FUNCTION IF EXISTS mp_registrar_preapproval(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS mp_sincronizar_suscripcion(TEXT, TEXT, TIMESTAMPTZ, JSONB);
DROP FUNCTION IF EXISTS mp_registrar_pago(TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, JSONB);

-- 6. Restaurar vet_suscripcion_activa() tal como estaba en 20260812120000.
--    Sin este paso el gate del freemium queda apuntando a una lógica que ya no
--    corresponde (contemplaba 'cancelada' con vencimiento futuro, un caso que
--    solo existe con cobros de MercadoPago).
CREATE OR REPLACE FUNCTION vet_suscripcion_activa(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM suscripcion_veterinario
     WHERE usuario_id = p_usuario_id
       AND estado = 'activa'
       AND (fecha_vencimiento IS NULL OR fecha_vencimiento > NOW())
  );
$$;

COMMIT;
```

### Verificar que el rollback quedó bien

```sql
-- 0 filas: las tablas nuevas ya no existen
select table_name from information_schema.tables
 where table_name in ('plan_suscripcion_vet', 'pago_veterinario');

-- 0 filas: las funciones nuevas ya no existen
select proname from pg_proc
 where proname in ('mp_registrar_preapproval', 'mp_sincronizar_suscripcion', 'mp_registrar_pago');

-- El CHECK vuelve a listar solo los 3 estados originales
select pg_get_constraintdef(oid) from pg_constraint
 where conname = 'suscripcion_veterinario_estado_check';

-- 0 filas: no quedó ninguna suscripción en 'pendiente'
select count(*) from suscripcion_veterinario where estado = 'pendiente';
```

### Del lado de la aplicación

El rollback de la base **sola no alcanza**: el frontend y las Edge Functions
siguen llamando a lo que se borró.

1. Revertir el merge de esta rama (o `git revert` del commit).
2. Borrar las dos Edge Functions:

```bash
supabase functions delete crear-suscripcion-vet --project-ref cbllmyboxyoumnhakvyj
supabase functions delete mercadopago-webhook --project-ref cbllmyboxyoumnhakvyj
```

3. En el panel de MercadoPago, **desactivar el webhook** — si queda apuntando a
   una función borrada, MercadoPago va a acumular reintentos fallidos y puede
   terminar dando de baja la notificación por su cuenta.
4. Los secrets (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `APP_URL`) pueden quedar
   cargados sin efecto, pero conviene borrarlos si el rollback es definitivo.

### Si hay suscripciones cobrando de verdad

Volver atrás **no cancela los cobros**: MercadoPago sigue debitando todos los
meses aunque la app ya no exista. Antes de revertir, cancelá las suscripciones
vivas — desde el panel de MercadoPago, o por API:

```bash
curl -X PUT "https://api.mercadopago.com/preapproval/<PREAPPROVAL_ID>" \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}'
```

Los ids están en `suscripcion_veterinario.external_subscription_id`. Sacá la
lista **antes** de correr el rollback:

```sql
select u.email, s.external_subscription_id, s.estado, s.fecha_vencimiento
  from suscripcion_veterinario s join usuario u on u.id = s.usuario_id
 where s.external_subscription_id is not null;
```
