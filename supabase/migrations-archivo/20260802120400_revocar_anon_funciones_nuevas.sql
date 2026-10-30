-- =============================================================================
-- Cerrar las funciones nuevas al rol anon
-- =============================================================================
-- Postgres otorga EXECUTE a PUBLIC por defecto, así que las funciones
-- SECURITY DEFINER de las migraciones 20260802* quedaban expuestas en
-- /rest/v1/rpc/... para usuarios sin sesión (advisor
-- `anon_security_definer_function_executable`).
--
-- `ancestros_caballo` es la más sensible: devolvería pedigree de cualquier
-- caballo a quien conozca su UUID.
-- =============================================================================

REVOKE ALL ON FUNCTION ancestros_caballo(UUID, INT)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION es_familiar_directo(UUID, UUID, INT)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_padrillos_familiares(UUID, UUID[])    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION guardar_ranking_padrillos(UUID, UUID[])   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_caballos_pedigree_vet()               FROM PUBLIC, anon;
-- Función de trigger: no debe ser invocable por nadie vía RPC.
REVOKE ALL ON FUNCTION bloquear_padrillo_familiar()              FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION ancestros_caballo(UUID, INT)            TO authenticated;
GRANT EXECUTE ON FUNCTION es_familiar_directo(UUID, UUID, INT)    TO authenticated;
GRANT EXECUTE ON FUNCTION get_padrillos_familiares(UUID, UUID[])  TO authenticated;
GRANT EXECUTE ON FUNCTION guardar_ranking_padrillos(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_caballos_pedigree_vet()             TO authenticated;
