-- Corrige 20261022120000: para no cancelar la "Revisión PG" recién creada por el
-- trigger trg_cria_flushing_sincronizar_revision_pg, esa migración excluyó TODA
-- Revisión PG del cierre de ciclo. Efecto colateral: la Revisión PG del flushing
-- ANTERIOR (que 20261019160000 cancelaba a propósito) quedaba vencida para siempre.
--
-- Ahora se excluye solo lo que cuelga del flushing que se acaba de crear
-- (flushing_id = p_flushing_id). Las Revisión PG de flushings anteriores se cancelan
-- como cualquier otro recordatorio del ciclo previo.
--
-- Cambia la firma (suma p_flushing_id): hay que borrar la función vieja y volver
-- a dar los permisos, que se pierden con el DROP (ver 20261019150000).

DROP FUNCTION IF EXISTS cerrar_recordatorios_flushing(uuid);

CREATE FUNCTION cerrar_recordatorios_flushing(
  p_caballo_id   uuid,
  p_flushing_id  uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada';
  END IF;

  -- Sin el flushing nuevo, el IS DISTINCT FROM de abajo cancelaría también lo que
  -- creó el trigger (es justo el bug que se está corrigiendo).
  IF p_flushing_id IS NULL THEN
    RAISE EXCEPTION 'p_flushing_id es obligatorio';
  END IF;

  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR tiene_membresia((SELECT c.sociedad_id FROM caballo c WHERE c.id = p_caballo_id))
    OR is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE cria_recordatorio
  SET estado        = 'cancelado',
      cancel_motivo = 'Ciclo cerrado por nuevo flushing',
      updated_at    = now()
  WHERE caballo_id = p_caballo_id
    AND estado IN ('pendiente', 'vencido')
    AND auto_generado = true
    AND tipo NOT IN ('Eco 1', 'Eco 2', 'Eco 3', 'Revisión Eco')
    AND flushing_id IS DISTINCT FROM p_flushing_id;
END;
$$;

REVOKE ALL ON FUNCTION cerrar_recordatorios_flushing(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cerrar_recordatorios_flushing(uuid, uuid) TO authenticated;
