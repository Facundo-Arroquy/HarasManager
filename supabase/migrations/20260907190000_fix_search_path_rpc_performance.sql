-- ============================================================================
-- Fija search_path en las 3 RPC nuevas de rpc_performance (20260907012508).
--
-- Son SECURITY DEFINER sin `SET search_path`, lo que el linter de Supabase
-- marca como WARN de seguridad (0011_function_search_path_mutable): sin un
-- search_path fijo, un objeto creado en un schema que precede a `public` en
-- el search_path del rol que las ejecuta podría "sombrear" una tabla/función
-- referenciada adentro y correr con los privilegios del owner de la función
-- (definer). Se replica el mismo patrón que ya usa
-- registrar_transferencia_embrionaria (SET search_path TO 'public').
--
-- Ya aplicado directo en prod (proyecto cbllmyboxyoumnhakvyj) el 2026-09-07;
-- este archivo solo sincroniza el repo con lo que ya corre en la base, para
-- que un `supabase db reset` o un ambiente nuevo no pierda el fix.
-- ============================================================================

ALTER FUNCTION public.get_caballos_veterinario() SET search_path = public;
ALTER FUNCTION public.get_dashboard_stats(uuid) SET search_path = public;
ALTER FUNCTION public.get_caballos_sociedad(uuid) SET search_path = public;
