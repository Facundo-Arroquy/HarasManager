-- =============================================================================
-- Sanidad para veterinarios
-- =============================================================================
-- Permite que un veterinario cree y gestione trabajos sanitarios sobre los
-- caballos a los que tiene acceso (acceso_vet), no solo los miembros de la
-- sociedad. El vet gestiona los trabajos que él creó; la lista de caballos se
-- valida por acceso individual.

-- ── trabajo_sanitario ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS trabajo_sanitario_select ON trabajo_sanitario;
CREATE POLICY trabajo_sanitario_select ON trabajo_sanitario
  FOR SELECT USING (
    tiene_membresia(sociedad_id) OR is_superadmin() OR creado_por = auth.uid()
  );

DROP POLICY IF EXISTS trabajo_sanitario_insert ON trabajo_sanitario;
CREATE POLICY trabajo_sanitario_insert ON trabajo_sanitario
  FOR INSERT WITH CHECK (
    creado_por = auth.uid()
    AND (
      tiene_membresia(sociedad_id)
      OR EXISTS (
        SELECT 1 FROM acceso_vet av
        JOIN caballo c ON c.id = av.caballo_id
        WHERE av.vet_id = auth.uid()
          AND av.activo
          AND c.sociedad_id = trabajo_sanitario.sociedad_id
      )
    )
  );

DROP POLICY IF EXISTS trabajo_sanitario_update ON trabajo_sanitario;
CREATE POLICY trabajo_sanitario_update ON trabajo_sanitario
  FOR UPDATE USING (
    tiene_membresia(sociedad_id) OR is_superadmin() OR creado_por = auth.uid()
  );

-- ── trabajo_sanitario_caballo ───────────────────────────────────────────────
DROP POLICY IF EXISTS trabajo_sanitario_caballo_all ON trabajo_sanitario_caballo;
CREATE POLICY trabajo_sanitario_caballo_all ON trabajo_sanitario_caballo
  FOR ALL USING (
    vet_tiene_acceso(caballo_id)
    OR EXISTS (
      SELECT 1 FROM trabajo_sanitario t
      WHERE t.id = trabajo_id
        AND (tiene_membresia(t.sociedad_id) OR is_superadmin() OR t.creado_por = auth.uid())
    )
  )
  WITH CHECK (
    vet_tiene_acceso(caballo_id)
    OR EXISTS (
      SELECT 1 FROM trabajo_sanitario t
      WHERE t.id = trabajo_id
        AND (tiene_membresia(t.sociedad_id) OR is_superadmin() OR t.creado_por = auth.uid())
    )
  );

-- ── completar_trabajo_sanitario: permitir también al creador (vet) ──────────
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

  IF NOT (tiene_membresia(v_trabajo.sociedad_id) OR is_superadmin() OR v_trabajo.creado_por = v_uid) THEN
    RAISE EXCEPTION 'Sin permiso para completar este trabajo';
  END IF;

  IF v_trabajo.estado = 'realizado' THEN
    RAISE EXCEPTION 'El trabajo ya fue marcado como realizado';
  END IF;

  INSERT INTO cat_tipo_consulta (nombre) VALUES (v_trabajo.nombre)
    ON CONFLICT (nombre) DO NOTHING;
  SELECT id INTO v_tipo_id FROM cat_tipo_consulta WHERE nombre = v_trabajo.nombre;

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
