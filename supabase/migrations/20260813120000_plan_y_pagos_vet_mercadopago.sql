-- Fase 2 del freemium de veterinarios: modelo de datos para cobrar la membresía
-- con MercadoPago (suscripciones recurrentes / preapproval).
--
-- La Fase 1 (migración 20260811150000) dejó `suscripcion_veterinario` con
-- `proveedor_pago` y `external_subscription_id` justamente para no tener que
-- migrar de nuevo acá. Lo que falta es: de cuánto es el plan, el rastro de los
-- pagos, y un estado intermedio para la suscripción que ya se creó en MP pero
-- que el vet todavía no autorizó.

-- ─────────────────────────────────────────────────────────────────────────────
-- Plan: cuánto sale la membresía
-- ─────────────────────────────────────────────────────────────────────────────
-- El precio vive en la base y no en el código para que cambiarlo no requiera un
-- deploy. Es una tabla y no una fila de config porque MercadoPago cobra por
-- `auto_recurring` (monto + moneda + frecuencia) y esos tres datos viajan
-- juntos; además deja lugar a un plan anual sin otra migración.
CREATE TABLE plan_suscripcion_vet (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          TEXT NOT NULL UNIQUE,          -- 'mensual'
  nombre          TEXT NOT NULL,                 -- lo ve el vet en el checkout
  precio          NUMERIC(12,2) NOT NULL CHECK (precio > 0),
  moneda          TEXT NOT NULL DEFAULT 'ARS',   -- currency_id de MercadoPago
  frecuencia      INTEGER NOT NULL DEFAULT 1 CHECK (frecuencia > 0),
  frecuencia_tipo TEXT NOT NULL DEFAULT 'months' CHECK (frecuencia_tipo IN ('days', 'months')),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un solo plan vigente por vez: el checkout toma el activo sin desempate.
CREATE UNIQUE INDEX plan_suscripcion_vet_unico_activo
  ON plan_suscripcion_vet ((TRUE)) WHERE activo;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON plan_suscripcion_vet
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Precio placeholder: lo define el superadmin antes de habilitar el checkout.
-- No se hardcodea en ningún lado del código, se lee siempre de acá.
INSERT INTO plan_suscripcion_vet (codigo, nombre, precio, moneda)
VALUES ('mensual', 'Membresía veterinario — mensual', 1000.00, 'ARS');

ALTER TABLE plan_suscripcion_vet ENABLE ROW LEVEL SECURITY;

-- Cualquier logueado puede leer el precio: se muestra en el modal del límite.
CREATE POLICY plan_suscripcion_vet_select ON plan_suscripcion_vet
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY plan_suscripcion_vet_insert ON plan_suscripcion_vet
  FOR INSERT TO authenticated
  WITH CHECK (is_superadmin());

CREATE POLICY plan_suscripcion_vet_update ON plan_suscripcion_vet
  FOR UPDATE TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Suscripción: estado intermedio y trazabilidad del plan
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE suscripcion_veterinario
  ADD COLUMN plan_id           UUID REFERENCES plan_suscripcion_vet(id),
  ADD COLUMN fecha_cancelacion TIMESTAMPTZ;

-- 'pendiente' = el preapproval existe en MercadoPago pero el vet todavía no
-- cargó medio de pago. No habilita nada: `vet_suscripcion_activa()` sigue
-- exigiendo 'activa', así que un vet que abandona el checkout queda igual que
-- antes de empezarlo.
ALTER TABLE suscripcion_veterinario
  DROP CONSTRAINT suscripcion_veterinario_estado_check;

ALTER TABLE suscripcion_veterinario
  ADD CONSTRAINT suscripcion_veterinario_estado_check
  CHECK (estado IN ('activa', 'inactiva', 'pendiente', 'cancelada'));

-- Buscar por id de preapproval es lo que hace el webhook en cada notificación.
CREATE INDEX suscripcion_veterinario_external_subscription_id_idx
  ON suscripcion_veterinario(external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pagos: qué cobró MercadoPago y cuándo
-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla de auditoría, no de estado: el estado de la membresía sigue siendo el
-- de `suscripcion_veterinario`. Sirve para responder "¿por qué este vet quedó
-- sin acceso?" sin entrar al panel de MercadoPago, y para que el webhook sea
-- idempotente (MercadoPago reintenta las notificaciones).
CREATE TABLE pago_veterinario (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id              UUID NOT NULL REFERENCES usuario(id),
  suscripcion_id          UUID REFERENCES suscripcion_veterinario(id),
  proveedor               TEXT NOT NULL DEFAULT 'mercadopago',
  external_payment_id     TEXT NOT NULL,   -- id del authorized_payment / payment
  external_preapproval_id TEXT,
  estado                  TEXT NOT NULL,   -- estado crudo de MercadoPago (approved, rejected, …)
  monto                   NUMERIC(12,2),
  moneda                  TEXT,
  fecha_pago              TIMESTAMPTZ,
  -- Respuesta cruda del recurso consultado a la API. Se guarda entera a
  -- propósito: cuando un cobro falla, el motivo está en campos que hoy no
  -- modelamos y que no vale la pena adivinar por adelantado.
  payload                 JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotencia del webhook: la misma notificación reintentada no duplica filas.
CREATE UNIQUE INDEX pago_veterinario_externo_key
  ON pago_veterinario(proveedor, external_payment_id);

CREATE INDEX pago_veterinario_usuario_idx ON pago_veterinario(usuario_id, fecha_pago DESC);

ALTER TABLE pago_veterinario ENABLE ROW LEVEL SECURITY;

-- El vet ve sus propios pagos; el superadmin, todos. Escribir es exclusivo del
-- webhook, que corre con service_role y no pasa por RLS: por eso no hay
-- policies de INSERT ni UPDATE — nadie más puede tocar el historial de pagos.
CREATE POLICY pago_veterinario_select ON pago_veterinario
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR is_superadmin());
