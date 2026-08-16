-- Planes sanitarios sobre los caballos propios del veterinario.
--
-- `trabajo_sanitario.sociedad_id` era NOT NULL, así que la tabla no podía
-- representar un plan sobre un caballo que no es de ninguna empresa. Los
-- caballos propios del vet se modelan con `sociedad_id NULL` + `vet_owner_id`,
-- con lo cual el vet no podía programarles nada: el modal cortaba con "No se
-- pudo determinar la empresa de algunos caballos". Al momento de esta
-- migración eran 37 de los 56 caballos activos.
--
-- Se replica en `trabajo_sanitario` el mismo modelo que ya usa `caballo`:
-- o pertenece a una sociedad, o a un veterinario.

-- ── 1. Columnas ──────────────────────────────────────────────────────────────

ALTER TABLE trabajo_sanitario ALTER COLUMN sociedad_id DROP NOT NULL;

ALTER TABLE trabajo_sanitario
  ADD COLUMN vet_owner_id UUID REFERENCES usuario(id);

COMMENT ON COLUMN trabajo_sanitario.vet_owner_id IS
  'Veterinario dueño del plan, cuando es sobre sus caballos propios. Excluyente con sociedad_id.';

-- A diferencia de `caballo`, donde el invariante quedó implícito, acá se
-- explicita: todas las policies y funciones ramifican por esto.
ALTER TABLE trabajo_sanitario
  ADD CONSTRAINT trabajo_sanitario_duenio_check
  CHECK (num_nonnulls(sociedad_id, vet_owner_id) = 1);

CREATE INDEX idx_trabajo_sanitario_vet_owner
  ON trabajo_sanitario (vet_owner_id)
  WHERE vet_owner_id IS NOT NULL;

-- ── 2. Policies ──────────────────────────────────────────────────────────────

-- `tiene_membresia(NULL)` devuelve false, así que sin la rama del dueño vet
-- estos planes serían invisibles hasta para quien los creó.
DROP POLICY IF EXISTS trabajo_sanitario_select ON trabajo_sanitario;
CREATE POLICY trabajo_sanitario_select ON trabajo_sanitario
  FOR SELECT
  USING (
    tiene_membresia(sociedad_id)
    OR is_superadmin()
    OR creado_por     = auth.uid()
    OR compartido_con = auth.uid()
    OR vet_owner_id   = auth.uid()
  );

DROP POLICY IF EXISTS trabajo_sanitario_update ON trabajo_sanitario;
CREATE POLICY trabajo_sanitario_update ON trabajo_sanitario
  FOR UPDATE
  USING (
    tiene_membresia(sociedad_id)
    OR is_superadmin()
    OR creado_por     = auth.uid()
    OR compartido_con = auth.uid()
    OR vet_owner_id   = auth.uid()
  )
  WITH CHECK (
    tiene_membresia(sociedad_id)
    OR is_superadmin()
    OR creado_por     = auth.uid()
    OR compartido_con = auth.uid()
    OR vet_owner_id   = auth.uid()
  );

DROP POLICY IF EXISTS trabajo_sanitario_insert ON trabajo_sanitario;
CREATE POLICY trabajo_sanitario_insert ON trabajo_sanitario
  FOR INSERT
  WITH CHECK (
    creado_por = auth.uid()
    AND (
      tiene_membresia(sociedad_id)
      OR vet_owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
          FROM acceso_vet av
          JOIN caballo c ON c.id = av.caballo_id
         WHERE av.vet_id = auth.uid()
           AND av.activo
           AND c.sociedad_id = trabajo_sanitario.sociedad_id
      )
    )
  );

DROP POLICY IF EXISTS trabajo_sanitario_delete ON trabajo_sanitario;
CREATE POLICY trabajo_sanitario_delete ON trabajo_sanitario
  FOR DELETE
  USING (es_admin(sociedad_id) OR is_superadmin() OR vet_owner_id = auth.uid());

DROP POLICY IF EXISTS trabajo_sanitario_caballo_all ON trabajo_sanitario_caballo;
CREATE POLICY trabajo_sanitario_caballo_all ON trabajo_sanitario_caballo
  FOR ALL
  USING (
    vet_tiene_acceso(caballo_id)
    OR EXISTS (
      SELECT 1 FROM trabajo_sanitario t
       WHERE t.id = trabajo_sanitario_caballo.trabajo_id
         AND (tiene_membresia(t.sociedad_id)
              OR is_superadmin()
              OR t.creado_por     = auth.uid()
              OR t.compartido_con = auth.uid()
              OR t.vet_owner_id   = auth.uid())
    )
  )
  WITH CHECK (
    vet_tiene_acceso(caballo_id)
    OR EXISTS (
      SELECT 1 FROM trabajo_sanitario t
       WHERE t.id = trabajo_sanitario_caballo.trabajo_id
         AND (tiene_membresia(t.sociedad_id)
              OR is_superadmin()
              OR t.creado_por     = auth.uid()
              OR t.compartido_con = auth.uid()
              OR t.vet_owner_id   = auth.uid())
    )
  );

-- El guard de `compartido_con` también tiene que contemplar al dueño vet.
CREATE OR REPLACE FUNCTION trg_trabajo_sanitario_compartir()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.compartido_con IS DISTINCT FROM OLD.compartido_con
     AND NOT (tiene_membresia(NEW.sociedad_id)
              OR is_superadmin()
              OR OLD.creado_por   = auth.uid()
              OR OLD.vet_owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Solo la empresa o el autor del plan pueden cambiar con quién está compartido';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. Creación ──────────────────────────────────────────────────────────────

-- `p_items`: [{ sociedad_id, nombre, fecha_programada, tratamiento,
--               observaciones, caballo_ids: [...] }, ...]
-- `sociedad_id` NULL = plan sobre los caballos propios del veterinario.
CREATE OR REPLACE FUNCTION crear_plan_sanitario_compartido(
  p_items          JSONB,
  p_vet_id         UUID    DEFAULT NULL,
  p_otorgar_acceso BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_plan_id     UUID := gen_random_uuid();
  v_trabajo_ids UUID[] := '{}';
  v_trabajo_id  UUID;
  v_soc         UUID;
  v_owner       UUID;
  v_cabs        UUID[];
  v_ajenos      INTEGER;
  it            JSONB;
BEGIN
  IF JSONB_ARRAY_LENGTH(p_items) = 0 THEN
    RAISE EXCEPTION 'No hay trabajos para crear';
  END IF;

  FOR it IN SELECT * FROM JSONB_ARRAY_ELEMENTS(p_items)
  LOOP
    v_soc   := NULLIF(it->>'sociedad_id', '')::UUID;
    v_owner := NULL;

    SELECT ARRAY_AGG(cab::UUID) INTO v_cabs
      FROM JSONB_ARRAY_ELEMENTS_TEXT(it->'caballo_ids') AS cab;

    IF v_cabs IS NULL OR ARRAY_LENGTH(v_cabs, 1) IS NULL THEN
      RAISE EXCEPTION 'Un trabajo del plan vino sin caballos';
    END IF;

    IF v_soc IS NULL THEN
      -- Plan sobre caballos propios: el dueño es quien lo está creando.
      v_owner := v_uid;

      SELECT COUNT(*) INTO v_ajenos
        FROM UNNEST(v_cabs) AS cid
       WHERE NOT EXISTS (
         SELECT 1 FROM caballo c
          WHERE c.id = cid AND c.sociedad_id IS NULL AND c.vet_owner_id = v_uid
       );
      IF v_ajenos > 0 THEN
        RAISE EXCEPTION 'El plan incluye % caballo(s) que no son propios', v_ajenos;
      END IF;
    ELSE
      -- Mismo criterio que la RLS de INSERT de trabajo_sanitario.
      IF NOT (tiene_membresia(v_soc) OR EXISTS (
        SELECT 1 FROM acceso_vet av
          JOIN caballo c ON c.id = av.caballo_id
         WHERE av.vet_id = v_uid AND av.activo AND c.sociedad_id = v_soc
      )) THEN
        RAISE EXCEPTION 'Sin permiso para crear trabajos en esa empresa';
      END IF;

      -- Los caballos tienen que ser de la empresa del trabajo: la función es
      -- SECURITY DEFINER, así que la RLS de trabajo_sanitario_caballo no
      -- alcanza para impedir mezclar padrones.
      SELECT COUNT(*) INTO v_ajenos
        FROM UNNEST(v_cabs) AS cid
       WHERE NOT EXISTS (
         SELECT 1 FROM caballo c WHERE c.id = cid AND c.sociedad_id = v_soc
       );
      IF v_ajenos > 0 THEN
        RAISE EXCEPTION 'El plan incluye % caballo(s) que no son de esa empresa', v_ajenos;
      END IF;
    END IF;

    INSERT INTO trabajo_sanitario
      (plan_id, sociedad_id, vet_owner_id, nombre, fecha_programada,
       tratamiento, observaciones, creado_por)
    VALUES (
      v_plan_id,
      v_soc,
      v_owner,
      it->>'nombre',
      (it->>'fecha_programada')::DATE,
      NULLIF(it->>'tratamiento', ''),
      NULLIF(it->>'observaciones', ''),
      v_uid
    )
    RETURNING id INTO v_trabajo_id;

    INSERT INTO trabajo_sanitario_caballo (trabajo_id, caballo_id)
    SELECT v_trabajo_id, cid FROM UNNEST(v_cabs) AS cid;

    v_trabajo_ids := v_trabajo_ids || v_trabajo_id;
  END LOOP;

  IF p_vet_id IS NOT NULL THEN
    PERFORM compartir_trabajos_con_vet(v_trabajo_ids, p_vet_id, p_otorgar_acceso);
  END IF;

  RETURN v_plan_id;
END;
$$;

-- ── 4. Compartir: los planes de caballos propios quedan afuera ───────────────

CREATE OR REPLACE FUNCTION compartir_trabajos_con_vet(
  p_trabajo_ids     UUID[],
  p_vet_id          UUID,
  p_otorgar_acceso  BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_caballos   UUID[];
  v_faltantes  INTEGER;
  v_otorgados  INTEGER := 0;
  v_nombre     TEXT;
  v_plan       TEXT;
  v_fecha      DATE;
  v_soc        UUID;
BEGIN
  IF p_vet_id IS NULL THEN
    RAISE EXCEPTION 'Falta el veterinario';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM usuario u
     WHERE u.id = p_vet_id AND u.rol = 'veterinario' AND u.activo
  ) THEN
    RAISE EXCEPTION 'El usuario seleccionado no es un veterinario activo';
  END IF;

  -- Compartir un plan sobre caballos propios de un vet no está soportado:
  -- `caballos_sin_acceso_vet` filtra por membresía, así que no detectaría los
  -- accesos faltantes y el destinatario terminaría viendo el plan pero no los
  -- caballos. Si algún día se habilita, hay que resolver eso primero.
  IF EXISTS (
    SELECT 1 FROM trabajo_sanitario t
     WHERE t.id = ANY(p_trabajo_ids) AND t.vet_owner_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Los planes sobre caballos propios de un veterinario no se pueden compartir';
  END IF;

  IF EXISTS (
    SELECT 1 FROM trabajo_sanitario t
     WHERE t.id = ANY(p_trabajo_ids)
       AND NOT (tiene_membresia(t.sociedad_id) OR is_superadmin() OR t.creado_por = v_uid)
  ) THEN
    RAISE EXCEPTION 'Sin permiso para compartir alguno de estos trabajos';
  END IF;

  SELECT ARRAY_AGG(DISTINCT tsc.caballo_id)
    INTO v_caballos
    FROM trabajo_sanitario_caballo tsc
   WHERE tsc.trabajo_id = ANY(p_trabajo_ids);

  SELECT COUNT(*) INTO v_faltantes
    FROM caballos_sin_acceso_vet(p_vet_id, COALESCE(v_caballos, '{}'));

  IF v_faltantes > 0 AND NOT p_otorgar_acceso THEN
    RAISE EXCEPTION
      'El veterinario no tiene acceso a % caballo(s) del plan', v_faltantes;
  END IF;

  IF v_faltantes > 0 THEN
    INSERT INTO acceso_vet (vet_id, caballo_id, otorgado_por, activo)
    SELECT p_vet_id, s.caballo_id, v_uid, TRUE
      FROM caballos_sin_acceso_vet(p_vet_id, COALESCE(v_caballos, '{}')) s
    ON CONFLICT (vet_id, caballo_id) DO UPDATE
      SET activo = TRUE, otorgado_por = EXCLUDED.otorgado_por;
    GET DIAGNOSTICS v_otorgados = ROW_COUNT;
  END IF;

  UPDATE trabajo_sanitario
     SET compartido_con = p_vet_id
   WHERE id = ANY(p_trabajo_ids);

  SELECT STRING_AGG(DISTINCT t.nombre, ', '), MIN(t.fecha_programada), MIN(t.sociedad_id::TEXT)::UUID
    INTO v_plan, v_fecha, v_soc
    FROM trabajo_sanitario t
   WHERE t.id = ANY(p_trabajo_ids);

  SELECT s.nombre INTO v_nombre FROM sociedad s WHERE s.id = v_soc;

  INSERT INTO notificacion (usuario_id, sociedad_id, tipo, titulo, cuerpo, link)
  VALUES (
    p_vet_id,
    v_soc,
    'plan_sanitario_compartido',
    'Te asignaron un plan sanitario',
    COALESCE(v_nombre, 'Una empresa') || ' te asignó ' || COALESCE(v_plan, 'un plan sanitario')
      || ' sobre ' || COALESCE(ARRAY_LENGTH(v_caballos, 1), 0) || ' caballo(s)'
      || ' para el ' || TO_CHAR(v_fecha, 'DD/MM/YYYY') || '.',
    '/sanidad'
  );

  RETURN v_otorgados;
END;
$$;

-- ── 5. Cierre: el dueño vet puede completar sus propios planes ───────────────

CREATE OR REPLACE FUNCTION completar_trabajo_sanitario(p_trabajo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF NOT (tiene_membresia(v_trabajo.sociedad_id)
          OR is_superadmin()
          OR v_trabajo.compartido_con = v_uid
          OR v_trabajo.vet_owner_id   = v_uid) THEN
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
$function$;

CREATE OR REPLACE FUNCTION cerrar_plan_sanitario(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     UUID := auth.uid();
  v_count   INTEGER := 0;
  r         RECORD;
  v_trabajo trabajo_sanitario%ROWTYPE;
  v_tipo_id INTEGER;
  v_hist_id UUID;
  v_hist_actual UUID;
BEGIN
  FOR r IN
    SELECT (i->>'caballo_row_id')::uuid AS row_id,
           (i->>'estado')               AS estado
      FROM jsonb_array_elements(p_items) AS i
  LOOP
    IF r.estado NOT IN ('realizado', 'no_realizado', 'pendiente') THEN
      RAISE EXCEPTION 'Estado inválido: %', r.estado;
    END IF;

    SELECT t.* INTO v_trabajo
      FROM trabajo_sanitario_caballo tsc
      JOIN trabajo_sanitario t ON t.id = tsc.trabajo_id
     WHERE tsc.id = r.row_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fila de trabajo % no encontrada', r.row_id;
    END IF;

    IF NOT (tiene_membresia(v_trabajo.sociedad_id)
            OR is_superadmin()
            OR v_trabajo.creado_por     = v_uid
            OR v_trabajo.compartido_con = v_uid
            OR v_trabajo.vet_owner_id   = v_uid) THEN
      RAISE EXCEPTION 'Sin permiso sobre el trabajo %', v_trabajo.id;
    END IF;

    SELECT historial_id INTO v_hist_actual
      FROM trabajo_sanitario_caballo WHERE id = r.row_id;

    UPDATE trabajo_sanitario_caballo
       SET estado = r.estado, excluido = (r.estado <> 'realizado')
     WHERE id = r.row_id;

    IF r.estado = 'realizado' AND v_hist_actual IS NULL THEN
      INSERT INTO cat_tipo_consulta (nombre) VALUES (v_trabajo.nombre)
        ON CONFLICT (nombre) DO NOTHING;
      SELECT id INTO v_tipo_id FROM cat_tipo_consulta WHERE nombre = v_trabajo.nombre;

      INSERT INTO historial_clinico
        (caballo_id, tipo_consulta_id, fecha_consulta, tratamiento, observaciones, creado_por)
      SELECT tsc.caballo_id, v_tipo_id, NOW(), v_trabajo.tratamiento, v_trabajo.observaciones, v_uid
        FROM trabajo_sanitario_caballo tsc
       WHERE tsc.id = r.row_id
      RETURNING id INTO v_hist_id;

      UPDATE trabajo_sanitario_caballo SET historial_id = v_hist_id WHERE id = r.row_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  UPDATE trabajo_sanitario t
     SET estado = 'realizado', fecha_realizado = CURRENT_DATE
   WHERE t.estado = 'pendiente'
     AND NOT EXISTS (
       SELECT 1 FROM trabajo_sanitario_caballo tsc
        WHERE tsc.trabajo_id = t.id AND tsc.estado IS NULL
     )
     AND EXISTS (
       SELECT 1 FROM trabajo_sanitario_caballo tsc
        WHERE tsc.trabajo_id = t.id
          AND tsc.id IN (
            SELECT (i->>'caballo_row_id')::uuid FROM jsonb_array_elements(p_items) AS i
          )
     );

  RETURN v_count;
END;
$function$;
