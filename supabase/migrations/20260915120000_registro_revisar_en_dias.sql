-- =============================================================================
-- "Revisar en X días" en el registro reproductivo.
-- =============================================================================
-- Pedido de Facu (2026-09-15): además de los recordatorios que salen de las
-- reglas (fijas y propias del vet), el veterinario puede pedir una revisión a
-- los X días contados desde la fecha del registro. X lo completa él en el
-- modal; 0 = sin revisión pedida, que es el default.
--
-- Es el hermano por cantidad de días de `review_manana` (que agenda 'Revisión'
-- el próximo lunes/miércoles/viernes): las dos conviven y las dos se suman a
-- las reglas. Si ambas caen el mismo día se agenda una sola 'Revisión'
-- (la deduplicación vive en `reglasParaRegistro`, crianzaStore).
--
-- 0..365: mismo techo que `cria_regla_recordatorio.dias`; el 0 entra porque acá
-- significa "ninguna", no un plazo.
-- =============================================================================

ALTER TABLE cria_registro_clinico
  ADD COLUMN IF NOT EXISTS revisar_en_dias SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE cria_registro_clinico DROP CONSTRAINT IF EXISTS cria_registro_revisar_en_dias_rango;
ALTER TABLE cria_registro_clinico ADD CONSTRAINT cria_registro_revisar_en_dias_rango CHECK (
  revisar_en_dias BETWEEN 0 AND 365
);

COMMENT ON COLUMN cria_registro_clinico.revisar_en_dias IS
  'Días hasta la revisión que pidió el vet en este registro. 0 = no pidió ninguna. Genera un recordatorio ''Revisión'' a fecha + revisar_en_dias, además de los de las reglas.';
