-- Registro clinico y mantenimiento de recordatorios en una unica transaccion.
-- Toda regla temporal se obtiene de get_configuracion_cria_efectiva para no
-- repetir defaults en esta RPC ni en el frontend.

CREATE OR REPLACE FUNCTION public.registrar_acto_reproductivo(
  p_caballo_id uuid,
  p_sociedad_id uuid,
  p_fecha date,
  p_ovario_izq text[],
  p_ovario_der text[],
  p_utero text[],
  p_obs_chips text[],
  p_observaciones text,
  p_veterinario_id uuid,
  p_rol_reproductivo text,
  p_padrillo_id uuid DEFAULT NULL,
  p_ov_dias smallint DEFAULT NULL,
  p_review_dias smallint DEFAULT NULL,
  p_review_desc text DEFAULT NULL,
  p_fecha_flushing_programada date DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_diagnostico text DEFAULT NULL,
  p_tratamiento text DEFAULT NULL,
  p_origen_recordatorio_id uuid DEFAULT NULL,
  p_ajustes_fin_semana jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_registro_id uuid;
  v_cfg jsonb;
  v_caballo public.caballo%ROWTYPE;
  v_tiene_ov boolean;
  v_inseminada boolean;
  v_fecha_vto date;
  v_tipo_existente boolean;
  v_regla record;
  v_ajuste record;
  v_afectados uuid[] := ARRAY[]::uuid[];
  v_ids uuid[];
  v_recordatorio_id uuid;
  v_registro jsonb;
  v_recordatorios jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesion no autenticada';
  END IF;

  IF v_uid IS DISTINCT FROM p_veterinario_id
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'No autorizado para registrar por otro veterinario';
  END IF;

  IF p_rol_reproductivo NOT IN ('Donante', 'Receptora') THEN
    RAISE EXCEPTION 'Rol reproductivo invalido';
  END IF;

  IF p_review_dias IS NOT NULL AND p_review_dias NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Los dias de revision deben estar entre 1 y 60';
  END IF;

  FOR v_ajuste IN SELECT key, value FROM jsonb_each_text(COALESCE(p_ajustes_fin_semana, '{}'::jsonb))
  LOOP
    IF v_ajuste.value::integer NOT BETWEEN -1 AND 1 THEN
      RAISE EXCEPTION 'Ajuste de fin de semana invalido para %', v_ajuste.key;
    END IF;
  END LOOP;

  SELECT * INTO v_caballo
  FROM public.caballo
  WHERE id = p_caballo_id
  FOR SHARE;

  IF NOT FOUND OR v_caballo.sociedad_id IS DISTINCT FROM p_sociedad_id THEN
    RAISE EXCEPTION 'Caballo inexistente o no pertenece a la sociedad';
  END IF;

  IF NOT public.is_superadmin() AND NOT public.vet_tiene_acceso(p_caballo_id) THEN
    RAISE EXCEPTION 'Sin acceso veterinario al caballo';
  END IF;

  IF v_caballo.rol_reproductivo IS NOT NULL
     AND v_caballo.rol_reproductivo IS DISTINCT FROM p_rol_reproductivo THEN
    RAISE EXCEPTION 'El rol reproductivo no coincide con el caballo';
  END IF;

  v_cfg := public.get_configuracion_cria_efectiva(p_veterinario_id);

  INSERT INTO public.cria_registro_clinico (
    caballo_id, sociedad_id, fecha, veterinario_id,
    ovario_izq, ovario_der, utero, obs_chips, padrillo_id, ov_dias,
    review_dias, review_desc, fecha_flushing_programada,
    motivo, diagnostico, tratamiento, observaciones,
    origen_recordatorio_id
  ) VALUES (
    p_caballo_id, p_sociedad_id, p_fecha, p_veterinario_id,
    COALESCE(p_ovario_izq, '{}'), COALESCE(p_ovario_der, '{}'),
    COALESCE(p_utero, '{}'), COALESCE(p_obs_chips, '{}'), p_padrillo_id, p_ov_dias,
    p_review_dias, p_review_desc, p_fecha_flushing_programada,
    p_motivo, p_diagnostico, p_tratamiento, p_observaciones,
    p_origen_recordatorio_id
  )
  RETURNING id INTO v_registro_id;

  -- Mismo criterio que actoResuelveRecordatorio para actos de clase registro.
  WITH actualizados AS (
    UPDATE public.cria_recordatorio
    SET estado = 'hecho', updated_at = now()
    WHERE caballo_id = p_caballo_id
      AND fecha_vto = p_fecha
      AND estado IN ('pendiente', 'vencido')
      AND (
        tipo = 'Revisión'
        OR (tipo LIKE 'Revisión %' AND tipo <> 'Revisión Eco')
        OR (tipo = 'Dar PG' AND (ARRAY['PG', '1PG']::text[] && COALESCE(p_obs_chips, '{}')))
        OR tipo = ANY(COALESCE(p_obs_chips, '{}'))
      )
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM actualizados;
  v_afectados := v_afectados || v_ids;

  v_tiene_ov := 'OV' = ANY(COALESCE(p_ovario_izq, '{}'))
             OR 'OV' = ANY(COALESCE(p_ovario_der, '{}'));
  v_inseminada := 'IN' = ANY(COALESCE(p_obs_chips, '{}'));

  IF NOT v_inseminada AND p_rol_reproductivo = 'Donante' AND v_tiene_ov THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.cria_registro_clinico
      WHERE caballo_id = p_caballo_id
        AND id <> v_registro_id
        AND fecha BETWEEN
          (p_fecha - ((v_cfg->'ventana_inseminacion_dias'->>'valor')::integer))
          AND p_fecha
        AND 'IN' = ANY(obs_chips)
    ) INTO v_inseminada;
  END IF;

  IF p_review_dias IS NOT NULL THEN
    WITH cancelados AS (
      UPDATE public.cria_recordatorio
      SET estado = 'cancelado',
          cancel_motivo = 'Reemplazada por la revisión programada en un registro más nuevo',
          updated_at = now()
      WHERE caballo_id = p_caballo_id
        AND tipo = 'Revisión'
        AND estado IN ('pendiente', 'vencido')
      RETURNING id
    )
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM cancelados;
    v_afectados := v_afectados || v_ids;
  END IF;

  IF p_rol_reproductivo = 'Donante' THEN
    IF 'Strelin' = ANY(COALESCE(p_obs_chips, '{}'))
       AND NOT ('IN' = ANY(COALESCE(p_obs_chips, '{}'))) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_strelin_a_in'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'IN')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'IN', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF 'IN' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_in_a_oxi'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'OXI')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'OXI', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF 'OXI' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_oxi_a_revision'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Revisión')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF v_tiene_ov THEN
      IF v_inseminada THEN
        v_fecha_vto := COALESCE(
          p_fecha_flushing_programada,
          p_fecha + ((v_cfg->'donante_ov_a_flushing'->>'valor')::integer)
        ) + COALESCE((p_ajustes_fin_semana->>'Flushing')::integer, 0);
        INSERT INTO public.cria_recordatorio
          (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
        VALUES (p_caballo_id, p_sociedad_id, 'Flushing', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
        RETURNING id INTO v_recordatorio_id;
        v_afectados := array_append(v_afectados, v_recordatorio_id);
      ELSE
        v_fecha_vto := p_fecha + ((v_cfg->'donante_ov_sin_in_a_dar_pg'->>'valor')::integer)
          + COALESCE((p_ajustes_fin_semana->>'Dar PG')::integer, 0);
        INSERT INTO public.cria_recordatorio
          (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
        VALUES (p_caballo_id, p_sociedad_id, 'Dar PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
        RETURNING id INTO v_recordatorio_id;
        v_afectados := array_append(v_afectados, v_recordatorio_id);
      END IF;
    END IF;

    IF ARRAY['PG', '1PG']::text[] && COALESCE(p_obs_chips, '{}') THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_pg_a_revision_pg'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Revisión PG')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF 'Flushing' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_flushing_a_revision'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Revisión Flushing')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión Flushing', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;
  END IF;

  IF p_rol_reproductivo = 'Receptora' THEN
    IF 'Strelin' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + 1;
      WHILE EXTRACT(ISODOW FROM v_fecha_vto)::integer NOT IN (1, 3, 5) LOOP
        v_fecha_vto := v_fecha_vto + 1;
      END LOOP;
      v_fecha_vto := v_fecha_vto + COALESCE((p_ajustes_fin_semana->>'Revisión Strelin')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión Strelin', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF ARRAY['PG', '1PG']::text[] && COALESCE(p_obs_chips, '{}') THEN
      v_fecha_vto := p_fecha + ((v_cfg->'receptora_pg_a_revision_pg'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Revisión PG')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo,fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF v_tiene_ov AND NOT ('Transferida' = ANY(COALESCE(p_obs_chips, '{}'))) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'receptora_ov_a_dar_pg'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Dar PG')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Dar PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;
  END IF;

  FOR v_regla IN
    SELECT accion_recordatorio, dias
    FROM public.cria_regla_recordatorio
    WHERE veterinario_id = p_veterinario_id
      AND (rol = 'Ambas' OR rol = p_rol_reproductivo)
      AND accion_disparadora = ANY(COALESCE(p_obs_chips, '{}'))
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.cria_recordatorio
      WHERE origen_registro_id = v_registro_id
        AND tipo = v_regla.accion_recordatorio
    ) INTO v_tipo_existente;

    IF NOT v_tipo_existente THEN
      v_fecha_vto := p_fecha + v_regla.dias
        + COALESCE((p_ajustes_fin_semana->>v_regla.accion_recordatorio)::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, v_regla.accion_recordatorio, v_fecha_vto,
              'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;
  END LOOP;

  IF p_review_dias IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cria_recordatorio
    WHERE origen_registro_id = v_registro_id AND tipo = 'Revisión'
  ) THEN
    v_fecha_vto := p_fecha + p_review_dias
      + COALESCE((p_ajustes_fin_semana->>'Revisión')::integer, 0);
    INSERT INTO public.cria_recordatorio
      (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
    VALUES (p_caballo_id, p_sociedad_id, 'Revisión', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
    RETURNING id INTO v_recordatorio_id;
    v_afectados := array_append(v_afectados, v_recordatorio_id);
  END IF;

  SELECT to_jsonb(r)
         || jsonb_build_object(
              'caballo', jsonb_build_object('nombre', c.nombre, 'rol_reproductivo', c.rol_reproductivo),
              'veterinario', jsonb_build_object('nombre', u.nombre, 'apellido', u.apellido),
              'padrillo', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('nombre', p.nombre) END
            )
    INTO v_registro
  FROM public.cria_registro_clinico r
  JOIN public.caballo c ON c.id = r.caballo_id
  LEFT JOIN public.usuario u ON u.id = r.veterinario_id
  LEFT JOIN public.caballo p ON p.id = r.padrillo_id
  WHERE r.id = v_registro_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(rec) ORDER BY rec.created_at), '[]'::jsonb)
    INTO v_recordatorios
  FROM public.cria_recordatorio rec
  WHERE rec.id = ANY(v_afectados);

  RETURN jsonb_build_object(
    'registro', v_registro,
    'recordatorios', v_recordatorios
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acto_reproductivo(
  uuid, uuid, date, text[], text[], text[], text[], text, uuid, text,
  uuid, smallint, smallint, text, date, text, text, text, uuid, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acto_reproductivo(
  uuid, uuid, date, text[], text[], text[], text[], text, uuid, text,
  uuid, smallint, smallint, text, date, text, text, text, uuid, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.registrar_acto_reproductivo(
  uuid, uuid, date, text[], text[], text[], text[], text, uuid, text,
  uuid, smallint, smallint, text, date, text, text, text, uuid, jsonb
) IS 'Registra un acto reproductivo y actualiza/genera sus recordatorios atomicamente.';
