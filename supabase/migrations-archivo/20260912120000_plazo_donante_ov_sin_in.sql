-- =============================================================================
-- Plazo "OV sin inseminar → Dar PG" de la donante, configurable por veterinario.
-- =============================================================================
-- Pedido de Facu (2026-09-12): si a una donante se le marca ovulación (OV) y no
-- fue inseminada antes, no tiene sentido agendar el Flushing —no hay embrión que
-- lavar—. En su lugar se agenda "Dar PG" a los 4 días, para cortar el ciclo.
--
-- La regla vive en `reglasParaRegistro` (crianzaStore). Acá solo va el plazo, en
-- `cria_plazo_vet` como el resto: manda el plazo del vet que hace el registro.
--
-- CHECK aparte para no redefinir `cria_plazo_vet_rangos`; mismo rango 1..30.
-- =============================================================================

ALTER TABLE cria_plazo_vet
  ADD COLUMN IF NOT EXISTS donante_ov_sin_in_a_dar_pg SMALLINT NOT NULL DEFAULT 4;

ALTER TABLE cria_plazo_vet DROP CONSTRAINT IF EXISTS cria_plazo_vet_rango_ov_sin_in;
ALTER TABLE cria_plazo_vet ADD CONSTRAINT cria_plazo_vet_rango_ov_sin_in CHECK (
  donante_ov_sin_in_a_dar_pg BETWEEN 1 AND 30
);
