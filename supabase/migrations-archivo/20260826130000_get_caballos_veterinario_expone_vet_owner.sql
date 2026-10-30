-- `get_caballos_veterinario` devuelve ahora `vet_owner_id`.
--
-- El panel del veterinario desglosa sus caballos por empresa y necesita separar
-- los propios —los que creó él y nunca transfirió— del resto. Hasta ahora la
-- única forma de detectarlos desde el front era `sociedad_id IS NULL`, que no es
-- lo mismo: el día que un vet comparta un caballo propio con un colega, ese
-- caballo le aparecería al colega como "mis caballos". La pertenencia la decide
-- `vet_owner_id`, así que se expone y se agrupa por eso.
--
-- La firma cambia (columna nueva en el RETURNS TABLE), así que hay DROP antes
-- del CREATE y hay que reponer el GRANT. El REVOKE del final deja el ACL igual
-- al de antes: el CREATE toma los default privileges de Supabase y suma un
-- GRANT a `anon` que la función no tenía. En la práctica no cambia nada
-- —PUBLIC ya tiene EXECUTE, y para `anon` la función devuelve cero filas porque
-- filtra por `auth.uid()`— pero no vale dejar drift en un SECURITY DEFINER.

DROP FUNCTION IF EXISTS public.get_caballos_veterinario();

CREATE FUNCTION public.get_caballos_veterinario()
RETURNS TABLE(
  id uuid, nombre text, fecha_nacimiento date, categoria text,
  rol_reproductivo text, numero_chip text, numero_registro text, activo boolean,
  sociedad_id uuid, empresa_nombre text, vet_owner_id uuid,
  campo_id uuid, raza_id integer, pelaje_id integer,
  padre_id uuid, padre_nombre text, madre_id uuid, madre_nombre text,
  raza_nombre text, pelaje_nombre text, campo_nombre text, propietario_nombre text
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
  $function$;

GRANT EXECUTE ON FUNCTION public.get_caballos_veterinario() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_caballos_veterinario() FROM anon;
