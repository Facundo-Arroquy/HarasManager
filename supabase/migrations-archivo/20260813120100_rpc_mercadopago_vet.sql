-- Funciones que consume la integración con MercadoPago. Las llaman las Edge
-- Functions `crear-suscripcion-vet` y `mercadopago-webhook` con service_role;
-- ninguna es invocable desde el cliente.
--
-- Son SECURITY INVOKER a propósito: quien las llama ya bypasea RLS por ser
-- service_role, así que no hace falta elevar privilegios, y así un GRANT mal
-- puesto no las vuelve explotables desde el frontend.

-- ─────────────────────────────────────────────────────────────────────────────
-- Cancelar no debería cortar el acceso en el acto
-- ─────────────────────────────────────────────────────────────────────────────
-- Hasta ahora `vet_suscripcion_activa()` exigía estado = 'activa'. Con pagos
-- reales eso significaría que un vet que cancela el día 2 pierde el mes que ya
-- pagó y se come el modal bloqueante de inmediato. Se contempla el caso de
-- cancelada con vencimiento futuro — y solo ese: una cancelación de Fase 1
-- (hecha a mano por el superadmin, sin `fecha_vencimiento`) sigue cortando ya,
-- que es lo que se espera de una baja administrativa.
CREATE OR REPLACE FUNCTION vet_suscripcion_activa(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM suscripcion_veterinario
     WHERE usuario_id = p_usuario_id
       AND (
         (estado = 'activa'
           AND (fecha_vencimiento IS NULL OR fecha_vencimiento > NOW()))
         OR
         -- Canceló pero le queda período pago: conserva el acceso hasta que
         -- venza. Sin vencimiento no aplica (ver arriba).
         (estado = 'cancelada'
           AND fecha_vencimiento IS NOT NULL
           AND fecha_vencimiento > NOW())
       )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Alta del preapproval
-- ─────────────────────────────────────────────────────────────────────────────
-- La llama `crear-suscripcion-vet` justo después de crear el preapproval en
-- MercadoPago. Guardar el id antes de mandar al vet al checkout es lo que
-- permite que el webhook después encuentre a quién corresponde el evento.
CREATE OR REPLACE FUNCTION mp_registrar_preapproval(
  p_usuario_id     UUID,
  p_preapproval_id TEXT,
  p_plan_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- La fila ya existe: la crea el trigger de alta del vet con estado
  -- 'inactiva'. Si por algún motivo no está, se crea acá para no perder el
  -- preapproval que ya quedó abierto del lado de MercadoPago.
  INSERT INTO suscripcion_veterinario (
    usuario_id, estado, proveedor_pago, external_subscription_id, plan_id
  )
  VALUES (
    p_usuario_id, 'pendiente', 'mercadopago', p_preapproval_id, p_plan_id
  )
  ON CONFLICT (usuario_id) DO UPDATE SET
    -- Solo baja a 'pendiente' si no había una membresía vigente: un vet que
    -- abre el checkout de nuevo teniendo la suscripción activa no debe perder
    -- el acceso por eso.
    estado = CASE
      WHEN suscripcion_veterinario.estado = 'activa' THEN suscripcion_veterinario.estado
      ELSE 'pendiente'
    END,
    proveedor_pago           = 'mercadopago',
    external_subscription_id = p_preapproval_id,
    plan_id                  = p_plan_id,
    fecha_cancelacion        = NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sincronización del estado con MercadoPago
-- ─────────────────────────────────────────────────────────────────────────────
-- La llama el webhook con el estado que devolvió GET /preapproval/{id} — nunca
-- con lo que venía en el body de la notificación, que no es confiable.
--
-- `p_next_payment_date` es la fecha del próximo débito. Se le suman 3 días de
-- gracia para el vencimiento: si se usara la fecha pelada, entre el momento en
-- que vence y el momento en que llega el webhook del cobro nuevo habría una
-- ventana en la que el vet aparece sin membresía y se come el modal bloqueante
-- estando al día.
CREATE OR REPLACE FUNCTION mp_sincronizar_suscripcion(
  p_preapproval_id    TEXT,
  p_status            TEXT,
  p_next_payment_date TIMESTAMPTZ,
  p_payload           JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estado TEXT;
BEGIN
  v_estado := CASE p_status
    WHEN 'pending'    THEN 'pendiente'
    WHEN 'authorized' THEN 'activa'
    WHEN 'paused'     THEN 'inactiva'
    -- MercadoPago escribe el cancelado con una y con dos eles según el
    -- endpoint; se aceptan los dos en vez de apostar a uno.
    WHEN 'cancelled'  THEN 'cancelada'
    WHEN 'canceled'   THEN 'cancelada'
    ELSE NULL
  END;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Estado de MercadoPago desconocido: %', p_status;
  END IF;

  UPDATE suscripcion_veterinario SET
    estado = v_estado,
    fecha_activacion = CASE
      WHEN v_estado = 'activa' THEN COALESCE(fecha_activacion, NOW())
      ELSE fecha_activacion
    END,
    fecha_vencimiento = CASE
      WHEN v_estado = 'activa'
        THEN COALESCE(p_next_payment_date + INTERVAL '3 days', NOW() + INTERVAL '1 month')
      -- Al cancelar o pausar se conserva el vencimiento que ya tenía: es lo
      -- que le deja al vet el período que pagó (ver vet_suscripcion_activa).
      ELSE fecha_vencimiento
    END,
    fecha_cancelacion = CASE
      WHEN v_estado = 'cancelada' THEN COALESCE(fecha_cancelacion, NOW())
      ELSE NULL
    END,
    proveedor_pago = 'mercadopago',
    notas = COALESCE(p_payload ->> 'reason', notas)
  WHERE external_subscription_id = p_preapproval_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay suscripción con preapproval %', p_preapproval_id;
  END IF;

  RETURN v_estado;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Registro de un cobro
-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotente por (proveedor, external_payment_id): MercadoPago reintenta las
-- notificaciones hasta recibir un 200, así que la misma llega varias veces.
CREATE OR REPLACE FUNCTION mp_registrar_pago(
  p_preapproval_id TEXT,
  p_payment_id     TEXT,
  p_estado         TEXT,
  p_monto          NUMERIC,
  p_moneda         TEXT,
  p_fecha          TIMESTAMPTZ,
  p_payload        JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_suscripcion suscripcion_veterinario%ROWTYPE;
BEGIN
  SELECT * INTO v_suscripcion
    FROM suscripcion_veterinario
   WHERE external_subscription_id = p_preapproval_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay suscripción con preapproval %', p_preapproval_id;
  END IF;

  INSERT INTO pago_veterinario (
    usuario_id, suscripcion_id, proveedor, external_payment_id,
    external_preapproval_id, estado, monto, moneda, fecha_pago, payload
  )
  VALUES (
    v_suscripcion.usuario_id, v_suscripcion.id, 'mercadopago', p_payment_id,
    p_preapproval_id, p_estado, p_monto, p_moneda, p_fecha, p_payload
  )
  ON CONFLICT (proveedor, external_payment_id) DO UPDATE SET
    -- Un pago puede cambiar de estado (pending → approved / rejected) y cada
    -- cambio dispara su propia notificación.
    estado     = EXCLUDED.estado,
    monto      = EXCLUDED.monto,
    moneda     = EXCLUDED.moneda,
    fecha_pago = EXCLUDED.fecha_pago,
    payload    = EXCLUDED.payload;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos
-- ─────────────────────────────────────────────────────────────────────────────
-- Mismo criterio que la migración 20260812120500: cerrar todo y abrir solo lo
-- que corresponde. Estas tres son del webhook y del checkout, no del cliente:
-- si `authenticated` pudiera llamarlas, cualquier vet se activaría la membresía
-- solo pasando el id de preapproval.
REVOKE ALL ON FUNCTION mp_registrar_preapproval(UUID, TEXT, UUID)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mp_sincronizar_suscripcion(TEXT, TEXT, TIMESTAMPTZ, JSONB)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mp_registrar_pago(TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION mp_registrar_preapproval(UUID, TEXT, UUID)                  TO service_role;
GRANT EXECUTE ON FUNCTION mp_sincronizar_suscripcion(TEXT, TEXT, TIMESTAMPTZ, JSONB)  TO service_role;
GRANT EXECUTE ON FUNCTION mp_registrar_pago(TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, JSONB) TO service_role;
