-- Nombre de las empresas que el usuario puede ver.
--
-- La RLS de `sociedad` es `tiene_membresia(id)`, así que el veterinario no
-- puede leer el nombre de las empresas con las que trabaja: en el calendario
-- veía un trabajo sanitario sin saber de qué haras venía ni quién se lo
-- asignó. Mismo criterio que `get_caballos_veterinario`, que ya resuelve el
-- `empresa_nombre` de los caballos por esta vía.
--
-- Devuelve solo las empresas donde el que pregunta tiene membresía o un
-- `acceso_vet` activo sobre algún caballo: no expone el padrón de sociedades.

CREATE OR REPLACE FUNCTION get_empresas_visibles()
RETURNS TABLE (id UUID, nombre TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.nombre::TEXT
    FROM sociedad s
   WHERE s.activa
     AND (
       tiene_membresia(s.id)
       OR EXISTS (
         SELECT 1
           FROM acceso_vet av
           JOIN caballo c ON c.id = av.caballo_id
          WHERE av.vet_id = auth.uid()
            AND av.activo
            AND c.sociedad_id = s.id
       )
     )
   ORDER BY s.nombre;
$$;
