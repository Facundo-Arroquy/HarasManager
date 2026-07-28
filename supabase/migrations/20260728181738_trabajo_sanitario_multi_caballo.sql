-- =============================================================================
-- Trabajos sanitarios multi-caballo
-- =============================================================================
-- Un "trabajo" (ej: desparasitar) se arma como una lista de caballos programada
-- para un día. Al marcarlo "realizado", se escribe una fila en el historial
-- clínico de cada caballo no excluido (definición de Gero: sanidad va al
-- historial clínico; se puede armar el listado y marcar realizado para todos).
--
-- Tablas:
--   cat_trabajo_sanitario     — catálogo editable de trabajos (globales + por sociedad)
--   trabajo_sanitario         — el trabajo programado
--   trabajo_sanitario_caballo — la lista de caballos del trabajo (con exclusión)
-- Función:
--   completar_trabajo_sanitario(p_trabajo_id) — carga el trabajo en el historial
--     de cada caballo no excluido y marca el trabajo como realizado.
-- =============================================================================

-- ── Catálogo de trabajos (editable por el usuario) ──────────────────────────
-- sociedad_id NULL = trabajo global (visible para todas las sociedades).
CREATE TABLE cat_trabajo_sanitario (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID REFERENCES sociedad(id),
  nombre      TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (sociedad_id, nombre)
);

-- Básicos pre-cargados (globales)
INSERT INTO cat_trabajo_sanitario (sociedad_id, nombre) VALUES
  (NULL, 'Desparasitación'),
  (NULL, 'Vacunación'),
  (NULL, 'Herrado'),
  (NULL, 'Control odontológico'),
  (NULL, 'Extracción de sangre');

-- ── Trabajo programado ──────────────────────────────────────────────────────
CREATE TABLE trabajo_sanitario (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id      UUID NOT NULL REFERENCES sociedad(id),
  nombre           TEXT NOT NULL,
  fecha_programada DATE NOT NULL,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','realizado','cancelado')),
  tratamiento      TEXT,
  observaciones    TEXT,
  fecha_realizado  DATE,
  creado_por       UUID NOT NULL REFERENCES usuario(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_trabajo_sanitario_sociedad ON trabajo_sanitario(sociedad_id);
CREATE INDEX idx_trabajo_sanitario_fecha    ON trabajo_sanitario(fecha_programada);

-- ── Lista de caballos del trabajo ───────────────────────────────────────────
CREATE TABLE trabajo_sanitario_caballo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabajo_id   UUID NOT NULL REFERENCES trabajo_sanitario(id) ON DELETE CASCADE,
  caballo_id   UUID NOT NULL REFERENCES caballo(id),
  excluido     BOOLEAN NOT NULL DEFAULT false,
  historial_id UUID REFERENCES historial_clinico(id),  -- fila creada al completar
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trabajo_id, caballo_id)
);
CREATE INDEX idx_trabajo_sanitario_caballo_trabajo ON trabajo_sanitario_caballo(trabajo_id);
CREATE INDEX idx_trabajo_sanitario_caballo_caballo ON trabajo_sanitario_caballo(caballo_id);

-- ── updated_at ──────────────────────────────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cat_trabajo_sanitario
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON trabajo_sanitario
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE cat_trabajo_sanitario     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabajo_sanitario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabajo_sanitario_caballo ENABLE ROW LEVEL SECURITY;

-- Catálogo: los globales los ve todo el mundo; los propios, los miembros.
CREATE POLICY cat_trabajo_sanitario_select ON cat_trabajo_sanitario
  FOR SELECT USING (
    sociedad_id IS NULL OR tiene_membresia(sociedad_id) OR is_superadmin()
  );
-- Sólo el admin de la sociedad edita los suyos; los globales, el superadmin.
CREATE POLICY cat_trabajo_sanitario_insert ON cat_trabajo_sanitario
  FOR INSERT WITH CHECK (
    (sociedad_id IS NOT NULL AND es_admin(sociedad_id))
    OR (sociedad_id IS NULL AND is_superadmin())
  );
CREATE POLICY cat_trabajo_sanitario_update ON cat_trabajo_sanitario
  FOR UPDATE USING (
    (sociedad_id IS NOT NULL AND es_admin(sociedad_id))
    OR (sociedad_id IS NULL AND is_superadmin())
  );
CREATE POLICY cat_trabajo_sanitario_delete ON cat_trabajo_sanitario
  FOR DELETE USING (
    (sociedad_id IS NOT NULL AND es_admin(sociedad_id))
    OR (sociedad_id IS NULL AND is_superadmin())
  );

-- Trabajo: gestionado por los miembros de la sociedad.
CREATE POLICY trabajo_sanitario_select ON trabajo_sanitario
  FOR SELECT USING (tiene_membresia(sociedad_id) OR is_superadmin());
CREATE POLICY trabajo_sanitario_insert ON trabajo_sanitario
  FOR INSERT WITH CHECK (tiene_membresia(sociedad_id) AND creado_por = auth.uid());
CREATE POLICY trabajo_sanitario_update ON trabajo_sanitario
  FOR UPDATE USING (tiene_membresia(sociedad_id) OR is_superadmin());
CREATE POLICY trabajo_sanitario_delete ON trabajo_sanitario
  FOR DELETE USING (es_admin(sociedad_id) OR is_superadmin());

-- Lista de caballos: hereda el permiso del trabajo padre.
CREATE POLICY trabajo_sanitario_caballo_all ON trabajo_sanitario_caballo
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trabajo_sanitario t
      WHERE t.id = trabajo_id AND (tiene_membresia(t.sociedad_id) OR is_superadmin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trabajo_sanitario t
      WHERE t.id = trabajo_id AND (tiene_membresia(t.sociedad_id) OR is_superadmin())
    )
  );

-- =============================================================================
-- Función: completar trabajo → carga en el historial clínico de cada caballo
-- =============================================================================
-- Backend futuro: esta lógica es la especificación del endpoint equivalente.
CREATE OR REPLACE FUNCTION completar_trabajo_sanitario(p_trabajo_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trabajo   trabajo_sanitario%ROWTYPE;
  v_tipo_id   INTEGER;
  v_uid       UUID := auth.uid();
  v_count     INTEGER := 0;
  r           RECORD;
  v_hist_id   UUID;
BEGIN
  SELECT * INTO v_trabajo FROM trabajo_sanitario WHERE id = p_trabajo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trabajo sanitario % no encontrado', p_trabajo_id;
  END IF;

  -- El que completa debe ser miembro de la sociedad del trabajo (o superadmin).
  IF NOT (tiene_membresia(v_trabajo.sociedad_id) OR is_superadmin()) THEN
    RAISE EXCEPTION 'Sin permiso para completar este trabajo';
  END IF;

  IF v_trabajo.estado = 'realizado' THEN
    RAISE EXCEPTION 'El trabajo ya fue marcado como realizado';
  END IF;

  -- Asegurar un tipo de consulta con el nombre del trabajo (para el historial).
  INSERT INTO cat_tipo_consulta (nombre) VALUES (v_trabajo.nombre)
    ON CONFLICT (nombre) DO NOTHING;
  SELECT id INTO v_tipo_id FROM cat_tipo_consulta WHERE nombre = v_trabajo.nombre;

  -- Una fila de historial por cada caballo no excluido que aún no la tenga.
  FOR r IN
    SELECT tsc.id, tsc.caballo_id
    FROM trabajo_sanitario_caballo tsc
    WHERE tsc.trabajo_id = p_trabajo_id
      AND tsc.excluido = false
      AND tsc.historial_id IS NULL
  LOOP
    INSERT INTO historial_clinico
      (caballo_id, tipo_consulta_id, fecha_consulta, tratamiento, observaciones, creado_por)
    VALUES
      (r.caballo_id, v_tipo_id, NOW(), v_trabajo.tratamiento, v_trabajo.observaciones, v_uid)
    RETURNING id INTO v_hist_id;

    UPDATE trabajo_sanitario_caballo SET historial_id = v_hist_id WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  UPDATE trabajo_sanitario
    SET estado = 'realizado', fecha_realizado = CURRENT_DATE
    WHERE id = p_trabajo_id;

  RETURN v_count;
END;
$$;
