-- Atributo "domador": texto libre con la persona que doma / tiene a cargo el
-- animal. Viene de la planilla de stock del cliente (columna "Domador", con
-- valores como "Saul", "Agustin", "Nico"), donde es un nombre escrito a mano y
-- no una entidad del sistema. Se guarda como TEXT y no como FK a `usuario` a
-- propósito: los domadores no son usuarios de la app ni tienen ficha propia.

ALTER TABLE caballo ADD COLUMN IF NOT EXISTS domador TEXT;

COMMENT ON COLUMN caballo.domador IS
  'Domador a cargo del animal. Texto libre — no es un usuario del sistema.';

-- El listado del veterinario devuelve columnas explícitas: sin agregarlo acá el
-- campo llegaría vacío al modal de edición y el UPDATE lo pisaría con NULL.
-- Sumar una columna al RETURNS TABLE cambia el tipo de retorno, así que Postgres
-- obliga a dropearla y recrearla (con sus grants).
DROP FUNCTION IF EXISTS public.get_caballos_veterinario();

CREATE OR REPLACE FUNCTION public.get_caballos_veterinario()
RETURNS TABLE(
  id uuid, nombre text, fecha_nacimiento date, categoria text,
  rol_reproductivo text, numero_chip text, numero_registro text,
  activo boolean, sociedad_id uuid, empresa_nombre text, vet_owner_id uuid,
  campo_id uuid, raza_id integer, pelaje_id integer,
  padre_id uuid, padre_nombre text, madre_id uuid, madre_nombre text,
  raza_nombre text, pelaje_nombre text, campo_nombre text,
  propietario_nombre text, domador text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT
      c.id, c.nombre, c.fecha_nacimiento,
      c.categoria, c.rol_reproductivo,
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
      c.domador
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
  $function$;

GRANT EXECUTE ON FUNCTION public.get_caballos_veterinario() TO authenticated, service_role;

-- `p_domador` va al final y con DEFAULT NULL para no romper las llamadas
-- posicionales que ya existan.
CREATE OR REPLACE FUNCTION public.actualizar_caballo_veterinario(
  p_caballo_id uuid,
  p_nombre text,
  p_fecha_nacimiento date,
  p_categoria text,
  p_subcategoria text DEFAULT NULL::text,
  p_raza_id integer DEFAULT NULL::integer,
  p_pelaje_id integer DEFAULT NULL::integer,
  p_numero_chip text DEFAULT NULL::text,
  p_numero_registro text DEFAULT NULL::text,
  p_padre_id uuid DEFAULT NULL::uuid,
  p_padre_nombre text DEFAULT NULL::text,
  p_madre_id uuid DEFAULT NULL::uuid,
  p_madre_nombre text DEFAULT NULL::text,
  p_campo_id uuid DEFAULT NULL::uuid,
  p_sexo text DEFAULT NULL::text,
  p_observaciones text DEFAULT NULL::text,
  p_domador text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo
      WHERE id = p_caballo_id AND vet_owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE caballo SET
    nombre           = p_nombre,
    fecha_nacimiento = p_fecha_nacimiento,
    categoria        = p_categoria,
    rol_reproductivo = p_subcategoria,
    raza_id          = p_raza_id,
    pelaje_id        = p_pelaje_id,
    numero_chip      = p_numero_chip,
    numero_registro  = p_numero_registro,
    padre_id         = p_padre_id,
    padre_nombre     = p_padre_nombre,
    madre_id         = p_madre_id,
    madre_nombre     = p_madre_nombre,
    campo_id         = p_campo_id,
    sexo             = p_sexo,
    observaciones    = p_observaciones,
    domador          = p_domador
  WHERE id = p_caballo_id;
END;
$function$;
