-- =============================================================================
-- Fix: crear vet_tiene_acceso usando usuario.rol en lugar de membresia.
-- Los veterinarios reales del sistema usan usuario.rol = 'veterinario'
-- y no tienen entrada en la tabla membresia.
-- =============================================================================

CREATE OR REPLACE FUNCTION vet_tiene_acceso(p_caballo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario
    WHERE id = auth.uid()
      AND rol = 'veterinario'
      AND activo = TRUE
  );
$$;
