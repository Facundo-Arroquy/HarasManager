-- =============================================================================
-- Migración: agregar propietario_nombre a get_caballos_veterinario
--
-- Agrega el nombre del propietario vigente de cada caballo (propiedad WHERE
-- fecha_fin IS NULL → propietario.nombre) para poder agrupar por empresa en
-- el panel de programa semanal.
-- DROP requerido porque cambia el tipo de retorno.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_caballos_veterinario();

CREATE OR REPLACE FUNCTION public.get_caballos_veterinario()
RETURNS TABLE(
  id                 uuid,
  nombre             text,
  fecha_nacimiento   date,
  categoria          text,
  rol_reproductivo   text,
  numero_chip        text,
  numero_registro    text,
  activo             boolean,
  sociedad_id        uuid,
  empresa_nombre     text,
  campo_id           uuid,
  raza_id            integer,
  pelaje_id          integer,
  padre_id           uuid,
  padre_nombre       text,
  madre_id           uuid,
  madre_nombre       text,
  raza_nombre        text,
  pelaje_nombre      text,
  campo_nombre       text,
  propietario_nombre text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id, c.nombre, c.fecha_nacimiento,
    c.categoria, c.rol_reproductivo,
    c.numero_chip, c.numero_registro,
    c.activo, c.sociedad_id,
    s.nombre   AS empresa_nombre,
    c.campo_id, c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre   AS raza_nombre,
    pel.nombre AS pelaje_nombre,
    ca.nombre  AS campo_nombre,
    pr.nombre  AS propietario_nombre
  FROM acceso_vet av
  JOIN caballo c ON c.id = av.caballo_id
  LEFT JOIN sociedad     s   ON s.id   = c.sociedad_id
  LEFT JOIN cat_raza     r   ON r.id   = c.raza_id
  LEFT JOIN cat_pelaje   pel ON pel.id = c.pelaje_id
  LEFT JOIN campo        ca  ON ca.id  = c.campo_id
  LEFT JOIN propiedad    pp  ON pp.caballo_id = c.id AND pp.fecha_fin IS NULL
  LEFT JOIN propietario  pr  ON pr.id  = pp.propietario_id
  WHERE av.vet_id = auth.uid()
    AND av.activo = true
    AND c.activo  = true
  ORDER BY c.nombre;
$$;
