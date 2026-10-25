-- =============================================================================
-- Historial de reprogramaciones de recordatorios (append-only)
-- Registra cada vez que un vet pospone un flushing u otro recordatorio.
-- =============================================================================

-- 1. Columna fecha_original en cria_recordatorio
ALTER TABLE cria_recordatorio ADD COLUMN IF NOT EXISTS fecha_original date;

-- Retrorellenar: los existentes nunca se pospusieron, su fecha_vto es la original.
UPDATE cria_recordatorio SET fecha_original = fecha_vto WHERE fecha_original IS NULL;

-- 2. Tabla append-only de reprogramaciones
CREATE TABLE IF NOT EXISTS cria_reprogramacion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recordatorio_id uuid NOT NULL REFERENCES cria_recordatorio(id) ON DELETE CASCADE,
  fecha_anterior  date NOT NULL,
  fecha_nueva     date NOT NULL,
  motivo          text,
  creado_por      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cria_reprogramacion_rec_fecha
  ON cria_reprogramacion (recordatorio_id, created_at DESC);

-- RLS: misma visibilidad que el recordatorio padre
ALTER TABLE cria_reprogramacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reprogramaciones visibles si el recordatorio lo es"
  ON cria_reprogramacion FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM cria_recordatorio r WHERE r.id = recordatorio_id
  ));

CREATE POLICY "Vet inserta reprogramaciones de sus recordatorios"
  ON cria_reprogramacion FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM cria_recordatorio r WHERE r.id = recordatorio_id
  ));
