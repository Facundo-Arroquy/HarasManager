-- Corregir una ecografía desde la app dejaba dos huecos (review de #88):
--   1. Pasar una 'abortada' a 'pendiente' devolvía la preñez (trigger) pero el
--      pipeline quedaba en 'vacia': el front solo sabía ir a 'vacia'/'prenada'.
--   2. El trigger revertía el aborto aunque la eco fuera de una transferencia
--      vieja, y le marcaba preñada a una yegua que ya estaba en otro ciclo.
-- Además, el pipeline (caballo.estado_reproductivo) lo escribía el front con un
-- UPDATE directo sobre caballo, cuya única policy es es_admin(sociedad_id):
-- para el veterinario —que es quien carga las ecos— no afectaba filas y no avisaba.
--
-- Ahora lo hace el trigger, en la misma transacción que la eco:
--   * Solo si la transferencia es la vigente de la receptora (la última).
--   * 'abortada' → sin preñez y pipeline 'vacia'; 'prenada' → preñez y pipeline
--     'prenada'; 'pendiente' no toca nada, salvo que corrija un 'abortada':
--     vuelven la preñez y el estado del pipeline previo al aborto.
--   * Cada cambio de pipeline deja su fila en cria_estado_transicion.
-- Borrar una eco 'abortada' revierte el aborto con el mismo criterio.

-- Vigente = no hay otra transferencia posterior a la misma receptora.
CREATE OR REPLACE FUNCTION public._cria_transferencia_vigente(p_transferencia_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1
      FROM cria_transferencia t
      JOIN cria_transferencia x
        ON x.caballo_receptora_id = t.caballo_receptora_id
       AND x.id <> t.id
     WHERE t.id = p_transferencia_id
       AND (x.fecha > t.fecha OR (x.fecha = t.fecha AND x.created_at > t.created_at))
  );
$function$;

-- Mueve el pipeline y deja la transición. No hace nada si ya estaba en ese estado.
CREATE OR REPLACE FUNCTION public._cria_cambiar_estado_reproductivo(
  p_caballo_id  uuid,
  p_sociedad_id uuid,
  p_estado      text,
  p_motivo      text,
  p_creado_por  uuid
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actual text;
BEGIN
  SELECT estado_reproductivo INTO v_actual
    FROM caballo WHERE id = p_caballo_id FOR UPDATE;
  IF NOT FOUND OR v_actual IS NOT DISTINCT FROM p_estado THEN
    RETURN;
  END IF;

  UPDATE caballo
     SET estado_reproductivo = p_estado, updated_at = now()
   WHERE id = p_caballo_id;

  INSERT INTO cria_estado_transicion
    (caballo_id, sociedad_id, estado_anterior, estado_nuevo, motivo, creado_por)
  VALUES
    (p_caballo_id, p_sociedad_id, v_actual, p_estado, p_motivo, p_creado_por);
END;
$function$;

-- Deshace un aborto: vuelve la preñez que marcó la transferencia y el pipeline
-- al estado previo al aborto, si no se movió desde entonces. El llamador ya
-- verificó que la transferencia es la vigente.
CREATE OR REPLACE FUNCTION public._cria_revertir_aborto(
  p_caballo_id       uuid,
  p_sociedad_id      uuid,
  p_transferencia_id uuid,
  p_numero           integer,
  p_motivo           text,
  p_creado_por       uuid
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha_transf date;
  v_previo       text;
BEGIN
  SELECT fecha INTO v_fecha_transf
    FROM cria_transferencia WHERE id = p_transferencia_id;

  UPDATE caballo
     SET prenada = true, fecha_prenez = COALESCE(fecha_prenez, v_fecha_transf), updated_at = now()
   WHERE id = p_caballo_id;

  SELECT estado_anterior INTO v_previo
    FROM cria_estado_transicion
   WHERE caballo_id   = p_caballo_id
     AND estado_nuevo = 'vacia'
     AND motivo       = format('Ecografía %s: abortada', p_numero)
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND AND EXISTS (
    SELECT 1 FROM caballo WHERE id = p_caballo_id AND estado_reproductivo = 'vacia'
  ) THEN
    PERFORM _cria_cambiar_estado_reproductivo(p_caballo_id, p_sociedad_id, v_previo, p_motivo, p_creado_por);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION _cria_transferencia_vigente(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _cria_cambiar_estado_reproductivo(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _cria_revertir_aborto(uuid, uuid, uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sincronizar_prenez_ecografia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha_transf date;
  v_autor        uuid := COALESCE(auth.uid(), NEW.veterinario_id);
  v_motivo       text := format('Ecografía %s: %s', NEW.numero, NEW.resultado);
BEGIN
  -- La receptora está en el ciclo de su última transferencia: una eco de una
  -- transferencia anterior (cargada o corregida) no le cambia nada.
  IF NOT _cria_transferencia_vigente(NEW.transferencia_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.resultado = 'abortada' THEN
    UPDATE caballo
       SET prenada = false, fecha_prenez = NULL, updated_at = now()
     WHERE id = NEW.caballo_receptora_id;
    PERFORM _cria_cambiar_estado_reproductivo(
      NEW.caballo_receptora_id, NEW.sociedad_id, 'vacia', v_motivo, v_autor);

  ELSIF NEW.resultado = 'prenada' THEN
    SELECT fecha INTO v_fecha_transf
      FROM cria_transferencia WHERE id = NEW.transferencia_id;
    UPDATE caballo
       SET prenada      = true,
           fecha_prenez = COALESCE(fecha_prenez, v_fecha_transf, NEW.fecha),
           updated_at   = now()
     WHERE id = NEW.caballo_receptora_id;
    PERFORM _cria_cambiar_estado_reproductivo(
      NEW.caballo_receptora_id, NEW.sociedad_id, 'prenada', v_motivo, v_autor);

  ELSIF TG_OP = 'UPDATE' AND OLD.resultado = 'abortada' THEN
    -- Se corrigió un aborto cargado por error.
    PERFORM _cria_revertir_aborto(
      NEW.caballo_receptora_id, NEW.sociedad_id, NEW.transferencia_id, NEW.numero,
      format('Ecografía %s: corregida de abortada a %s', NEW.numero, NEW.resultado), v_autor);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.eliminar_ecografia_cria(p_ecografia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e cria_ecografia%ROWTYPE;
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
  IF e.resultado = 'abortada' AND _cria_transferencia_vigente(e.transferencia_id) THEN
    PERFORM _cria_revertir_aborto(
      e.caballo_receptora_id, e.sociedad_id, e.transferencia_id, e.numero,
      format('Ecografía %s abortada eliminada', e.numero), auth.uid());
  END IF;

  PERFORM _cria_reabrir_recordatorio(e.origen_recordatorio_id);
END;
$function$;
