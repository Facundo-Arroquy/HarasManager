-- ============================================================================
-- RPCs SECURITY DEFINER para evitar el overhead de RLS por fila.
--
-- Problema: las políticas RLS de `caballo` tienen 4 policies SELECT que
-- ejecutan subqueries (tiene_membresia, vet_tiene_acceso, is_superadmin, etc.)
-- POR CADA FILA. Con 735 caballos, eso son ~3000 subqueries por request.
--
-- Solución: RPCs que chequean permisos UNA VEZ al inicio y después hacen la
-- query sin pasar por RLS.
-- ============================================================================

-- 1) Actualizar get_caballos_veterinario para incluir prenada, fecha_prenez,
--    estado_reproductivo y tags inline.
--    Esto elimina las 2 queries extra que el frontend hacía después del RPC
--    (cada una pasando por RLS en 730 filas).
CREATE OR REPLACE FUNCTION get_caballos_veterinario()
RETURNS TABLE (
  id                  uuid,
  nombre              text,
  fecha_nacimiento    date,
  categoria           text,
  rol_reproductivo    text,
  estado_reproductivo text,
  prenada             boolean,
  fecha_prenez        date,
  numero_chip         text,
  numero_registro     text,
  activo              boolean,
  sociedad_id         uuid,
  empresa_nombre      text,
  vet_owner_id        uuid,
  campo_id            uuid,
  raza_id             int,
  pelaje_id           int,
  padre_id            uuid,
  padre_nombre        text,
  madre_id            uuid,
  madre_nombre        text,
  raza_nombre         text,
  pelaje_nombre       text,
  campo_nombre        text,
  propietario_nombre  text,
  domador             text,
  sexo                text,
  observaciones       text,
  tags                jsonb
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    c.id, c.nombre, c.fecha_nacimiento,
    c.categoria, c.rol_reproductivo, c.estado_reproductivo,
    COALESCE(c.prenada, false), c.fecha_prenez,
    c.numero_chip, c.numero_registro,
    c.activo, c.sociedad_id,
    s.nombre   AS empresa_nombre,
    c.vet_owner_id,
    c.campo_id, c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre   AS raza_nombre,
    pel.nombre AS pelaje_nombre,
    ca.nombre  AS campo_nombre,
    pr.nombre  AS propietario_nombre,
    c.domador,
    c.sexo,
    c.observaciones,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ct.id, 'nombre', ct.nombre, 'color', ct.color, 'activo', ct.activo))
       FROM caballo_tag cta
       JOIN cat_tag ct ON ct.id = cta.tag_id
       WHERE cta.caballo_id = c.id),
      '[]'::jsonb
    ) AS tags
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


-- 2) RPC para el dashboard: devuelve solo conteos, sin transferir filas.
--    Chequea membresía una vez y después cuenta directo.
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_sociedad_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_total       int;
  v_sin_campo   int;
  v_sin_chip    int;
  v_por_cat     jsonb;
BEGIN
  -- Chequeo de permisos: el usuario debe ser miembro de la sociedad
  IF NOT tiene_membresia(p_sociedad_id) THEN
    RAISE EXCEPTION 'Sin acceso a esta sociedad';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE campo_id IS NULL),
    count(*) FILTER (WHERE numero_chip IS NULL OR numero_chip = '')
  INTO v_total, v_sin_campo, v_sin_chip
  FROM caballo
  WHERE sociedad_id = p_sociedad_id AND activo = true;

  SELECT jsonb_object_agg(categoria, cnt)
  INTO v_por_cat
  FROM (
    SELECT categoria, count(*) AS cnt
    FROM caballo
    WHERE sociedad_id = p_sociedad_id AND activo = true
    GROUP BY categoria
  ) sub;

  RETURN jsonb_build_object(
    'total',     v_total,
    'sinCampo',  v_sin_campo,
    'sinChip',   v_sin_chip,
    'porCategoria', COALESCE(v_por_cat, '{}'::jsonb)
  );
END;
$$;


-- 3) RPC para listar caballos de una sociedad sin pasar por RLS fila a fila.
--    Chequea membresía una vez. Usado por CaballosPage (admin) y otros.
CREATE OR REPLACE FUNCTION get_caballos_sociedad(p_sociedad_id uuid)
RETURNS TABLE (
  id                  uuid,
  nombre              text,
  fecha_nacimiento    date,
  categoria           text,
  sexo                text,
  rol_reproductivo    text,
  estado_reproductivo text,
  prenada             boolean,
  fecha_prenez        date,
  observaciones       text,
  domador             text,
  numero_chip         text,
  numero_registro     text,
  activo              boolean,
  sociedad_id         uuid,
  campo_id            uuid,
  raza_id             int,
  pelaje_id           int,
  padre_id            uuid,
  padre_nombre        text,
  madre_id            uuid,
  madre_nombre        text,
  raza_nombre         text,
  pelaje_nombre       text,
  campo_nombre        text,
  tags                jsonb
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    c.id, c.nombre, c.fecha_nacimiento,
    c.categoria, c.sexo, c.rol_reproductivo, c.estado_reproductivo,
    COALESCE(c.prenada, false), c.fecha_prenez,
    c.observaciones, c.domador,
    c.numero_chip, c.numero_registro,
    c.activo, c.sociedad_id, c.campo_id,
    c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre   AS raza_nombre,
    pel.nombre AS pelaje_nombre,
    ca.nombre  AS campo_nombre,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ct.id, 'nombre', ct.nombre, 'color', ct.color, 'activo', ct.activo))
       FROM caballo_tag cta
       JOIN cat_tag ct ON ct.id = cta.tag_id
       WHERE cta.caballo_id = c.id),
      '[]'::jsonb
    ) AS tags
  FROM caballo c
  LEFT JOIN cat_raza   r   ON r.id   = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN campo      ca  ON ca.id  = c.campo_id
  WHERE c.sociedad_id = p_sociedad_id
    AND c.activo = true
    AND tiene_membresia(p_sociedad_id)  -- chequeo una sola vez (constante por query)
  ORDER BY c.nombre;
$$;
