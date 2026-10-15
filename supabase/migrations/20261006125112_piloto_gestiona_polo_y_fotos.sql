-- El piloto gestiona el módulo Polo con los mismos permisos que el admin.
-- El permiso se mantiene acotado a su sociedad mediante la membresía activa.

CREATE OR REPLACE FUNCTION public.puede_gestionar_polo(p_sociedad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membresia m
    JOIN cat_rol r ON r.id = m.rol_id
    WHERE m.usuario_id = (SELECT auth.uid())
      AND m.sociedad_id = p_sociedad_id
      AND m.activa = TRUE
      AND r.nombre IN ('admin', 'piloto')
  );
$$;

REVOKE ALL ON FUNCTION public.puede_gestionar_polo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_gestionar_polo(UUID) TO authenticated;

DROP POLICY IF EXISTS torneo_write ON public.torneo;
CREATE POLICY torneo_write ON public.torneo
  FOR ALL TO authenticated
  USING (is_superadmin() OR puede_gestionar_polo(sociedad_id))
  WITH CHECK (is_superadmin() OR puede_gestionar_polo(sociedad_id));

DROP POLICY IF EXISTS torneo_jugador_write ON public.torneo_jugador;
CREATE POLICY torneo_jugador_write ON public.torneo_jugador
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.torneo t
      WHERE t.id = torneo_jugador.torneo_id
        AND (is_superadmin() OR puede_gestionar_polo(t.sociedad_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.torneo t
      WHERE t.id = torneo_jugador.torneo_id
        AND (is_superadmin() OR puede_gestionar_polo(t.sociedad_id))
    )
  );

DROP POLICY IF EXISTS torneo_asignacion_write ON public.torneo_asignacion;
CREATE POLICY torneo_asignacion_write ON public.torneo_asignacion
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.torneo t
      WHERE t.id = torneo_asignacion.torneo_id
        AND (is_superadmin() OR puede_gestionar_polo(t.sociedad_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.torneo t
      WHERE t.id = torneo_asignacion.torneo_id
        AND (is_superadmin() OR puede_gestionar_polo(t.sociedad_id))
    )
  );

CREATE OR REPLACE FUNCTION public.guardar_asignaciones_torneo(
  p_torneo_id UUID,
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
  v_estado TEXT;
  v_ids UUID[] := COALESCE(p_caballo_ids, '{}'::UUID[]);
  v_tag_jugador INTEGER;
  v_invalido TEXT;
BEGIN
  SELECT sociedad_id, estado INTO v_sociedad_id, v_estado
  FROM torneo WHERE id = p_torneo_id;

  IF v_sociedad_id IS NULL THEN
    RAISE EXCEPTION 'El torneo no existe.';
  END IF;

  IF NOT (is_superadmin() OR puede_gestionar_polo(v_sociedad_id)) THEN
    RAISE EXCEPTION 'Solo un administrador o piloto puede asignar caballos del torneo.';
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

  DELETE FROM torneo_asignacion
  WHERE torneo_id = p_torneo_id AND caballo_id = ANY(v_ids);

  IF p_jugador_id IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM torneo_asignacion
  WHERE torneo_id = p_torneo_id AND jugador_id = p_jugador_id;

  INSERT INTO torneo_asignacion (torneo_id, jugador_id, caballo_id, orden)
  SELECT p_torneo_id, p_jugador_id, t.id, t.orden
  FROM UNNEST(v_ids) WITH ORDINALITY AS t(id, orden);

  RETURN COALESCE(array_length(v_ids, 1), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_asignaciones_torneo(UUID, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_asignaciones_torneo(UUID, UUID, UUID[]) TO authenticated;
