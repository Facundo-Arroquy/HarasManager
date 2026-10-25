-- Límite freemium: hasta 5 caballos propios (sin sociedad) por veterinario,
-- salvo que tenga una suscripción activa. Ver docs/specs/roles-freemium-veterinarios.md §4.
CREATE OR REPLACE FUNCTION vet_puede_agregar_caballo(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT COUNT(*) FROM caballo
       WHERE vet_owner_id = p_usuario_id
         AND sociedad_id IS NULL
         AND activo = TRUE) < 5
    OR EXISTS (
      SELECT 1 FROM suscripcion_veterinario
       WHERE usuario_id = p_usuario_id
         AND estado = 'activa'
         AND (fecha_vencimiento IS NULL OR fecha_vencimiento > NOW())
    );
$$;
