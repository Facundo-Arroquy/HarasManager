-- =============================================================================
-- Sistema de tags para caballos
-- =============================================================================
-- Definición de Gero (2026-08-02): se necesita un tag "Jugador" para identificar
-- animales destinados o usados para juego/deporte, asignable tanto a Caballos
-- como a Yeguas.
--
-- Se modela como catálogo + M:N en vez de una columna booleana para poder sumar
-- tags nuevos sin migración ni cambios de UI.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cat_tag (
  id     SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  color  TEXT,                                  -- clave de color para la UI
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cat_tag (nombre, color)
VALUES ('Jugador', 'emerald')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS caballo_tag (
  caballo_id UUID    NOT NULL REFERENCES caballo(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES cat_tag(id) ON DELETE CASCADE,
  creado_por UUID    REFERENCES usuario(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (caballo_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_caballo_tag_tag ON caballo_tag (tag_id);

ALTER TABLE cat_tag     ENABLE ROW LEVEL SECURITY;
ALTER TABLE caballo_tag ENABLE ROW LEVEL SECURITY;

-- Catálogo: lectura para cualquier autenticado; ABM solo superadmin.
DROP POLICY IF EXISTS cat_tag_select ON cat_tag;
CREATE POLICY cat_tag_select ON cat_tag
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS cat_tag_admin ON cat_tag;
CREATE POLICY cat_tag_admin ON cat_tag
  FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

-- Asignación: sigue el acceso al caballo (membresía de la sociedad o acceso_vet).
DROP POLICY IF EXISTS caballo_tag_select ON caballo_tag;
CREATE POLICY caballo_tag_select ON caballo_tag
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR vet_tiene_acceso(caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo c
      WHERE c.id = caballo_tag.caballo_id
        AND c.sociedad_id IS NOT NULL
        AND tiene_membresia(c.sociedad_id)
    )
  );

DROP POLICY IF EXISTS caballo_tag_write ON caballo_tag;
CREATE POLICY caballo_tag_write ON caballo_tag
  FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR vet_tiene_acceso(caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo c
      WHERE c.id = caballo_tag.caballo_id
        AND c.sociedad_id IS NOT NULL
        AND es_admin(c.sociedad_id)
    )
  )
  WITH CHECK (
    is_superadmin()
    OR vet_tiene_acceso(caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo c
      WHERE c.id = caballo_tag.caballo_id
        AND c.sociedad_id IS NOT NULL
        AND es_admin(c.sociedad_id)
    )
  );
