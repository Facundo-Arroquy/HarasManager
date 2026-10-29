-- =============================================================================
-- posponer_recordatorio(): reprogramar un recordatorio en una sola transacción
--
-- Bug que corrige: el front posponía con tres pedidos sueltos (SELECT del
-- recordatorio, INSERT en cria_reprogramacion, UPDATE de cria_recordatorio).
-- La única policy de UPDATE de cria_recordatorio es cria_rec_update
-- (`veterinario_id = auth.uid() OR es_admin(sociedad_id)`), pero el SELECT y el
-- INSERT dejan pasar a cualquier vet con vet_tiene_acceso(caballo_id). Un vet
-- que no creó el recordatorio lo veía, veía el botón "Posponer" y su UPDATE
-- afectaba 0 filas sin error: la fecha nueva se mostraba hasta recargar, y
-- además quedaba una fila en cria_reprogramacion por una reprogramación que
-- nunca se aplicó. `veterinario_id` también pasa a NULL cuando se borra al
-- usuario (superadmin_eliminar_usuario), y entonces solo el admin podía.
--
-- La RPC es SECURITY DEFINER para saltear cria_rec_update, y por eso valida
-- ella el permiso, con el mismo criterio que ya usa el INSERT de
-- cria_recordatorio: vet con acceso al caballo, admin de la sociedad o
-- superadmin. Historial + update son atómicos: o quedan los dos o ninguno.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.posponer_recordatorio(
  p_id          uuid,
  p_nueva_fecha date,
  p_motivo      text DEFAULT NULL
)
RETURNS public.cria_recordatorio
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rec public.cria_recordatorio%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada';
  END IF;

  IF p_id IS NULL OR p_nueva_fecha IS NULL THEN
    RAISE EXCEPTION 'Faltan el recordatorio o la nueva fecha';
  END IF;

  -- FOR UPDATE: dos posposiciones simultáneas del mismo recordatorio se
  -- serializan, así que cada fila de historial parte de la fecha real anterior.
  SELECT * INTO v_rec
  FROM public.cria_recordatorio
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El recordatorio no existe' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.vet_tiene_acceso(v_rec.caballo_id)
    OR public.es_admin(v_rec.sociedad_id)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'No tenés permiso para posponer este recordatorio'
      USING ERRCODE = '42501';
  END IF;

  -- Un recordatorio cerrado no se revive: la pantalla del que lo posterga
  -- puede estar desactualizada y otro usuario pudo haberlo cerrado antes.
  IF v_rec.estado NOT IN ('pendiente', 'vencido') THEN
    RAISE EXCEPTION 'Solo se pueden posponer recordatorios pendientes o vencidos (este está %)', v_rec.estado;
  END IF;

  INSERT INTO public.cria_reprogramacion (
    recordatorio_id, fecha_anterior, fecha_nueva, motivo, creado_por
  ) VALUES (
    p_id, v_rec.fecha_vto, p_nueva_fecha, NULLIF(btrim(p_motivo), ''), v_uid
  );

  -- fecha_original solo se graba la primera vez; el trigger BEFORE UPDATE
  -- mantiene updated_at.
  UPDATE public.cria_recordatorio
  SET fecha_vto      = p_nueva_fecha,
      estado         = 'pendiente',
      fecha_original = COALESCE(fecha_original, v_rec.fecha_vto)
  WHERE id = p_id
  RETURNING * INTO v_rec;

  RETURN v_rec;
END;
$$;

REVOKE ALL ON FUNCTION public.posponer_recordatorio(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.posponer_recordatorio(uuid, date, text) TO authenticated;
