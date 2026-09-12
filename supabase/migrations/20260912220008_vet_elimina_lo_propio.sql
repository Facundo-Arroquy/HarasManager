-- Cada vet puede eliminar lo que cargó (consultas, trabajos y registros del
-- Centro de Cría). Tres criterios distintos, acordados con producto:
--   * Consulta realizada: anulación lógica. El historial clínico no se borra;
--     la fila queda (y en auditoría) pero deja de verse en toda la app.
--   * Trabajo sanitario: el autor lo borra aunque esté realizado. Las consultas
--     que generó al cerrarse quedan en el historial de cada caballo.
--   * Centro de Cría: solo sin dependencias. Cada RPC deshace los efectos
--     directos del alta y aborta con un mensaje claro si algo cuelga del registro.

-- ── A. Consultas: anulación ─────────────────────────────────────────────────

ALTER TABLE historial_clinico
  ADD COLUMN anulada_at  TIMESTAMPTZ,
  ADD COLUMN anulada_por UUID REFERENCES usuario(id);

ALTER POLICY historial_clinico_select ON historial_clinico USING (
  anulada_at IS NULL
  AND (
    tiene_membresia((SELECT caballo.sociedad_id FROM caballo WHERE caballo.id = historial_clinico.caballo_id))
    OR EXISTS (
      SELECT 1 FROM acceso_vet av
       WHERE av.vet_id = auth.uid()
         AND av.caballo_id = historial_clinico.caballo_id
         AND av.activo = true
    )
  )
);

CREATE OR REPLACE FUNCTION public.anular_consulta(p_historial_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_autor   uuid;
  v_anulada timestamptz;
BEGIN
  SELECT creado_por, anulada_at INTO v_autor, v_anulada
    FROM historial_clinico
   WHERE id = p_historial_id
   FOR UPDATE;

  IF NOT FOUND OR v_anulada IS NOT NULL THEN
    RAISE EXCEPTION 'La consulta no existe o ya fue anulada.';
  END IF;
  IF v_autor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó la consulta puede anularla.';
  END IF;

  UPDATE historial_clinico
     SET anulada_at = now(), anulada_por = auth.uid()
   WHERE id = p_historial_id;
END;
$function$;

REVOKE ALL ON FUNCTION anular_consulta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION anular_consulta(uuid) TO authenticated;

-- Las RPC SECURITY DEFINER no pasan por la RLS: cada una filtra a mano.

CREATE OR REPLACE FUNCTION public.get_alertas_vet()
 RETURNS TABLE(historial_id uuid, proxima_consulta date, caballo_id uuid, caballo_nombre text, tipo text, dias_restantes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    hc.id AS historial_id,
    hc.proxima_consulta,
    hc.caballo_id,
    c.nombre::text AS caballo_nombre,
    ct.nombre::text AS tipo,
    (hc.proxima_consulta - CURRENT_DATE)::INTEGER AS dias_restantes
  FROM historial_clinico hc
  JOIN caballo c ON c.id = hc.caballo_id
  LEFT JOIN cat_tipo_consulta ct ON ct.id = hc.tipo_consulta_id
  WHERE hc.creado_por = auth.uid()
    AND hc.anulada_at IS NULL
    AND c.activo = TRUE
    AND hc.proxima_consulta IS NOT NULL
    AND hc.proxima_consulta <= CURRENT_DATE + INTERVAL '30 days'
  ORDER BY hc.proxima_consulta ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_consultas_recientes_vet(p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, fecha_consulta date, proxima_consulta date, caballo_id uuid, caballo_nombre text, tipo text, diagnostico text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT hc.id, hc.fecha_consulta::date, hc.proxima_consulta,
         hc.caballo_id, c.nombre::text AS caballo_nombre,
         ct.nombre::text AS tipo, hc.diagnostico
    FROM historial_clinico hc
    JOIN caballo c ON c.id = hc.caballo_id
    LEFT JOIN cat_tipo_consulta ct ON ct.id = hc.tipo_consulta_id
   WHERE hc.creado_por = auth.uid()
     AND hc.anulada_at IS NULL
   ORDER BY hc.fecha_consulta DESC
   LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_caballos_propios_vet()
 RETURNS TABLE(id uuid, nombre text, categoria text, fecha_nacimiento date, raza_nombre text, pelaje_nombre text, created_at timestamp with time zone, consultas integer, ultima_consulta date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.nombre::TEXT,
    c.categoria::TEXT,
    c.fecha_nacimiento,
    r.nombre::TEXT   AS raza_nombre,
    pel.nombre::TEXT AS pelaje_nombre,
    c.created_at,
    COALESCE(h.total, 0)::INTEGER AS consultas,
    h.ultima::date                AS ultima_consulta
  FROM caballo c
  LEFT JOIN cat_raza   r   ON r.id   = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total, MAX(hc.fecha_consulta) AS ultima
    FROM historial_clinico hc
    WHERE hc.caballo_id = c.id
      AND hc.anulada_at IS NULL
  ) h ON TRUE
  WHERE c.vet_owner_id = auth.uid()
    AND c.sociedad_id  IS NULL
    AND c.activo       = TRUE
  ORDER BY c.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_caballos_propios_vet_inactivos()
 RETURNS TABLE(id uuid, nombre text, categoria text, fecha_nacimiento date, raza_nombre text, pelaje_nombre text, fecha_baja timestamp with time zone, consultas integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.nombre::TEXT,
    c.categoria::TEXT,
    c.fecha_nacimiento,
    r.nombre::TEXT   AS raza_nombre,
    pel.nombre::TEXT AS pelaje_nombre,
    c.updated_at     AS fecha_baja,
    COALESCE(h.total, 0)::INTEGER AS consultas
  FROM caballo c
  LEFT JOIN cat_raza   r   ON r.id   = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM historial_clinico hc
    WHERE hc.caballo_id = c.id
      AND hc.anulada_at IS NULL
  ) h ON TRUE
  WHERE c.vet_owner_id = auth.uid()
    AND c.sociedad_id  IS NULL
    AND c.activo       = FALSE
  ORDER BY c.updated_at DESC;
$function$;

-- ── B. Trabajos sanitarios: el autor borra aunque esté realizado ───────────
-- trabajo_sanitario_caballo se va en cascada; el historial_clinico que generó
-- el cierre queda (la FK es de la grilla hacia el historial, no al revés).

ALTER POLICY trabajo_sanitario_delete ON trabajo_sanitario USING (
  es_admin(sociedad_id)
  OR is_superadmin()
  OR vet_owner_id = auth.uid()
  OR creado_por = auth.uid()
);

-- ── C. Centro de Cría: borrado del autor, solo sin dependencias ────────────

-- Reabre el recordatorio que un registro había resuelto, salvo que otro
-- registro, ecografía o flushing lo siga teniendo como origen.
CREATE OR REPLACE FUNCTION public._cria_reabrir_recordatorio(p_recordatorio_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_recordatorio_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE cria_recordatorio r
     SET estado = 'pendiente'
   WHERE r.id = p_recordatorio_id
     AND r.estado = 'hecho'
     AND NOT EXISTS (SELECT 1 FROM cria_registro_clinico x WHERE x.origen_recordatorio_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM cria_ecografia        x WHERE x.origen_recordatorio_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM cria_flushing         x WHERE x.origen_recordatorio_id = r.id);
END;
$function$;

-- Borra un registro y lo que generó. Los recordatorios automáticos que todavía
-- no se resolvieron eran consecuencia del registro y se van con él; los que ya
-- se hicieron quedan como historia, sin origen.
CREATE OR REPLACE FUNCTION public._cria_borrar_registro(p_registro_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_origen uuid;
BEGIN
  SELECT origen_recordatorio_id INTO v_origen
    FROM cria_registro_clinico WHERE id = p_registro_id;

  UPDATE cria_recordatorio r
     SET origen_registro_id = NULL
   WHERE r.origen_registro_id = p_registro_id
     AND (r.estado = 'hecho'
          OR EXISTS (SELECT 1 FROM cria_flushing f WHERE f.origen_recordatorio_id = r.id));
  DELETE FROM cria_recordatorio WHERE origen_registro_id = p_registro_id;

  UPDATE cria_estado_transicion SET registro_origen_id = NULL
   WHERE registro_origen_id = p_registro_id;

  DELETE FROM cria_registro_clinico WHERE id = p_registro_id;

  PERFORM _cria_reabrir_recordatorio(v_origen);
END;
$function$;

REVOKE ALL ON FUNCTION _cria_reabrir_recordatorio(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _cria_borrar_registro(uuid)      FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.eliminar_registro_cria(p_registro_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_autor uuid;
BEGIN
  SELECT veterinario_id INTO v_autor
    FROM cria_registro_clinico WHERE id = p_registro_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El registro no existe.';
  END IF;
  IF v_autor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó el registro puede eliminarlo.';
  END IF;
  IF EXISTS (SELECT 1 FROM cria_transferencia WHERE registro_id = p_registro_id) THEN
    RAISE EXCEPTION 'Este registro es el de una transferencia embrionaria: para borrarlo, eliminá la transferencia.';
  END IF;

  PERFORM _cria_borrar_registro(p_registro_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.eliminar_transferencia_cria(p_transferencia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t      cria_transferencia%ROWTYPE;
  v_ecos integer;
BEGIN
  SELECT * INTO t FROM cria_transferencia WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La transferencia no existe.';
  END IF;
  IF t.veterinario_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó la transferencia puede eliminarla.';
  END IF;

  SELECT COUNT(*) INTO v_ecos FROM cria_ecografia WHERE transferencia_id = p_transferencia_id;
  IF v_ecos > 0 THEN
    RAISE EXCEPTION 'La transferencia tiene % ecografía(s) cargada(s): eliminalas primero, empezando por la última.', v_ecos;
  END IF;

  UPDATE cria_estado_transicion SET transferencia_origen_id = NULL
   WHERE transferencia_origen_id = p_transferencia_id;

  DELETE FROM cria_transferencia WHERE id = p_transferencia_id;

  -- El estado previo del embrión no se guarda: vuelve a disponible.
  IF t.embrion_id IS NOT NULL THEN
    UPDATE embrion SET estado = 'disponible', updated_at = now()
     WHERE id = t.embrion_id AND estado = 'transferido';
  END IF;

  -- La preñez la marcó esta transferencia: se deshace si no hay otra posterior.
  UPDATE caballo c
     SET prenada = false, fecha_prenez = NULL, updated_at = now()
   WHERE c.id = t.caballo_receptora_id
     AND c.prenada
     AND c.fecha_prenez = t.fecha
     AND NOT EXISTS (
       SELECT 1 FROM cria_transferencia x
        WHERE x.caballo_receptora_id = t.caballo_receptora_id
          AND x.fecha >= t.fecha
     );

  -- El registro de la receptora lo creó la transferencia: se va con ella.
  PERFORM _cria_borrar_registro(t.registro_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.eliminar_ecografia_cria(p_ecografia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e       cria_ecografia%ROWTYPE;
  t       cria_transferencia%ROWTYPE;
  v_res   text;
BEGIN
  SELECT * INTO e FROM cria_ecografia WHERE id = p_ecografia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La ecografía no existe.';
  END IF;
  IF e.veterinario_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó la ecografía puede eliminarla.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cria_ecografia x
     WHERE x.transferencia_id = e.transferencia_id AND x.numero > e.numero
  ) THEN
    RAISE EXCEPTION 'Solo se puede eliminar la última ecografía de la transferencia.';
  END IF;

  DELETE FROM cria_ecografia WHERE id = p_ecografia_id;

  -- Re-sincroniza la preñez que había tocado el trigger, solo si esta es la
  -- transferencia vigente de la receptora.
  SELECT * INTO t FROM cria_transferencia WHERE id = e.transferencia_id;
  IF NOT EXISTS (
    SELECT 1 FROM cria_transferencia x
     WHERE x.caballo_receptora_id = e.caballo_receptora_id
       AND x.id <> t.id
       AND (x.fecha > t.fecha OR (x.fecha = t.fecha AND x.created_at > t.created_at))
  ) THEN
    SELECT resultado INTO v_res
      FROM cria_ecografia
     WHERE transferencia_id = e.transferencia_id
     ORDER BY numero DESC
     LIMIT 1;

    IF v_res = 'abortada' THEN
      UPDATE caballo SET prenada = false, fecha_prenez = NULL, updated_at = now()
       WHERE id = e.caballo_receptora_id;
    ELSE
      UPDATE caballo SET prenada = true, fecha_prenez = COALESCE(fecha_prenez, t.fecha), updated_at = now()
       WHERE id = e.caballo_receptora_id;
    END IF;
  END IF;

  PERFORM _cria_reabrir_recordatorio(e.origen_recordatorio_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.eliminar_flushing_cria(p_flushing_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  f          cria_flushing%ROWTYPE;
  v_embriones integer;
BEGIN
  SELECT * INTO f FROM cria_flushing WHERE id = p_flushing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El flushing no existe.';
  END IF;
  IF f.veterinario_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó el flushing puede eliminarlo.';
  END IF;

  SELECT COUNT(*) INTO v_embriones FROM embrion WHERE flushing_id = p_flushing_id;
  IF v_embriones > 0 THEN
    RAISE EXCEPTION 'El flushing tiene % embrión(es) cargado(s): eliminalos primero desde Embriones.', v_embriones;
  END IF;
  IF EXISTS (SELECT 1 FROM cria_transferencia WHERE flushing_id = p_flushing_id) THEN
    RAISE EXCEPTION 'Hay transferencias hechas con este flushing: eliminalas primero.';
  END IF;

  UPDATE cria_estado_transicion SET flushing_origen_id = NULL
   WHERE flushing_origen_id = p_flushing_id;

  DELETE FROM cria_flushing WHERE id = p_flushing_id;

  PERFORM _cria_reabrir_recordatorio(f.origen_recordatorio_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.eliminar_embrion_cria(p_embrion_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_flushing uuid;
  v_autor    uuid;
BEGIN
  SELECT e.flushing_id, f.veterinario_id INTO v_flushing, v_autor
    FROM embrion e
    JOIN cria_flushing f ON f.id = e.flushing_id
   WHERE e.id = p_embrion_id
   FOR UPDATE OF e;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El embrión no existe.';
  END IF;
  -- El embrión no tiene autor propio: es del vet que cargó el flushing.
  IF v_autor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó el flushing puede eliminar sus embriones.';
  END IF;
  IF EXISTS (SELECT 1 FROM cria_transferencia WHERE embrion_id = p_embrion_id) THEN
    RAISE EXCEPTION 'El embrión ya se transfirió: eliminá primero la transferencia.';
  END IF;

  DELETE FROM embrion WHERE id = p_embrion_id;

  UPDATE cria_flushing
     SET cantidad = GREATEST(COALESCE(cantidad, 1) - 1, 0), updated_at = now()
   WHERE id = v_flushing;
END;
$function$;

CREATE OR REPLACE FUNCTION public.eliminar_recordatorio_cria(p_recordatorio_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_autor uuid;
BEGIN
  SELECT veterinario_id INTO v_autor
    FROM cria_recordatorio WHERE id = p_recordatorio_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El recordatorio no existe.';
  END IF;
  IF v_autor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó el recordatorio puede eliminarlo.';
  END IF;

  -- Registros y ecografías sueltan el vínculo solos (ON DELETE SET NULL); el
  -- flushing tiene la FK sin acción y se suelta a mano, con el mismo criterio.
  UPDATE cria_flushing SET origen_recordatorio_id = NULL
   WHERE origen_recordatorio_id = p_recordatorio_id;

  DELETE FROM cria_recordatorio WHERE id = p_recordatorio_id;
END;
$function$;

REVOKE ALL ON FUNCTION eliminar_registro_cria(uuid)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION eliminar_transferencia_cria(uuid)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION eliminar_ecografia_cria(uuid)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION eliminar_flushing_cria(uuid)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION eliminar_embrion_cria(uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION eliminar_recordatorio_cria(uuid)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION eliminar_registro_cria(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION eliminar_transferencia_cria(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION eliminar_ecografia_cria(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION eliminar_flushing_cria(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION eliminar_embrion_cria(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION eliminar_recordatorio_cria(uuid)  TO authenticated;
