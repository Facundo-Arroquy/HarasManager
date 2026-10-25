-- eliminar_ecografia_cria recalculaba la preñez desde cero con la eco que
-- quedaba, y pisaba estados que la eco borrada nunca había tocado: borrar una
-- eco 'pendiente' le marcaba preñada a una receptora que estaba vacía.
-- El trigger sincronizar_prenez_ecografia solo actúa sobre 'abortada' (saca la
-- preñez) y 'prenada' (la confirma; ya estaba desde la transferencia), así que
-- lo único que hay que deshacer es un aborto.

CREATE OR REPLACE FUNCTION public.eliminar_ecografia_cria(p_ecografia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e cria_ecografia%ROWTYPE;
  t cria_transferencia%ROWTYPE;
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

  -- Solo se deshace un aborto, y solo si es la transferencia vigente de la receptora.
  IF e.resultado = 'abortada' THEN
    SELECT * INTO t FROM cria_transferencia WHERE id = e.transferencia_id;
    IF NOT EXISTS (
      SELECT 1 FROM cria_transferencia x
       WHERE x.caballo_receptora_id = e.caballo_receptora_id
         AND x.id <> t.id
         AND (x.fecha > t.fecha OR (x.fecha = t.fecha AND x.created_at > t.created_at))
    ) THEN
      UPDATE caballo
         SET prenada = true, fecha_prenez = COALESCE(fecha_prenez, t.fecha), updated_at = now()
       WHERE id = e.caballo_receptora_id;
    END IF;
  END IF;

  PERFORM _cria_reabrir_recordatorio(e.origen_recordatorio_id);
END;
$function$;
