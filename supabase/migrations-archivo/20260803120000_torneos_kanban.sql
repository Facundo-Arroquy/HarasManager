-- =============================================================================
-- Torneos y asignación de caballos por jugador
-- =============================================================================
-- Módulo de administración: el admin arma un torneo (nombre + temporada +
-- jugadores participantes) y reparte los caballos con tag "Jugador" entre los
-- jugadores en un tablero kanban.
--
-- Tres tablas:
--   torneo             — la competencia, de una sociedad
--   torneo_jugador     — una columna del kanban (nombre libre, usuario opcional)
--   torneo_asignacion  — qué caballo le toca a qué jugador, y en qué orden
--
-- El jugador es nombre libre con `usuario_id` opcional: en polo el jugador no
-- necesariamente es usuario de la plataforma, pero cuando lo es queremos poder
-- cruzarlo (definición 2026-08-03).
--
-- El torneo no se borra al terminar: queda como historial de conformación de
-- equipos, consultable por temporada.
-- =============================================================================

CREATE TABLE IF NOT EXISTS torneo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id  UUID NOT NULL REFERENCES sociedad(id),
  nombre       TEXT NOT NULL,
  temporada    TEXT,                    -- "2026", "Alta 2026", etc.
  fecha_inicio DATE,
  fecha_fin    DATE,
  estado       TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'finalizado', 'cancelado')),
  notas        TEXT,
  creado_por   UUID REFERENCES usuario(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT torneo_fechas_coherentes
    CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_torneo_sociedad ON torneo (sociedad_id, created_at DESC);

CREATE TABLE IF NOT EXISTS torneo_jugador (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id  UUID NOT NULL REFERENCES torneo(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuario(id),   -- NULL = jugador que no usa el sistema
  nombre     TEXT NOT NULL,
  orden      SMALLINT NOT NULL DEFAULT 0,   -- orden de las columnas del kanban
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (torneo_id, nombre),
  -- Permite la FK compuesta de torneo_asignacion: garantiza que el jugador
  -- y la asignación hablen del mismo torneo.
  UNIQUE (id, torneo_id)
);

CREATE INDEX IF NOT EXISTS idx_torneo_jugador_torneo ON torneo_jugador (torneo_id, orden);

CREATE TABLE IF NOT EXISTS torneo_asignacion (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id  UUID NOT NULL REFERENCES torneo(id) ON DELETE CASCADE,
  jugador_id UUID NOT NULL,
  caballo_id UUID NOT NULL REFERENCES caballo(id) ON DELETE CASCADE,
  orden      SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un caballo va a un solo jugador dentro del mismo torneo: la asignación
  -- duplicada es justamente lo que el kanban tiene que evitar.
  UNIQUE (torneo_id, caballo_id),
  FOREIGN KEY (jugador_id, torneo_id)
    REFERENCES torneo_jugador (id, torneo_id) ON DELETE CASCADE
);

-- Sin UNIQUE sobre `orden`: reordenar dentro de una columna chocaría contra la
-- constraint fila por fila. La escritura va siempre por
-- guardar_asignaciones_torneo(), que reescribe la columna entera.
CREATE INDEX IF NOT EXISTS idx_torneo_asignacion_jugador
  ON torneo_asignacion (jugador_id, orden);
CREATE INDEX IF NOT EXISTS idx_torneo_asignacion_torneo
  ON torneo_asignacion (torneo_id);

DROP TRIGGER IF EXISTS set_updated_at ON torneo;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON torneo
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON torneo_asignacion;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON torneo_asignacion
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Lectura para todo miembro de la sociedad (el jugador y el piloto quieren ver
-- la conformación); escritura solo para el admin.

ALTER TABLE torneo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS torneo_select ON torneo;
CREATE POLICY torneo_select ON torneo
  FOR SELECT TO authenticated
  USING (is_superadmin() OR tiene_membresia(sociedad_id));

DROP POLICY IF EXISTS torneo_write ON torneo;
CREATE POLICY torneo_write ON torneo
  FOR ALL TO authenticated
  USING (is_superadmin() OR es_admin(sociedad_id))
  WITH CHECK (is_superadmin() OR es_admin(sociedad_id));

ALTER TABLE torneo_jugador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS torneo_jugador_select ON torneo_jugador;
CREATE POLICY torneo_jugador_select ON torneo_jugador
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM torneo t
      WHERE t.id = torneo_jugador.torneo_id
        AND (is_superadmin() OR tiene_membresia(t.sociedad_id))
    )
  );

DROP POLICY IF EXISTS torneo_jugador_write ON torneo_jugador;
CREATE POLICY torneo_jugador_write ON torneo_jugador
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM torneo t
      WHERE t.id = torneo_jugador.torneo_id
        AND (is_superadmin() OR es_admin(t.sociedad_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM torneo t
      WHERE t.id = torneo_jugador.torneo_id
        AND (is_superadmin() OR es_admin(t.sociedad_id))
    )
  );

ALTER TABLE torneo_asignacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS torneo_asignacion_select ON torneo_asignacion;
CREATE POLICY torneo_asignacion_select ON torneo_asignacion
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM torneo t
      WHERE t.id = torneo_asignacion.torneo_id
        AND (is_superadmin() OR tiene_membresia(t.sociedad_id))
    )
  );

DROP POLICY IF EXISTS torneo_asignacion_write ON torneo_asignacion;
CREATE POLICY torneo_asignacion_write ON torneo_asignacion
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM torneo t
      WHERE t.id = torneo_asignacion.torneo_id
        AND (is_superadmin() OR es_admin(t.sociedad_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM torneo t
      WHERE t.id = torneo_asignacion.torneo_id
        AND (is_superadmin() OR es_admin(t.sociedad_id))
    )
  );

-- ── Escritura del tablero ────────────────────────────────────────────────────
-- Reescribe la columna completa de un jugador en una sola transacción. Es el
-- equivalente de guardar_ranking_padrillos() para el kanban: el frontend nunca
-- hace UPDATE fila por fila, manda la lista final de la columna que tocó.
--
-- p_jugador_id NULL = columna "Disponibles": los caballos de la lista se
-- liberan de cualquier jugador del torneo.
--
-- Los caballos que llegan se sueltan primero de su jugador anterior, así que
-- un drag de un jugador a otro es una sola llamada.
CREATE OR REPLACE FUNCTION guardar_asignaciones_torneo(
  p_torneo_id  UUID,
  p_jugador_id UUID,
  p_caballo_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sociedad_id UUID;
  v_estado      TEXT;
  v_ids         UUID[] := COALESCE(p_caballo_ids, '{}'::UUID[]);
  v_tag_jugador INTEGER;
  v_invalido    TEXT;
BEGIN
  SELECT sociedad_id, estado INTO v_sociedad_id, v_estado
  FROM torneo WHERE id = p_torneo_id;

  IF v_sociedad_id IS NULL THEN
    RAISE EXCEPTION 'El torneo no existe.';
  END IF;

  IF NOT (is_superadmin() OR es_admin(v_sociedad_id)) THEN
    RAISE EXCEPTION 'Solo un administrador puede asignar caballos del torneo.';
  END IF;

  IF v_estado <> 'activo' THEN
    RAISE EXCEPTION 'El torneo está %; no admite cambios de asignación.', v_estado;
  END IF;

  IF p_jugador_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM torneo_jugador
    WHERE id = p_jugador_id AND torneo_id = p_torneo_id
  ) THEN
    RAISE EXCEPTION 'El jugador no pertenece a este torneo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM UNNEST(v_ids) AS t(id) GROUP BY t.id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'La lista no puede repetir el mismo caballo.';
  END IF;

  SELECT id INTO v_tag_jugador FROM cat_tag WHERE nombre = 'Jugador';

  -- Solo entran caballos activos de la sociedad del torneo y con tag "Jugador":
  -- la columna de disponibles se arma con esa condición, y la función es la que
  -- la hace cumplir.
  SELECT c.nombre INTO v_invalido
  FROM UNNEST(v_ids) AS t(id)
  JOIN caballo c ON c.id = t.id
  WHERE c.sociedad_id IS DISTINCT FROM v_sociedad_id
     OR c.activo IS NOT TRUE
     OR (v_tag_jugador IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM caballo_tag ct
          WHERE ct.caballo_id = c.id AND ct.tag_id = v_tag_jugador
        ))
  LIMIT 1;

  IF v_invalido IS NOT NULL THEN
    RAISE EXCEPTION 'El caballo % no está disponible para este torneo.', v_invalido;
  END IF;

  IF array_length(v_ids, 1) IS NOT NULL AND EXISTS (
    SELECT 1 FROM UNNEST(v_ids) AS t(id)
    LEFT JOIN caballo c ON c.id = t.id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Alguno de los caballos no existe.';
  END IF;

  -- Suelta los caballos de la lista de cualquier jugador del torneo.
  DELETE FROM torneo_asignacion
  WHERE torneo_id = p_torneo_id AND caballo_id = ANY(v_ids);

  IF p_jugador_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Y reescribe la columna del jugador con el orden recibido.
  DELETE FROM torneo_asignacion
  WHERE torneo_id = p_torneo_id AND jugador_id = p_jugador_id;

  INSERT INTO torneo_asignacion (torneo_id, jugador_id, caballo_id, orden)
  SELECT p_torneo_id, p_jugador_id, t.id, t.orden
  FROM UNNEST(v_ids) WITH ORDINALITY AS t(id, orden);

  RETURN COALESCE(array_length(v_ids, 1), 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION guardar_asignaciones_torneo(UUID, UUID, UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION guardar_asignaciones_torneo(UUID, UUID, UUID[]) TO authenticated;
