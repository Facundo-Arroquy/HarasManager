-- =============================================================================
-- Migración 3: Propietarios, caballos e historial de propiedad
-- Depende de: 20260509000002_core_entities.sql (sociedad, usuario)
--             20260509000001_catalogs.sql (cat_raza, cat_pelaje)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Propietarios (persona física o jurídica dentro de una sociedad)
-- Scoped por sociedad_id → RLS los aísla por tenant.
-- ---------------------------------------------------------------------------
CREATE TABLE propietario (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(200) NOT NULL,
  documento   VARCHAR(50),
  telefono    VARCHAR(30),
  email       VARCHAR(255),
  sociedad_id UUID        NOT NULL REFERENCES sociedad(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_propietario
  BEFORE UPDATE ON propietario
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_propietario_sociedad
  ON propietario (sociedad_id);

-- ---------------------------------------------------------------------------
-- Caballos
-- Scoped por sociedad_id → RLS los aísla por tenant.
-- activo = FALSE para baja lógica (nunca se borra).
-- ---------------------------------------------------------------------------
CREATE TABLE caballo (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           VARCHAR(150) NOT NULL,
  fecha_nacimiento DATE,
  categoria        VARCHAR(20)  CHECK (categoria IN ('Yegua', 'Padrillo', 'Caballo', 'Potrillo')),
  raza_id          INTEGER      REFERENCES cat_raza(id),
  pelaje_id        INTEGER      REFERENCES cat_pelaje(id),
  numero_chip      VARCHAR(50),
  numero_registro  VARCHAR(50),
  sociedad_id      UUID        NOT NULL REFERENCES sociedad(id) ON DELETE RESTRICT,
  activo           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_caballo
  BEFORE UPDATE ON caballo
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_caballo_sociedad_activo
  ON caballo (sociedad_id, activo);

-- ---------------------------------------------------------------------------
-- Historial de propiedad (inmutable — registra cada venta/transferencia)
-- Propietario vigente: WHERE fecha_fin IS NULL (máximo uno por caballo).
-- Nunca hacer UPDATE ni DELETE; cada cambio es un nuevo registro.
-- registrado_por: admin que asentó la operación (auditoría).
-- ---------------------------------------------------------------------------
CREATE TABLE propiedad (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id     UUID        NOT NULL REFERENCES caballo(id) ON DELETE RESTRICT,
  propietario_id UUID        NOT NULL REFERENCES propietario(id) ON DELETE RESTRICT,
  fecha_inicio   DATE        NOT NULL,
  fecha_fin      DATE,                    -- NULL = propietario actual
  registrado_por UUID        NOT NULL REFERENCES usuario(id),
  observaciones  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Sin updated_at: tabla inmutable
);

-- Consulta frecuente: propietario vigente de un caballo (fecha_fin IS NULL)
CREATE INDEX idx_propiedad_caballo_fecha_fin
  ON propiedad (caballo_id, fecha_fin);
