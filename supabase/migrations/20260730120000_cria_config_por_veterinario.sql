-- =============================================================================
-- Configuración del centro de cría: pasa de "por sociedad" a "por veterinario"
-- =============================================================================
-- Definición de Gero (2026-07-30): "la lista de acciones la define cada
-- veterinario y debe cumplir el plazo del vet que hace el registro".
--
-- Reemplaza el modelo de `20260729161500_cat_chip_obs.sql`, que había quedado
-- por sociedad (sociedad_id, NULL = global). Ese modelo tenía dos problemas:
--   1. El veterinario no veía los chips de la sociedad (no tiene membresía),
--      así que la función quedaba inutilizable justo para quien la usa.
--   2. El mismo vet veía vocabularios distintos según de quién era el caballo.
--
-- Además los plazos vivían en localStorage del navegador, con lo cual el plazo
-- aplicado era el del dispositivo y no el del veterinario — imposible cumplir
-- la definición de Gero. Pasan a `cria_plazo_vet`.
--
-- Los chips que disparan recordatorios automáticos (Strelin, IN, OV, PG,
-- Flushing, Transferida) ya NO se protegen: si la lista es del vet y los plazos
-- también, sacarlos es su decisión. La UI los marca con un aviso visible. La
-- lista de esos nombres vive en el frontend (CHIPS_CON_RECORDATORIO en
-- types/crianza.ts), al lado de las reglas que los interpretan.
-- =============================================================================

-- ── Catálogo de acciones, ahora por veterinario ─────────────────────────────
-- Se recrea: las filas viejas eran globales o por sociedad y no hay forma
-- sensata de atribuirlas a un veterinario. Cada vet arranca con la lista vacía
-- y la arma en Configuración del centro (decisión de producto).
DROP TRIGGER IF EXISTS trg_proteger_chip_obs ON cat_chip_obs;
DROP FUNCTION IF EXISTS proteger_chip_obs();
DROP TABLE IF EXISTS cat_chip_obs;

CREATE TABLE cat_chip_obs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veterinario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (veterinario_id, nombre)
);
CREATE INDEX idx_cat_chip_obs_vet ON cat_chip_obs(veterinario_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cat_chip_obs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE cat_chip_obs ENABLE ROW LEVEL SECURITY;

-- Cada vet gestiona solo su propia lista. El superadmin puede leer para soporte.
CREATE POLICY cat_chip_obs_select ON cat_chip_obs
  FOR SELECT USING (veterinario_id = auth.uid() OR is_superadmin());
CREATE POLICY cat_chip_obs_insert ON cat_chip_obs
  FOR INSERT WITH CHECK (veterinario_id = auth.uid());
CREATE POLICY cat_chip_obs_update ON cat_chip_obs
  FOR UPDATE USING (veterinario_id = auth.uid());
CREATE POLICY cat_chip_obs_delete ON cat_chip_obs
  FOR DELETE USING (veterinario_id = auth.uid());

-- ── Plazos de recordatorios, por veterinario ────────────────────────────────
-- Una fila por vet. Si no existe, el frontend usa los defaults (mismos valores
-- que CRIA_CONFIG_DEFAULTS), así un vet nuevo no queda sin plazos.
--
-- No se reutiliza `cria_parametro` (por sociedad, clave/valor): tiene otro
-- juego de claves, nunca se conectó al frontend, y el dueño ahora es el vet.
CREATE TABLE cria_plazo_vet (
  veterinario_id              UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  donante_strelin_a_in        SMALLINT NOT NULL DEFAULT 1,
  donante_in_a_oxi            SMALLINT NOT NULL DEFAULT 1,
  donante_ov_a_flushing       SMALLINT NOT NULL DEFAULT 6,
  donante_pg_a_revision_pg    SMALLINT NOT NULL DEFAULT 3,
  donante_flushing_a_revision SMALLINT NOT NULL DEFAULT 4,
  receptora_pg_a_revision_pg  SMALLINT NOT NULL DEFAULT 4,
  receptora_ov_a_dar_pg       SMALLINT NOT NULL DEFAULT 3,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  -- Mismo rango que valida la UI
  CONSTRAINT cria_plazo_vet_rangos CHECK (
    donante_strelin_a_in        BETWEEN 1 AND 30 AND
    donante_in_a_oxi            BETWEEN 1 AND 30 AND
    donante_ov_a_flushing       BETWEEN 1 AND 30 AND
    donante_pg_a_revision_pg    BETWEEN 1 AND 30 AND
    donante_flushing_a_revision BETWEEN 1 AND 30 AND
    receptora_pg_a_revision_pg  BETWEEN 1 AND 30 AND
    receptora_ov_a_dar_pg       BETWEEN 1 AND 30
  )
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cria_plazo_vet
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE cria_plazo_vet ENABLE ROW LEVEL SECURITY;

CREATE POLICY cria_plazo_vet_select ON cria_plazo_vet
  FOR SELECT USING (veterinario_id = auth.uid() OR is_superadmin());
CREATE POLICY cria_plazo_vet_insert ON cria_plazo_vet
  FOR INSERT WITH CHECK (veterinario_id = auth.uid());
CREATE POLICY cria_plazo_vet_update ON cria_plazo_vet
  FOR UPDATE USING (veterinario_id = auth.uid());
