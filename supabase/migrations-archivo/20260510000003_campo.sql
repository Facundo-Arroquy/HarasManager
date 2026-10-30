-- =============================================================================
-- Migración 8: Campos / Caballerizas
--
-- Un campo es una ubicación física del haras (potrero, caballeriza, box, etc.).
-- Pertenece a la sociedad (no a una marca) y es visible para todos los miembros.
-- Pueden crearlo admin, jugador y piloto.
-- Los caballos tienen campo_id opcional para indicar dónde están alojados.
-- =============================================================================

CREATE TABLE campo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  nombre      VARCHAR(150) NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sociedad_id, nombre)
);

CREATE TRIGGER set_campo_updated_at
  BEFORE UPDATE ON campo
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE caballo ADD COLUMN campo_id UUID REFERENCES campo(id);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_campo_sociedad ON campo(sociedad_id);
CREATE INDEX idx_caballo_campo  ON caballo(campo_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE campo ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro activo de la sociedad puede ver los campos
CREATE POLICY "campo_select"
  ON campo FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id));

-- Admin, jugador y piloto pueden crear campos
CREATE POLICY "campo_insert"
  ON campo FOR INSERT TO authenticated
  WITH CHECK (
    tiene_membresia(sociedad_id)
    AND EXISTS (
      SELECT 1
      FROM membresia m
      JOIN cat_rol r ON r.id = m.rol_id
      WHERE m.usuario_id  = auth.uid()
        AND m.sociedad_id = sociedad_id
        AND m.activa      = TRUE
        AND r.nombre IN ('admin', 'jugador', 'piloto')
    )
  );

-- Los mismos roles pueden actualizar
CREATE POLICY "campo_update"
  ON campo FOR UPDATE TO authenticated
  USING (
    tiene_membresia(sociedad_id)
    AND EXISTS (
      SELECT 1
      FROM membresia m
      JOIN cat_rol r ON r.id = m.rol_id
      WHERE m.usuario_id  = auth.uid()
        AND m.sociedad_id = sociedad_id
        AND m.activa      = TRUE
        AND r.nombre IN ('admin', 'jugador', 'piloto')
    )
  );
