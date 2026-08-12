-- `get_alertas_vet` quedó ejecutable por PUBLIC (y por lo tanto anon) desde su
-- creación: `CREATE OR REPLACE` preserva los grants, así que la reescritura de
-- `20260812120300` la arrastró igual.
--
-- No filtra datos — con anon, `auth.uid()` es NULL y el filtro `creado_por =
-- auth.uid()` no matchea nada — pero es una SECURITY DEFINER expuesta en
-- /rest/v1/rpc/ sin sesión, que es justamente lo que marca el advisor
-- `anon_security_definer_function_executable`. Mismo criterio que la migración
-- 20260802120400.
REVOKE ALL ON FUNCTION get_alertas_vet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_alertas_vet() TO authenticated;
