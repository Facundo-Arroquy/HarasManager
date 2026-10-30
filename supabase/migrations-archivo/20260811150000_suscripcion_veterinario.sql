-- Suscripción de veterinarios independientes (Fase 1: activación manual por superadmin,
-- sin pasarela de pago todavía). Ver docs/specs/roles-freemium-veterinarios.md §4.
CREATE TABLE suscripcion_veterinario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  estado TEXT NOT NULL DEFAULT 'inactiva' CHECK (estado IN ('activa', 'inactiva', 'cancelada')),
  activado_por UUID REFERENCES usuario(id),         -- admin/superadmin que la activó manualmente (Fase 1)
  fecha_activacion TIMESTAMPTZ,
  fecha_vencimiento TIMESTAMPTZ,                     -- NULL = sin vencimiento (activación manual indefinida)
  proveedor_pago TEXT,                               -- NULL en Fase 1; 'mercadopago' en Fase 2
  external_subscription_id TEXT,                     -- id de preapproval de MercadoPago, Fase 2
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX suscripcion_veterinario_usuario_id_key ON suscripcion_veterinario(usuario_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON suscripcion_veterinario
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE suscripcion_veterinario ENABLE ROW LEVEL SECURITY;

-- El vet ve su propia suscripción; superadmin ve todas.
CREATE POLICY suscripcion_veterinario_select ON suscripcion_veterinario
  FOR SELECT
  USING (usuario_id = auth.uid() OR is_superadmin());

-- Activar/desactivar es manual y exclusivo de superadmin (Fase 1). La fila inicial
-- 'inactiva' la crea la Edge Function self-register-vet con service_role, que
-- bypasea RLS, así que esta policy no le hace falta a ese flujo.
CREATE POLICY suscripcion_veterinario_insert ON suscripcion_veterinario
  FOR INSERT
  WITH CHECK (is_superadmin());

CREATE POLICY suscripcion_veterinario_update ON suscripcion_veterinario
  FOR UPDATE
  USING (is_superadmin())
  WITH CHECK (is_superadmin());
