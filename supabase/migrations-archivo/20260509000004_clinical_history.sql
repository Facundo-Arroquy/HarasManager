-- =============================================================================
-- Migración 4: Historial clínico
-- Depende de: 20260509000003_horses_and_owners.sql (caballo)
--             20260509000002_core_entities.sql (usuario)
--             20260509000001_catalogs.sql (cat_tipo_consulta, cat_parte_cuerpo)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Registro clínico principal
-- creado_por = veterinario que asentó la consulta.
-- REGLA DE NEGOCIO (reforzada por RLS): solo creado_por puede hacer UPDATE.
-- No se permiten DELETE (política RLS no incluye DELETE).
-- ---------------------------------------------------------------------------
CREATE TABLE historial_clinico (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id       UUID        NOT NULL REFERENCES caballo(id) ON DELETE RESTRICT,
  tipo_consulta_id INTEGER     NOT NULL REFERENCES cat_tipo_consulta(id),
  fecha_consulta   TIMESTAMPTZ NOT NULL,
  diagnostico      TEXT,
  tratamiento      TEXT,
  observaciones    TEXT,
  proxima_consulta DATE,
  creado_por       UUID        NOT NULL REFERENCES usuario(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_historial_clinico
  BEFORE UPDATE ON historial_clinico
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Consulta frecuente: historial de un caballo (ordenado por fecha)
CREATE INDEX idx_historial_clinico_caballo
  ON historial_clinico (caballo_id, fecha_consulta DESC);

-- Consulta frecuente: registros propios de un veterinario
CREATE INDEX idx_historial_clinico_creado_por
  ON historial_clinico (creado_por);

-- ---------------------------------------------------------------------------
-- Partes del cuerpo afectadas en un registro (N:M con historial_clinico)
-- Cada fila representa una parte específica con su lado y descripción libre.
-- Hereda inmutabilidad del historial: solo el vet creador puede modificar.
-- ---------------------------------------------------------------------------
CREATE TABLE historial_parte_afectada (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  historial_id    UUID    NOT NULL REFERENCES historial_clinico(id) ON DELETE CASCADE,
  parte_cuerpo_id INTEGER NOT NULL REFERENCES cat_parte_cuerpo(id),
  lado            VARCHAR(20) CHECK (lado IN ('izquierdo', 'derecho', 'bilateral', 'no aplica')),
  descripcion     TEXT
);

CREATE INDEX idx_historial_parte_afectada_historial
  ON historial_parte_afectada (historial_id);

-- ---------------------------------------------------------------------------
-- Medicamentos aplicados en un registro
-- Hereda inmutabilidad del historial: solo el vet creador puede modificar.
-- ---------------------------------------------------------------------------
CREATE TABLE historial_medicamento (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  historial_id       UUID         NOT NULL REFERENCES historial_clinico(id) ON DELETE CASCADE,
  medicamento        VARCHAR(200) NOT NULL,
  dosis              VARCHAR(100),
  via_administracion VARCHAR(100),
  duracion_dias      INTEGER      CHECK (duracion_dias > 0)
);

CREATE INDEX idx_historial_medicamento_historial
  ON historial_medicamento (historial_id);
