-- =============================================================================
-- Selección de padre / madre: incluir animales dados de baja
-- =============================================================================
-- Definición de Gero (2026-08-02): al asignar madre se deben ver solo yeguas y
-- al asignar padre solo machos (Caballo o Padrillo), en ambos casos aunque el
-- animal esté dado de baja / muerto — el pedigree es histórico.
--
-- El admin consulta `caballo` directo (RLS ya le deja ver los inactivos de su
-- sociedad). El vet necesita esta RPC porque `get_caballos_veterinario` filtra
-- `c.activo = true`.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_caballos_pedigree_vet()
RETURNS TABLE (
  id          UUID,
  nombre      TEXT,
  categoria   TEXT,
  activo      BOOLEAN,
  sociedad_id UUID
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.nombre::TEXT, c.categoria::TEXT, c.activo, c.sociedad_id
  FROM acceso_vet av
  JOIN caballo c ON c.id = av.caballo_id
  WHERE av.vet_id = auth.uid()
    AND av.activo = TRUE
  ORDER BY c.nombre;
$$;

GRANT EXECUTE ON FUNCTION get_caballos_pedigree_vet() TO authenticated;
