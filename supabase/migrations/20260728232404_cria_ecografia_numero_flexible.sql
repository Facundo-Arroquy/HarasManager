-- =============================================================================
-- cria_ecografia: permitir más de 3 ecografías por transferencia
-- =============================================================================
-- Definición de Gero: normalmente se hacen 3 ecos, pero (raro) puede haber más.
-- El CHECK original `numero IN (1,2,3)` lo impedía. Se reemplaza por `numero >= 1`.
-- Se conserva el UNIQUE (transferencia_id, numero) para no duplicar el mismo N°.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.cria_ecografia'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%numero%'
  LOOP
    EXECUTE format('ALTER TABLE public.cria_ecografia DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.cria_ecografia
  ADD CONSTRAINT cria_ecografia_numero_check CHECK (numero >= 1);
