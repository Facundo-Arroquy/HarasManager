-- Compartir un plan sanitario con un veterinario.
--
-- Hasta acá el veterinario solo veía los trabajos que él mismo había creado: la
-- RLS de `trabajo_sanitario` mira membresía y autoría, nunca los caballos de
-- adentro. Tener `acceso_vet` sobre todos los caballos del plan no alcanzaba.
--
-- Se agrega `compartido_con` (un solo vet por plan) y se lo suma a las policies
-- y a las dos funciones de cierre, para que el vet no solo vea el plan sino que
-- pueda completarlo.

-- ── 1. Columna ───────────────────────────────────────────────────────────────

ALTER TABLE trabajo_sanitario
  ADD COLUMN compartido_con UUID REFERENCES usuario(id) ON DELETE SET NULL;

COMMENT ON COLUMN trabajo_sanitario.compartido_con IS
  'Veterinario con el que se compartió el plan. Ve el trabajo y puede cerrarlo.';

CREATE INDEX idx_trabajo_sanitario_compartido_con
  ON trabajo_sanitario (compartido_con)
  WHERE compartido_con IS NOT NULL;

-- ── 2. Policies de trabajo_sanitario ─────────────────────────────────────────

DROP POLICY IF EXISTS trabajo_sanitario_select ON trabajo_sanitario;
CREATE POLICY trabajo_sanitario_select ON trabajo_sanitario
  FOR SELECT
  USING (
    tiene_membresia(sociedad_id)
    OR is_superadmin()
    OR creado_por     = auth.uid()
    OR compartido_con = auth.uid()
  );

DROP POLICY IF EXISTS trabajo_sanitario_update ON trabajo_sanitario;
CREATE POLICY trabajo_sanitario_update ON trabajo_sanitario
  FOR UPDATE
  USING (
    tiene_membresia(sociedad_id)
    OR is_superadmin()
    OR creado_por     = auth.uid()
    OR compartido_con = auth.uid()
  )
  WITH CHECK (
    tiene_membresia(sociedad_id)
    OR is_superadmin()
    OR creado_por     = auth.uid()
    OR compartido_con = auth.uid()
  );

-- El vet compartido puede cerrar el plan, pero no re-compartirlo: sin esto,
-- con la policy de UPDATE le alcanzaría para reasignar `compartido_con` a otro.
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
              OR OLD.creado_por = auth.uid()) THEN
    RAISE EXCEPTION 'Solo la empresa o el autor del plan pueden cambiar con quién está compartido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trabajo_sanitario_compartir_guard
  BEFORE UPDATE ON trabajo_sanitario
  FOR EACH ROW
  EXECUTE FUNCTION trg_trabajo_sanitario_compartir();

-- La policy de `trabajo_sanitario_caballo` repite inline el criterio del padre.
-- Se le suma `compartido_con` para que el vet llegue a las filas incluso si
-- todavía no tiene `acceso_vet` sobre algún caballo.
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
              OR t.compartido_con = auth.uid())
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
              OR t.compartido_con = auth.uid())
    )
  );

-- ── 3. Notificaciones in-app ─────────────────────────────────────────────────

-- Tabla genérica a propósito: el plan sanitario es el primer emisor, pero la
-- idea es que después la usen transferencias, accesos y vencimientos.
-- `sociedad_id` es nullable (a diferencia del resto del modelo multi-tenant):
-- una notificación pertenece a un usuario, y el veterinario no tiene sociedad.
CREATE TABLE notificacion (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  sociedad_id UUID REFERENCES sociedad(id) ON DELETE SET NULL,
  tipo        TEXT NOT NULL,
  titulo      TEXT NOT NULL,
  cuerpo      TEXT,
  link        TEXT,
  leida       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notificacion_usuario_pendiente
  ON notificacion (usuario_id, created_at DESC);

ALTER TABLE notificacion ENABLE ROW LEVEL SECURITY;

-- Sin policy de INSERT: las notificaciones las escriben solo las funciones
-- SECURITY DEFINER, nunca el cliente.
CREATE POLICY notificacion_select ON notificacion
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY notificacion_update ON notificacion
  FOR UPDATE USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- ── 4. Caballos del plan a los que el vet todavía no tiene acceso ────────────

-- La usa el front antes de crear/compartir, para armar el cartel de
-- confirmación. Devuelve solo caballos sobre los que el que pregunta tiene
-- membresía: no sirve para espiar el padrón de otra empresa.
CREATE OR REPLACE FUNCTION caballos_sin_acceso_vet(
  p_vet_id      UUID,
  p_caballo_ids UUID[]
)
RETURNS TABLE (caballo_id UUID, nombre TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, COALESCE(c.nombre, c.numero_registro, 'Sin nombre')::TEXT
    FROM caballo c
   WHERE c.id = ANY(p_caballo_ids)
     AND (tiene_membresia(c.sociedad_id) OR is_superadmin())
     AND NOT EXISTS (
       SELECT 1 FROM acceso_vet av
        WHERE av.vet_id     = p_vet_id
          AND av.caballo_id = c.id
          AND av.activo
     )
   ORDER BY c.nombre;
$$;

-- ── 5. Otorgar acceso + notificar (interna) ──────────────────────────────────

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

  -- Un solo criterio de permiso para todos los trabajos del lote.
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

  -- Un solo aviso por lote, aunque el plan tenga varios trabajos.
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

-- ── 6. Crear el plan y compartirlo, en una sola transacción ──────────────────

-- `p_items`: [{ sociedad_id, nombre, fecha_programada, tratamiento,
--               observaciones, caballo_ids: [...] }, ...]
-- Devuelve el `plan_id` que agrupa todos los trabajos creados.
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
  it            JSONB;
BEGIN
  IF JSONB_ARRAY_LENGTH(p_items) = 0 THEN
    RAISE EXCEPTION 'No hay trabajos para crear';
  END IF;

  FOR it IN SELECT * FROM JSONB_ARRAY_ELEMENTS(p_items)
  LOOP
    v_soc := (it->>'sociedad_id')::UUID;

    -- Mismo criterio que la RLS de INSERT de trabajo_sanitario.
    IF NOT (tiene_membresia(v_soc) OR EXISTS (
      SELECT 1 FROM acceso_vet av
        JOIN caballo c ON c.id = av.caballo_id
       WHERE av.vet_id = v_uid AND av.activo AND c.sociedad_id = v_soc
    )) THEN
      RAISE EXCEPTION 'Sin permiso para crear trabajos en esa empresa';
    END IF;

    INSERT INTO trabajo_sanitario
      (plan_id, sociedad_id, nombre, fecha_programada, tratamiento, observaciones, creado_por)
    VALUES (
      v_plan_id,
      v_soc,
      it->>'nombre',
      (it->>'fecha_programada')::DATE,
      NULLIF(it->>'tratamiento', ''),
      NULLIF(it->>'observaciones', ''),
      v_uid
    )
    RETURNING id INTO v_trabajo_id;

    INSERT INTO trabajo_sanitario_caballo (trabajo_id, caballo_id)
    SELECT v_trabajo_id, (cab)::UUID
      FROM JSONB_ARRAY_ELEMENTS_TEXT(it->'caballo_ids') AS cab;

    v_trabajo_ids := v_trabajo_ids || v_trabajo_id;
  END LOOP;

  -- Si esto levanta excepción, se cae también la creación del plan: es
  -- exactamente el "rollback" que necesitábamos, sin tener que deshacer nada
  -- desde el front.
  IF p_vet_id IS NOT NULL THEN
    PERFORM compartir_trabajos_con_vet(v_trabajo_ids, p_vet_id, p_otorgar_acceso);
  END IF;

  RETURN v_plan_id;
END;
$$;

-- ── 7. El vet compartido también puede cerrar el trabajo ─────────────────────

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
          OR v_trabajo.compartido_con = v_uid) THEN
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

    -- Mismo criterio que la RLS de trabajo_sanitario: miembro de la sociedad,
    -- superadmin, el veterinario que lo creó, o aquel con quien se compartió.
    IF NOT (tiene_membresia(v_trabajo.sociedad_id)
            OR is_superadmin()
            OR v_trabajo.creado_por     = v_uid
            OR v_trabajo.compartido_con = v_uid) THEN
      RAISE EXCEPTION 'Sin permiso sobre el trabajo %', v_trabajo.id;
    END IF;

    SELECT historial_id INTO v_hist_actual
      FROM trabajo_sanitario_caballo WHERE id = r.row_id;

    -- `excluido` se mantiene en línea con el estado para el flujo viejo de Sanidad.
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
