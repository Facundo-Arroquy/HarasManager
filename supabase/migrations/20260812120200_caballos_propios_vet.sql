-- Listado de caballos propios del vet, para el modal de regularización del
-- límite freemium.
--
-- `get_caballos_veterinario` no sirve acá: devuelve todo lo que el vet puede
-- ver vía `acceso_vet`, incluidos los caballos de haras a los que le dieron
-- acceso clínico — esos no cuentan para el límite y no debe poder darlos de
-- baja. Esta función devuelve solo los propios (`vet_owner_id` = él,
-- `sociedad_id IS NULL`), que son exactamente los que el límite mira.
--
-- Trae `consultas` y `created_at` porque el vet tiene que elegir cuáles
-- sacrificar: sin saber cuáles tienen historial cargado, la decisión es a
-- ciegas.
CREATE OR REPLACE FUNCTION get_caballos_propios_vet()
RETURNS TABLE(
  id               UUID,
  nombre           TEXT,
  categoria        TEXT,
  fecha_nacimiento DATE,
  raza_nombre      TEXT,
  pelaje_nombre    TEXT,
  created_at       TIMESTAMPTZ,
  consultas        INTEGER,
  ultima_consulta  DATE
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
    c.created_at,
    COALESCE(h.total, 0)::INTEGER AS consultas,
    h.ultima                       AS ultima_consulta
  FROM caballo c
  LEFT JOIN cat_raza   r   ON r.id   = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total, MAX(hc.fecha_consulta) AS ultima
    FROM historial_clinico hc
    WHERE hc.caballo_id = c.id
  ) h ON TRUE
  WHERE c.vet_owner_id = auth.uid()
    AND c.sociedad_id  IS NULL
    AND c.activo       = TRUE
  ORDER BY c.created_at DESC;
$$;

REVOKE ALL ON FUNCTION get_caballos_propios_vet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_caballos_propios_vet() TO authenticated;
