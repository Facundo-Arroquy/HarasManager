-- Editar una ecografía que se había cargado como 'abortada' por error: el
-- trigger solo sabía sacar la preñez (abortada) o confirmarla (prenada), así
-- que corregirla a 'pendiente' dejaba a la receptora vacía para siempre.
-- Si el resultado deja de ser 'abortada', vuelve a valer la preñez que marcó
-- la transferencia.

CREATE OR REPLACE FUNCTION public.sincronizar_prenez_ecografia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha_transf date;
BEGIN
  IF NEW.resultado = 'abortada' THEN
    UPDATE caballo
    SET prenada      = false,
        fecha_prenez = NULL,
        updated_at   = now()
    WHERE id = NEW.caballo_receptora_id;

  ELSIF NEW.resultado = 'prenada' THEN
    SELECT fecha INTO v_fecha_transf
    FROM cria_transferencia
    WHERE id = NEW.transferencia_id;

    UPDATE caballo
    SET prenada      = true,
        fecha_prenez = COALESCE(fecha_prenez, v_fecha_transf, NEW.fecha),
        updated_at   = now()
    WHERE id = NEW.caballo_receptora_id;

  ELSIF TG_OP = 'UPDATE' AND OLD.resultado = 'abortada' THEN
    SELECT fecha INTO v_fecha_transf
    FROM cria_transferencia
    WHERE id = NEW.transferencia_id;

    UPDATE caballo
    SET prenada      = true,
        fecha_prenez = COALESCE(fecha_prenez, v_fecha_transf),
        updated_at   = now()
    WHERE id = NEW.caballo_receptora_id;
  END IF;

  RETURN NEW;
END;
$function$;
