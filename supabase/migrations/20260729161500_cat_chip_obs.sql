-- =============================================================================
-- Catálogo editable de "acciones/tratamientos" del centro de cría (obs_chips)
-- =============================================================================
-- Hoy las opciones (Strelin, IN, OXI, PG, 1PG, Flushing, Revisar mañana,
-- Transferida) están fijas en el código (CHIPS_OBS, frontend/src/types/crianza.ts).
-- Respuesta 6 de Gero: que cada sociedad pueda agregar/sacar sus propias acciones
-- en vez de depender de un array hardcodeado.
--
-- Algunas de esas acciones disparan lógica automática de recordatorios
-- (crianzaStore.ts → reglasParaRegistro compara literalmente 'Strelin', 'IN',
-- 'PG', 'Flushing', 'Transferida'). Esas se marcan `protegido = true` y quedan
-- bloqueadas para renombrar/desactivar/eliminar vía trigger — evita que alguien
-- rompa la automatización sin darse cuenta desde la UI de configuración.
-- =============================================================================

CREATE TABLE cat_chip_obs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID REFERENCES sociedad(id),   -- NULL = chip global (pre-cargado)
  nombre      TEXT NOT NULL,
  protegido   BOOLEAN NOT NULL DEFAULT false, -- ligado a reglasParaRegistro; no editable desde la UI
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (sociedad_id, nombre)
);

-- Globales pre-cargados (igual al CHIPS_OBS actual)
INSERT INTO cat_chip_obs (sociedad_id, nombre, protegido) VALUES
  (NULL, 'Strelin',        true),
  (NULL, 'IN',             true),
  (NULL, 'OXI',            false),
  (NULL, 'PG',             true),
  (NULL, '1PG',            false),
  (NULL, 'Flushing',       true),
  (NULL, 'Revisar mañana', false),
  (NULL, 'Transferida',    true);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cat_chip_obs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── Protección de chips ligados a la automatización ─────────────────────────
CREATE OR REPLACE FUNCTION proteger_chip_obs()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.protegido THEN
      RAISE EXCEPTION 'No se puede eliminar el chip "%": está ligado a la lógica automática de recordatorios', OLD.nombre;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.protegido AND (NEW.nombre <> OLD.nombre OR NEW.activo = false) THEN
    RAISE EXCEPTION 'No se puede renombrar ni desactivar el chip "%": está ligado a la lógica automática de recordatorios', OLD.nombre;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proteger_chip_obs
  BEFORE UPDATE OR DELETE ON cat_chip_obs
  FOR EACH ROW EXECUTE FUNCTION proteger_chip_obs();

-- =============================================================================
-- RLS — mismo criterio que cat_trabajo_sanitario
-- =============================================================================
ALTER TABLE cat_chip_obs ENABLE ROW LEVEL SECURITY;

-- Los globales los ve todo el mundo (incl. vets sin sociedad); los propios, los miembros.
CREATE POLICY cat_chip_obs_select ON cat_chip_obs
  FOR SELECT USING (
    sociedad_id IS NULL OR tiene_membresia(sociedad_id) OR is_superadmin()
  );

-- Sólo el admin de la sociedad gestiona los suyos; los globales, el superadmin.
CREATE POLICY cat_chip_obs_insert ON cat_chip_obs
  FOR INSERT WITH CHECK (
    (sociedad_id IS NOT NULL AND es_admin(sociedad_id))
    OR (sociedad_id IS NULL AND is_superadmin())
  );
CREATE POLICY cat_chip_obs_update ON cat_chip_obs
  FOR UPDATE USING (
    (sociedad_id IS NOT NULL AND es_admin(sociedad_id))
    OR (sociedad_id IS NULL AND is_superadmin())
  );
CREATE POLICY cat_chip_obs_delete ON cat_chip_obs
  FOR DELETE USING (
    (sociedad_id IS NOT NULL AND es_admin(sociedad_id))
    OR (sociedad_id IS NULL AND is_superadmin())
  );
