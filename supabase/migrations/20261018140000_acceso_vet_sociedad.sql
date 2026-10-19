-- ============================================================================
-- Acceso total de veterinario a una sociedad
-- ============================================================================
-- Hoy el acceso vet→caballo es granular (tabla acceso_vet). Esta migración
-- agrega acceso_vet_sociedad: si un vet tiene una fila activa acá, ve TODOS
-- los caballos de esa sociedad (actuales y futuros) sin intervención del admin.
-- Se reescriben las funciones y policies que hoy usan acceso_vet para que
-- también miren acceso_vet_sociedad.
-- ============================================================================

-- ── 1a. Nueva tabla ─────────────────────────────────────────────────────────

CREATE TABLE acceso_vet_sociedad (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id       UUID NOT NULL REFERENCES usuario(id),
  sociedad_id  UUID NOT NULL REFERENCES sociedad(id),
  otorgado_por UUID REFERENCES usuario(id),
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vet_id, sociedad_id)
);

CREATE INDEX idx_avs_vet_activo ON acceso_vet_sociedad (vet_id) WHERE activo = TRUE;
ALTER TABLE acceso_vet_sociedad ENABLE ROW LEVEL SECURITY;

-- Admin de la sociedad y el propio vet pueden ver
CREATE POLICY "avs_select" ON acceso_vet_sociedad FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id) OR vet_id = auth.uid() OR is_superadmin());

-- Solo admin puede crear/modificar
CREATE POLICY "avs_insert" ON acceso_vet_sociedad FOR INSERT TO authenticated
  WITH CHECK (es_admin(sociedad_id) OR is_superadmin());

CREATE POLICY "avs_update" ON acceso_vet_sociedad FOR UPDATE TO authenticated
  USING (es_admin(sociedad_id) OR is_superadmin())
  WITH CHECK (es_admin(sociedad_id) OR is_superadmin());

-- ── 1b. Reescribir vet_tiene_acceso() ──────────────────────────────────────
-- Agrega rama de acceso total. Todas las RLS que ya usan esta función se
-- benefician automáticamente sin tocar nada más.

CREATE OR REPLACE FUNCTION vet_tiene_acceso(p_caballo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario u
    WHERE u.id = auth.uid() AND u.rol = 'veterinario' AND u.activo = TRUE
      AND (
        -- Acceso granular (caballo por caballo)
        EXISTS (
          SELECT 1 FROM acceso_vet av
          WHERE av.vet_id = auth.uid() AND av.caballo_id = p_caballo_id AND av.activo = TRUE
        )
        OR
        -- Acceso total a la sociedad del caballo
        EXISTS (
          SELECT 1 FROM acceso_vet_sociedad avs
          JOIN caballo c ON c.sociedad_id = avs.sociedad_id
          WHERE avs.vet_id = auth.uid() AND avs.activo = TRUE AND c.id = p_caballo_id
        )
      )
  );
$$;

-- ── 1c. Reescribir get_caballos_veterinario() con UNION ────────────────────

CREATE OR REPLACE FUNCTION get_caballos_veterinario()
RETURNS TABLE(
  id uuid, nombre text, fecha_nacimiento date, categoria text,
  rol_reproductivo text, estado_reproductivo text, prenada boolean,
  fecha_prenez date, numero_chip text, numero_registro text, activo boolean,
  sociedad_id uuid, empresa_nombre text, vet_owner_id uuid, campo_id uuid,
  raza_id integer, pelaje_id integer, padre_id uuid, padre_nombre text,
  madre_id uuid, madre_nombre text, raza_nombre text, pelaje_nombre text,
  campo_nombre text, propietario_nombre text, domador text, sexo text,
  observaciones text, tags jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  -- Bloque 1: acceso granular (como hoy)
  SELECT
    c.id, c.nombre, c.fecha_nacimiento,
    c.categoria, c.rol_reproductivo, c.estado_reproductivo,
    COALESCE(c.prenada, false), c.fecha_prenez,
    c.numero_chip, c.numero_registro,
    c.activo, c.sociedad_id,
    s.nombre, c.vet_owner_id,
    c.campo_id, c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre, pel.nombre, ca.nombre,
    pr.nombre, c.domador, c.sexo, c.observaciones,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ct.id, 'nombre', ct.nombre, 'color', ct.color, 'activo', ct.activo))
       FROM caballo_tag cta JOIN cat_tag ct ON ct.id = cta.tag_id
       WHERE cta.caballo_id = c.id),
      '[]'::jsonb
    )
  FROM acceso_vet av
  JOIN caballo c ON c.id = av.caballo_id
  LEFT JOIN sociedad s ON s.id = c.sociedad_id
  LEFT JOIN cat_raza r ON r.id = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN campo ca ON ca.id = c.campo_id
  LEFT JOIN propiedad pp ON pp.caballo_id = c.id AND pp.fecha_fin IS NULL
  LEFT JOIN propietario pr ON pr.id = pp.propietario_id
  WHERE av.vet_id = auth.uid() AND av.activo = true AND c.activo = true

  UNION

  -- Bloque 2: acceso total por sociedad
  SELECT
    c.id, c.nombre, c.fecha_nacimiento,
    c.categoria, c.rol_reproductivo, c.estado_reproductivo,
    COALESCE(c.prenada, false), c.fecha_prenez,
    c.numero_chip, c.numero_registro,
    c.activo, c.sociedad_id,
    s.nombre, c.vet_owner_id,
    c.campo_id, c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre, pel.nombre, ca.nombre,
    pr.nombre, c.domador, c.sexo, c.observaciones,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ct.id, 'nombre', ct.nombre, 'color', ct.color, 'activo', ct.activo))
       FROM caballo_tag cta JOIN cat_tag ct ON ct.id = cta.tag_id
       WHERE cta.caballo_id = c.id),
      '[]'::jsonb
    )
  FROM acceso_vet_sociedad avs
  JOIN caballo c ON c.sociedad_id = avs.sociedad_id
  LEFT JOIN sociedad s ON s.id = c.sociedad_id
  LEFT JOIN cat_raza r ON r.id = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN campo ca ON ca.id = c.campo_id
  LEFT JOIN propiedad pp ON pp.caballo_id = c.id AND pp.fecha_fin IS NULL
  LEFT JOIN propietario pr ON pr.id = pp.propietario_id
  WHERE avs.vet_id = auth.uid() AND avs.activo = true AND c.activo = true

  ORDER BY 2;  -- c.nombre (posición 2 del RETURNS TABLE, evita ambigüedad con s.nombre etc.)
$$;

-- ── 1d. Reescribir get_caballos_pedigree_vet() con UNION ───────────────────

CREATE OR REPLACE FUNCTION get_caballos_pedigree_vet()
RETURNS TABLE(id uuid, nombre text, categoria text, activo boolean, sociedad_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  -- Acceso granular
  SELECT c.id, c.nombre::TEXT, c.categoria::TEXT, c.activo, c.sociedad_id
  FROM acceso_vet av
  JOIN caballo c ON c.id = av.caballo_id
  WHERE av.vet_id = auth.uid() AND av.activo = TRUE

  UNION

  -- Acceso total por sociedad
  SELECT c.id, c.nombre::TEXT, c.categoria::TEXT, c.activo, c.sociedad_id
  FROM acceso_vet_sociedad avs
  JOIN caballo c ON c.sociedad_id = avs.sociedad_id
  WHERE avs.vet_id = auth.uid() AND avs.activo = TRUE

  ORDER BY 2;
$$;

-- ── 1e. Reescribir get_empresas_visibles() ─────────────────────────────────

CREATE OR REPLACE FUNCTION get_empresas_visibles()
RETURNS TABLE(id uuid, nombre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id, s.nombre::TEXT
    FROM sociedad s
   WHERE s.activa
     AND (
       tiene_membresia(s.id)
       OR EXISTS (
         SELECT 1
           FROM acceso_vet av
           JOIN caballo c ON c.id = av.caballo_id
          WHERE av.vet_id = auth.uid()
            AND av.activo
            AND c.sociedad_id = s.id
       )
       OR EXISTS (
         SELECT 1
           FROM acceso_vet_sociedad avs
          WHERE avs.vet_id = auth.uid()
            AND avs.activo
            AND avs.sociedad_id = s.id
       )
     )
   ORDER BY s.nombre;
$$;

-- ── 1f. Reescribir caballos_sin_acceso_vet() ───────────────────────────────

CREATE OR REPLACE FUNCTION caballos_sin_acceso_vet(p_vet_id uuid, p_caballo_ids uuid[])
RETURNS TABLE(caballo_id uuid, nombre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
     AND NOT EXISTS (
       SELECT 1 FROM acceso_vet_sociedad avs
        WHERE avs.vet_id      = p_vet_id
          AND avs.sociedad_id = c.sociedad_id
          AND avs.activo
     )
   ORDER BY c.nombre;
$$;

-- ── 1g. Policies inline con FROM acceso_vet — agregar OR acceso_vet_sociedad

-- historial_clinico_select
DROP POLICY IF EXISTS "historial_clinico_select" ON historial_clinico;
CREATE POLICY "historial_clinico_select" ON historial_clinico FOR SELECT TO authenticated
  USING (
    anulada_at IS NULL
    AND (
      tiene_membresia((SELECT c.sociedad_id FROM caballo c WHERE c.id = historial_clinico.caballo_id))
      OR EXISTS (
        SELECT 1 FROM acceso_vet av
        WHERE av.vet_id = auth.uid() AND av.caballo_id = historial_clinico.caballo_id AND av.activo = true
      )
      OR EXISTS (
        SELECT 1 FROM acceso_vet_sociedad avs
        JOIN caballo c ON c.sociedad_id = avs.sociedad_id
        WHERE avs.vet_id = auth.uid() AND avs.activo = true AND c.id = historial_clinico.caballo_id
      )
    )
  );

-- historial_parte_afectada_select
DROP POLICY IF EXISTS "historial_parte_afectada_select" ON historial_parte_afectada;
CREATE POLICY "historial_parte_afectada_select" ON historial_parte_afectada FOR SELECT TO authenticated
  USING (
    tiene_membresia((
      SELECT c.sociedad_id FROM caballo c
      JOIN historial_clinico h ON h.caballo_id = c.id
      WHERE h.id = historial_parte_afectada.historial_id
    ))
    OR EXISTS (
      SELECT 1 FROM acceso_vet av
      JOIN historial_clinico h ON h.id = historial_parte_afectada.historial_id
      WHERE av.vet_id = auth.uid() AND av.caballo_id = h.caballo_id AND av.activo = true
    )
    OR EXISTS (
      SELECT 1 FROM acceso_vet_sociedad avs
      JOIN historial_clinico h ON h.id = historial_parte_afectada.historial_id
      JOIN caballo c ON c.id = h.caballo_id AND c.sociedad_id = avs.sociedad_id
      WHERE avs.vet_id = auth.uid() AND avs.activo = true
    )
  );

-- historial_medicamento_select
DROP POLICY IF EXISTS "historial_medicamento_select" ON historial_medicamento;
CREATE POLICY "historial_medicamento_select" ON historial_medicamento FOR SELECT TO authenticated
  USING (
    tiene_membresia((
      SELECT c.sociedad_id FROM caballo c
      JOIN historial_clinico h ON h.caballo_id = c.id
      WHERE h.id = historial_medicamento.historial_id
    ))
    OR EXISTS (
      SELECT 1 FROM acceso_vet av
      JOIN historial_clinico h ON h.id = historial_medicamento.historial_id
      WHERE av.vet_id = auth.uid() AND av.caballo_id = h.caballo_id AND av.activo = true
    )
    OR EXISTS (
      SELECT 1 FROM acceso_vet_sociedad avs
      JOIN historial_clinico h ON h.id = historial_medicamento.historial_id
      JOIN caballo c ON c.id = h.caballo_id AND c.sociedad_id = avs.sociedad_id
      WHERE avs.vet_id = auth.uid() AND avs.activo = true
    )
  );

-- Storage: Ver fotos de caballos de vet
DROP POLICY IF EXISTS "Ver fotos de caballos de vet" ON storage.objects;
CREATE POLICY "Ver fotos de caballos de vet" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'caballos'
    AND (
      EXISTS (
        SELECT 1 FROM caballo c
        JOIN acceso_vet av ON av.caballo_id = c.id
        WHERE c.id = (storage.filename(objects.name))::uuid
          AND av.vet_id = auth.uid() AND av.activo = true
      )
      OR EXISTS (
        SELECT 1 FROM caballo c
        JOIN acceso_vet_sociedad avs ON avs.sociedad_id = c.sociedad_id
        WHERE c.id = (storage.filename(objects.name))::uuid
          AND avs.vet_id = auth.uid() AND avs.activo = true
      )
    )
  );

-- Storage: Eliminar fotos de caballos de vet
DROP POLICY IF EXISTS "Eliminar fotos de caballos de vet" ON storage.objects;
CREATE POLICY "Eliminar fotos de caballos de vet" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'caballos'
    AND (
      EXISTS (
        SELECT 1 FROM caballo c
        JOIN acceso_vet av ON av.caballo_id = c.id
        WHERE c.id = (storage.filename(objects.name))::uuid
          AND av.vet_id = auth.uid() AND av.activo = true
      )
      OR EXISTS (
        SELECT 1 FROM caballo c
        JOIN acceso_vet_sociedad avs ON avs.sociedad_id = c.sociedad_id
        WHERE c.id = (storage.filename(objects.name))::uuid
          AND avs.vet_id = auth.uid() AND avs.activo = true
      )
    )
  );

-- ── 1h. superadmin_eliminar_usuario() — limpiar acceso total ────────────────
-- Se reescribe completa para agregar DELETE FROM acceso_vet_sociedad

CREATE OR REPLACE FUNCTION superadmin_eliminar_usuario(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
  DECLARE
    v_rol       TEXT;
    v_email     TEXT;
    v_caballos  UUID[];
    v_bloqueos  TEXT[] := '{}';
    v_n         INTEGER;
    v_borrados  JSONB;
  BEGIN
    IF NOT is_superadmin() THEN
      RAISE EXCEPTION 'No autorizado.' USING ERRCODE = 'HM403';
    END IF;

    IF p_usuario_id = auth.uid() THEN
      RAISE EXCEPTION 'No podés eliminar tu propio usuario.' USING ERRCODE = 'HM400';
    END IF;

    SELECT rol, email INTO v_rol, v_email FROM usuario WHERE id = p_usuario_id;
    IF v_rol IS NULL THEN
      RAISE EXCEPTION 'El usuario no existe o ya fue eliminado.' USING ERRCODE = 'HM404';
    END IF;

    IF v_rol = 'superadmin' THEN
      RAISE EXCEPTION 'No se puede eliminar a otro superadmin desde el panel.' USING ERRCODE = 'HM400';
    END IF;

    SELECT COALESCE(array_agg(id), '{}') INTO v_caballos
    FROM caballo
    WHERE vet_owner_id = p_usuario_id AND sociedad_id IS NULL;

    SELECT COUNT(*) INTO v_n FROM membresia WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s membresía(s) en empresas', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM pago_veterinario WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s pago(s) registrado(s)', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n
    FROM historial_clinico
    WHERE creado_por = p_usuario_id OR caballo_id = ANY(v_caballos);
    IF v_n > 0 THEN
      DECLARE v_en_plan INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_en_plan
        FROM trabajo_sanitario_caballo tsc
        JOIN historial_clinico h ON h.id = tsc.historial_id
        WHERE h.creado_por = p_usuario_id OR h.caballo_id = ANY(v_caballos);

        v_bloqueos := v_bloqueos || format(
          '%s consulta(s) de historial clínico (no se eliminan nunca)%s',
          v_n,
          CASE WHEN v_en_plan > 0
            THEN format(', de las cuales %s están enganchadas a un plan sanitario', v_en_plan)
            ELSE '' END
        );
      END;
    END IF;

    SELECT COUNT(*) INTO v_n FROM propiedad WHERE registrado_por = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s registro(s) de propiedad', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM torneo WHERE creado_por = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s torneo(s) creado(s)', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM torneo_jugador WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s participación(es) en torneos', v_n);
    END IF;

    SELECT
      (SELECT COUNT(*) FROM cria_registro_clinico
        WHERE caballo_id = ANY(v_caballos) OR padrillo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_ecografia
        WHERE caballo_receptora_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_flushing
        WHERE caballo_id = ANY(v_caballos) OR padrillo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_transferencia
        WHERE caballo_donante_id = ANY(v_caballos)
           OR caballo_receptora_id = ANY(v_caballos)
           OR padrillo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_estado_transicion WHERE caballo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_recordatorio WHERE caballo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM embrion
        WHERE padrillo_id = ANY(v_caballos) OR caballo_donante_id = ANY(v_caballos))
    INTO v_n;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s registro(s) de centro de cría sobre sus propios caballos', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n
    FROM caballo c
    WHERE (c.padre_id = ANY(v_caballos) OR c.madre_id = ANY(v_caballos))
      AND NOT (c.id = ANY(v_caballos));
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s caballo(s) de terceros lo usan en su pedigree', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n
    FROM caballo c
    WHERE c.campo_id IN (SELECT id FROM campo WHERE vet_owner_id = p_usuario_id)
      AND NOT (c.id = ANY(v_caballos));
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s caballo(s) de terceros están en un campo suyo', v_n);
    END IF;

    IF array_length(v_bloqueos, 1) > 0 THEN
      RAISE EXCEPTION
        'No se puede eliminar a % porque dejó datos que no se pueden borrar: %. Hay que resolverlos a mano antes.',
        v_email, array_to_string(v_bloqueos, '; ')
        USING ERRCODE = 'HM409';
    END IF;

    v_borrados := jsonb_build_object(
      'email',    v_email,
      'caballos', COALESCE(array_length(v_caballos, 1), 0),
      'campos',   (SELECT COUNT(*) FROM campo WHERE vet_owner_id = p_usuario_id)
    );

    UPDATE trabajo_sanitario      SET creado_por     = NULL WHERE creado_por     = p_usuario_id;
    UPDATE cria_registro_clinico  SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_ecografia         SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_flushing          SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_transferencia     SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_estado_transicion SET creado_por      = NULL WHERE creado_por     = p_usuario_id;
    UPDATE cria_recordatorio      SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_padrillo_preferido SET creado_por     = NULL WHERE creado_por    = p_usuario_id;

    IF array_length(v_caballos, 1) > 0 THEN
      DELETE FROM venta_caballo             WHERE caballo_id = ANY(v_caballos);
      DELETE FROM trabajo_sanitario_caballo WHERE caballo_id = ANY(v_caballos);
      DELETE FROM propiedad                 WHERE caballo_id = ANY(v_caballos);
      DELETE FROM acceso_vet                WHERE caballo_id = ANY(v_caballos);
      DELETE FROM caballo                   WHERE id = ANY(v_caballos);
    END IF;

    DELETE FROM trabajo_sanitario_caballo
    WHERE trabajo_id IN (SELECT id FROM trabajo_sanitario WHERE vet_owner_id = p_usuario_id);
    DELETE FROM trabajo_sanitario WHERE vet_owner_id = p_usuario_id;

    DELETE FROM campo WHERE vet_owner_id = p_usuario_id;

    DELETE FROM acceso_vet WHERE vet_id = p_usuario_id;
    UPDATE acceso_vet SET otorgado_por = NULL WHERE otorgado_por = p_usuario_id;

    -- ▸ NUEVO: limpiar acceso total a sociedades
    DELETE FROM acceso_vet_sociedad WHERE vet_id = p_usuario_id;
    UPDATE acceso_vet_sociedad SET otorgado_por = NULL WHERE otorgado_por = p_usuario_id;

    DELETE FROM suscripcion_veterinario WHERE usuario_id = p_usuario_id;
    UPDATE suscripcion_veterinario SET activado_por = NULL WHERE activado_por = p_usuario_id;

    UPDATE caballo_tag SET creado_por = NULL WHERE creado_por = p_usuario_id;

    DELETE FROM usuario WHERE id = p_usuario_id;

    RETURN v_borrados;
  END;
$$;
