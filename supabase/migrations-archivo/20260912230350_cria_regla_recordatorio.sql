-- Reglas de recordatorios que define cada veterinario: "si marco la acción X
-- en una donante/receptora, pedir la acción Y a los Z días". Se suman a las
-- reglas fijas (Strelin → IN, IN → OXI, OV → Flushing, etc.), que siguen en
-- reglasParaRegistro con sus plazos en cria_plazo_vet. Igual que los plazos y
-- el catálogo de acciones, son del vet y viajan con él: no llevan sociedad_id.

CREATE TABLE cria_regla_recordatorio (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veterinario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  rol                 TEXT NOT NULL CHECK (rol IN ('Donante', 'Receptora', 'Ambas')),
  accion_disparadora  TEXT NOT NULL CHECK (btrim(accion_disparadora) <> ''),
  accion_recordatorio TEXT NOT NULL CHECK (btrim(accion_recordatorio) <> ''),
  dias                SMALLINT NOT NULL CHECK (dias BETWEEN 1 AND 365),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (veterinario_id, rol, accion_disparadora, accion_recordatorio)
);

ALTER TABLE cria_regla_recordatorio ENABLE ROW LEVEL SECURITY;

CREATE POLICY cria_regla_recordatorio_select ON cria_regla_recordatorio
  FOR SELECT USING (veterinario_id = auth.uid() OR is_superadmin());

CREATE POLICY cria_regla_recordatorio_insert ON cria_regla_recordatorio
  FOR INSERT WITH CHECK (veterinario_id = auth.uid());

CREATE POLICY cria_regla_recordatorio_update ON cria_regla_recordatorio
  FOR UPDATE USING (veterinario_id = auth.uid()) WITH CHECK (veterinario_id = auth.uid());

CREATE POLICY cria_regla_recordatorio_delete ON cria_regla_recordatorio
  FOR DELETE USING (veterinario_id = auth.uid());
