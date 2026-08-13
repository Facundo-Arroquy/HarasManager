-- Reactivación de caballos propios dados de baja.
--
-- Contrapartida de `dar_de_baja_caballos_veterinario`: sin esto, la baja del
-- modal de regularización era irreversible desde la app (el vet quedaba con
-- los caballos invisibles y solo recuperables a mano desde la base), aunque el
-- modal le prometa lo contrario. También sirve para cualquier baja normal.

-- Listado de los propios inactivos. Hermana de `get_caballos_propios_vet`,
-- con `fecha_baja` aproximada por `updated_at` — no hay columna de baja en
-- `caballo`, y agregarla obligaría a backfillear todo el histórico para un
-- dato que acá es solo informativo.
CREATE OR REPLACE FUNCTION get_caballos_propios_vet_inactivos()
RETURNS TABLE(
  id               UUID,
  nombre           TEXT,
  categoria        TEXT,
  fecha_nacimiento DATE,
  raza_nombre      TEXT,
  pelaje_nombre    TEXT,
  fecha_baja       TIMESTAMPTZ,
  consultas        INTEGER
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  ) h ON TRUE
  WHERE c.vet_owner_id = auth.uid()
    AND c.sociedad_id  IS NULL
    AND c.activo       = FALSE
  ORDER BY c.updated_at DESC;
$$;

-- Reactivar vuelve a poner el caballo en el conteo del límite, así que tiene
-- que respetar el mismo gate que el alta: sin suscripción vigente, solo se
-- puede reactivar hasta llenar el cupo del plan gratuito. Si no, el downgrade
-- sería trivial de evadir — dar de baja los 50 para pasar el modal y
-- reactivarlos a los cinco minutos, gratis.
CREATE OR REPLACE FUNCTION reactivar_caballos_veterinario(p_caballo_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DECLARE
    v_afectados INTEGER;
    v_cupo      INTEGER;
  BEGIN
    IF p_caballo_ids IS NULL OR array_length(p_caballo_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No seleccionaste ningún caballo para reactivar.';
    END IF;

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
      IF array_length(p_caballo_ids, 1) > v_cupo THEN
        RAISE EXCEPTION
          'Sin una suscripción activa solo podés reactivar % caballo(s) más. Seleccionaste %.',
          v_cupo, array_length(p_caballo_ids, 1);
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

-- `acceso_vet` no hace falta tocarlo acá justamente porque la baja tampoco lo
-- tocó: el acceso clínico sigue vivo, así que el caballo reaparece completo.

REVOKE ALL ON FUNCTION get_caballos_propios_vet_inactivos()      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION reactivar_caballos_veterinario(UUID[])    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION get_caballos_propios_vet_inactivos()   TO authenticated;
GRANT EXECUTE ON FUNCTION reactivar_caballos_veterinario(UUID[]) TO authenticated;
