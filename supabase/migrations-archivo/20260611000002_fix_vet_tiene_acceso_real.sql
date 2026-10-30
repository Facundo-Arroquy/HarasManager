-- =============================================================================
-- Fix: restaurar vet_tiene_acceso con verificación real en acceso_veterinario.
-- La migración 20260528000001 introdujo una regresión que retornaba TRUE para
-- cualquier vet activo sin consultar acceso_veterinario.
-- =============================================================================

CREATE OR REPLACE FUNCTION vet_tiene_acceso(p_caballo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuario u
    WHERE u.id     = auth.uid()
      AND u.rol    = 'veterinario'
      AND u.activo = TRUE
  )
  AND EXISTS (
    SELECT 1
    FROM acceso_veterinario av
    WHERE av.vet_id = auth.uid()
      AND av.activo = TRUE
      AND (
        av.caballo_id = p_caballo_id
        OR av.marca_id = (SELECT marca_id FROM caballo WHERE id = p_caballo_id)
      )
  );
$$;
