-- =============================================================================
-- FIX: get_caballos_veterinario no retornaba rol_reproductivo.
-- El campo existe en la tabla caballo pero no estaba en el SELECT ni en el
-- RETURNS TABLE, por lo que el badge Donante/Receptora nunca aparecía
-- en la vista del veterinario después de guardar.
-- DROP requerido porque cambia el tipo de retorno (no alcanza con OR REPLACE).
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_caballos_veterinario();

CREATE OR REPLACE FUNCTION public.get_caballos_veterinario()
RETURNS TABLE(
  id               uuid,
  nombre           text,
  fecha_nacimiento date,
  categoria        text,
  rol_reproductivo text,
  numero_chip      text,
  numero_registro  text,
  activo           boolean,
  sociedad_id      uuid,
  empresa_nombre   text,
  campo_id         uuid,
  raza_id          integer,
  pelaje_id        integer,
  padre_id         uuid,
  padre_nombre     text,
  madre_id         uuid,
  madre_nombre     text,
  raza_nombre      text,
  pelaje_nombre    text,
  campo_nombre     text
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
    s.nombre AS empresa_nombre,
    c.campo_id, c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre AS raza_nombre,
    p.nombre AS pelaje_nombre,
    ca.nombre AS campo_nombre
  FROM acceso_vet av
  JOIN caballo c ON c.id = av.caballo_id
  LEFT JOIN sociedad s ON s.id = c.sociedad_id
  LEFT JOIN cat_raza r ON r.id = c.raza_id
  LEFT JOIN cat_pelaje p ON p.id = c.pelaje_id
  LEFT JOIN campo ca ON ca.id = c.campo_id
  WHERE av.vet_id = auth.uid()
    AND av.activo = true
    AND c.activo = true
  ORDER BY c.nombre;
$$;
