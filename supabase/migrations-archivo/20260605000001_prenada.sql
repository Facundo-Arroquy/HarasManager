-- ─────────────────────────────────────────────────────────────────────────────
-- Task #14 — Tag de Preñada
-- Agrega prenada (boolean) y fecha_prenez (date) a la tabla caballo.
-- Crea RPC toggle_prenada_veterinario para que vets puedan actualizar el campo
-- sin saltear RLS (caballo.UPDATE solo permite admin haras / admin marca).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Nuevas columnas
ALTER TABLE caballo
  ADD COLUMN IF NOT EXISTS prenada     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_prenez DATE;

-- 2. Actualizar get_caballos_veterinario para que devuelva las nuevas columnas.
--    Si la función usa SELECT * ya las incluye automáticamente.
--    Si selecciona columnas explícitamente, agregar prenada y fecha_prenez.
--    Verificar en Supabase Dashboard → Database → Functions.

-- 3. RPC para veterinarios: toggle prenada con control de acceso
CREATE OR REPLACE FUNCTION toggle_prenada_veterinario(
  p_caballo_id   UUID,
  p_prenada      BOOLEAN,
  p_fecha_prenez DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar que el vet tiene acceso explícito a este caballo
  IF NOT vet_tiene_acceso(p_caballo_id) THEN
    RAISE EXCEPTION 'Sin acceso a este caballo';
  END IF;

  -- Solo aplica a yeguas
  IF NOT EXISTS (
    SELECT 1 FROM caballo WHERE id = p_caballo_id AND categoria = 'Yegua'
  ) THEN
    RAISE EXCEPTION 'Solo se puede marcar preñada a una Yegua';
  END IF;

  UPDATE caballo
  SET
    prenada      = p_prenada,
    fecha_prenez = CASE WHEN p_prenada THEN p_fecha_prenez ELSE NULL END,
    updated_at   = NOW()
  WHERE id = p_caballo_id;
END;
$$;
