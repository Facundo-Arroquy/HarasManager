-- =============================================================================
-- 99 · Limpieza final
--
-- Cada INSERT del seed dispara el trigger de auditoría (fn_auditar). Esas filas
-- no son historia real de nadie, así que se descartan: la base arranca con la
-- auditoría vacía y solo registra lo que se haga a mano a partir de ahora.
-- =============================================================================
TRUNCATE public.auditoria;
