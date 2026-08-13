-- Baja en lote de caballos propios de un veterinario, para regularizar el
-- límite freemium cuando quedó por encima del plan gratuito sin suscripción.
--
-- Por qué hace falta una función y no alcanza con `caballoService.darDeBaja`:
-- la única policy de UPDATE sobre `caballo` es `caballo_update`, con
-- `es_admin(sociedad_id)`. Un caballo propio de vet tiene `sociedad_id IS NULL`,
-- así que el vet NO puede darlo de baja con un update directo desde el cliente
-- (confirmado contra las policies del schema vivo). De ahí el SECURITY DEFINER.
--
-- Es baja lógica, no borrado real: `vet_caballos_propios` cuenta solo activos,
-- así que alcanza para volver a estar en regla, y deja la puerta abierta a
-- reactivar los caballos si el vet retoma la membresía — sin perder historial
-- clínico, sanidad ni pedigree.
CREATE OR REPLACE FUNCTION dar_de_baja_caballos_veterinario(p_caballo_ids UUID[])
RETURNS INTEGER
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

    -- Si alguno de los ids no es un caballo propio y activo del vet, se aborta
    -- la operación entera en vez de saltearlo en silencio: el frontend cuenta
    -- las bajas para decidir si el vet quedó en regla, y un descarte mudo le
    -- daría un total equivocado.
    IF EXISTS (
      SELECT 1
      FROM unnest(p_caballo_ids) AS sel(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM caballo c
         WHERE c.id            = sel.id
           AND c.vet_owner_id  = auth.uid()
           AND c.sociedad_id   IS NULL
           AND c.activo        = TRUE
      )
    ) THEN
      RAISE EXCEPTION 'Alguno de los caballos seleccionados no es tuyo o ya estaba dado de baja.';
    END IF;

    UPDATE caballo
       SET activo = FALSE
     WHERE id           = ANY(p_caballo_ids)
       AND vet_owner_id = auth.uid()
       AND sociedad_id  IS NULL;

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RETURN v_afectados;
  END;
  $function$;

-- Nota deliberada: no se toca `acceso_vet`. `get_caballos_veterinario` ya
-- filtra por `c.activo = true`, así que el caballo desaparece igual de la
-- vista del vet; y dejar el acceso intacto hace que reactivar el caballo el
-- día que retome la membresía sea un solo UPDATE, sin tener que reconstruir
-- permisos.

REVOKE ALL ON FUNCTION dar_de_baja_caballos_veterinario(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dar_de_baja_caballos_veterinario(UUID[]) TO authenticated;
