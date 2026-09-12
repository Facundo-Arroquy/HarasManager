-- El vet ya podía EDITAR cualquier caballo con acceso_vet activo (actualizar_caballo_veterinario
-- ya chequeaba vet_tiene_acceso). Lo que faltaba era DAR DE BAJA / REACTIVAR: esas dos RPCs
-- solo aceptaban caballos propios del vet (vet_owner_id = auth.uid() AND sociedad_id IS NULL).
-- Ahora también aceptan cualquier caballo sobre el que el vet tenga acceso_vet activo,
-- sea o no de su propiedad.
--
-- El cupo de la membresía freemium (vet_limite_aplicable / vet_caballos_propios) sigue
-- aplicando ÚNICAMENTE a los caballos propios: un caballo de una sociedad a la que el vet
-- tiene acceso no cuenta para ese límite ni debe bloquearse por él.

CREATE OR REPLACE FUNCTION public._vet_valida_propios(p_caballo_ids uuid[], p_activo_esperado boolean)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM unnest(p_caballo_ids) AS sel(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM caballo c
         WHERE c.id     = sel.id
           AND c.activo = p_activo_esperado
           AND (
             (c.vet_owner_id = auth.uid() AND c.sociedad_id IS NULL)
             OR vet_tiene_acceso(c.id)
           )
      )
    ) THEN
      IF p_activo_esperado THEN
        RAISE EXCEPTION 'Alguno de los caballos seleccionados no es tuyo, no tenés acceso, o ya estaba dado de baja.';
      ELSE
        RAISE EXCEPTION 'Alguno de los caballos seleccionados no es tuyo, no tenés acceso, o ya estaba activo.';
      END IF;
    END IF;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.dar_de_baja_caballos_veterinario(p_caballo_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DECLARE
    v_afectados INTEGER;
  BEGIN
    IF p_caballo_ids IS NULL OR array_length(p_caballo_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No seleccionaste ningún caballo para dar de baja.';
    END IF;

    PERFORM _vet_valida_propios(p_caballo_ids, TRUE);

    UPDATE caballo
       SET activo = FALSE
     WHERE id = ANY(p_caballo_ids)
       AND (
         (vet_owner_id = auth.uid() AND sociedad_id IS NULL)
         OR vet_tiene_acceso(id)
       );

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RETURN v_afectados;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.reactivar_caballos_veterinario(p_caballo_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DECLARE
    v_afectados       INTEGER;
    v_cupo            INTEGER;
    v_pedidos_propios INTEGER;
    v_limite          INTEGER;
  BEGIN
    IF p_caballo_ids IS NULL OR array_length(p_caballo_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No seleccionaste ningún caballo para reactivar.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('vet_limite_caballos'), hashtext(auth.uid()::text));

    PERFORM _vet_valida_propios(p_caballo_ids, FALSE);

    -- El cupo solo rige sobre los caballos PROPIOS incluidos en el lote; uno
    -- de una sociedad a la que el vet tiene acceso no lo consume.
    SELECT COUNT(DISTINCT c.id)::INTEGER INTO v_pedidos_propios
    FROM unnest(p_caballo_ids) AS t(id)
    JOIN caballo c ON c.id = t.id
    WHERE c.vet_owner_id = auth.uid() AND c.sociedad_id IS NULL;

    v_limite := vet_limite_aplicable(auth.uid());
    v_cupo   := GREATEST(v_limite - vet_caballos_propios(auth.uid()), 0);

    IF v_pedidos_propios > v_cupo THEN
      IF vet_suscripcion_activa(auth.uid()) THEN
        RAISE EXCEPTION
          'Tu membresía permite hasta % caballos propios, así que de los tuyos en esta selección solo podés reactivar % más. Elegiste % propios.',
          v_limite, v_cupo, v_pedidos_propios;
      ELSE
        RAISE EXCEPTION
          'Sin una membresía activa, de los tuyos en esta selección solo podés reactivar % más. Elegiste % propios.',
          v_cupo, v_pedidos_propios;
      END IF;
    END IF;

    UPDATE caballo
       SET activo = TRUE
     WHERE id = ANY(p_caballo_ids)
       AND (
         (vet_owner_id = auth.uid() AND sociedad_id IS NULL)
         OR vet_tiene_acceso(id)
       );

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RETURN v_afectados;
  END;
$function$;
