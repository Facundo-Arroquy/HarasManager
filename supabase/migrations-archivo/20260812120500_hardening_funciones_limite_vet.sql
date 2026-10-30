-- Endurecimiento de las funciones del límite freemium.
--
-- `vet_caballos_propios(uuid)` y `vet_suscripcion_activa(uuid)` son
-- SECURITY DEFINER y toman el usuario por parámetro, así que con EXECUTE
-- otorgado a `authenticated` cualquier usuario logueado podía pasar el UUID de
-- otro y averiguar cuántos caballos tiene y si su suscripción está paga,
-- bypaseando la RLS de `caballo` y de `suscripcion_veterinario`.
--
-- No hace falta que sean invocables desde el cliente: solo se llaman desde
-- adentro de `vet_estado_limite()` y `vet_puede_agregar_caballo()`, que son
-- SECURITY DEFINER con dueño `postgres` — dentro de ellas la ejecución corre
-- como el owner, así que el REVOKE a `authenticated` no las rompe. El front
-- solo llama a `vet_estado_limite()`, que siempre usa `auth.uid()` y nunca
-- acepta un usuario por parámetro.
REVOKE EXECUTE ON FUNCTION vet_caballos_propios(UUID)   FROM authenticated;
REVOKE EXECUTE ON FUNCTION vet_suscripcion_activa(UUID) FROM authenticated;

-- Preexistente, del feature original (`20260811150100`): quedó ejecutable por
-- PUBLIC y anon, así que se podía sondear sin sesión. `authenticated` sí la
-- necesita: la policy `vet_insert_own_caballo` la evalúa como el usuario que
-- hace el INSERT.
REVOKE ALL ON FUNCTION vet_puede_agregar_caballo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vet_puede_agregar_caballo(UUID) TO authenticated;

-- Duplicados en el array inflaban el conteo del cupo: `array_length` contaba
-- el id repetido dos veces y el UPDATE lo aplicaba una sola. Erraba hacia el
-- lado seguro (rechazaba de más), pero da mensajes confusos y la función es la
-- especificación del endpoint futuro, así que conviene que el número sea exacto.
CREATE OR REPLACE FUNCTION reactivar_caballos_veterinario(p_caballo_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DECLARE
    v_afectados INTEGER;
    v_cupo      INTEGER;
    v_pedidos   INTEGER;
  BEGIN
    IF p_caballo_ids IS NULL OR array_length(p_caballo_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No seleccionaste ningún caballo para reactivar.';
    END IF;

    SELECT COUNT(DISTINCT id)::INTEGER INTO v_pedidos
    FROM unnest(p_caballo_ids) AS t(id);

    IF EXISTS (
      SELECT 1
      FROM unnest(p_caballo_ids) AS sel(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM caballo c
         WHERE c.id            = sel.id
           AND c.vet_owner_id  = auth.uid()
           AND c.sociedad_id   IS NULL
           AND c.activo        = FALSE
      )
    ) THEN
      RAISE EXCEPTION 'Alguno de los caballos seleccionados no es tuyo o ya estaba activo.';
    END IF;

    IF NOT vet_suscripcion_activa(auth.uid()) THEN
      v_cupo := GREATEST(vet_limite_gratuito() - vet_caballos_propios(auth.uid()), 0);
      IF v_pedidos > v_cupo THEN
        RAISE EXCEPTION
          'Sin una suscripción activa solo podés reactivar % caballo(s) más. Seleccionaste %.',
          v_cupo, v_pedidos;
      END IF;
    END IF;

    UPDATE caballo
       SET activo = TRUE
     WHERE id           = ANY(p_caballo_ids)
       AND vet_owner_id = auth.uid()
       AND sociedad_id  IS NULL;

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RETURN v_afectados;
  END;
  $function$;

REVOKE ALL ON FUNCTION reactivar_caballos_veterinario(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reactivar_caballos_veterinario(UUID[]) TO authenticated;
