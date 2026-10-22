-- Fix: cerrar_recordatorios_flushing cancelaba la "Revisión PG" recién creada
-- por el trigger trg_cria_flushing_sincronizar_revision_pg.
--
-- Secuencia del bug:
--   1. INSERT cria_flushing con pg_given = true
--   2. Trigger AFTER INSERT crea "Revisión PG" (estado 'pendiente', auto_generado = true)
--   3. Frontend llama cerrar_recordatorios_flushing(caballo_id)
--   4. RPC cancela todo pendiente auto_generado excepto Eco → incluía la Revisión PG
--
-- Fix: agregar 'Revisión PG' a la lista de exclusión. Son recordatorios del
-- ciclo que ARRANCA con este flushing, no del ciclo anterior.

CREATE OR REPLACE FUNCTION cerrar_recordatorios_flushing(
  p_caballo_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada';
  END IF;

  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR tiene_membresia((SELECT c.sociedad_id FROM caballo c WHERE c.id = p_caballo_id))
    OR is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE cria_recordatorio
  SET estado        = 'cancelado',
      cancel_motivo = 'Ciclo cerrado por nuevo flushing',
      updated_at    = now()
  WHERE caballo_id = p_caballo_id
    AND estado IN ('pendiente', 'vencido')
    AND auto_generado = true
    AND tipo NOT IN ('Eco 1', 'Eco 2', 'Eco 3', 'Revisión Eco', 'Revisión PG');
END;
$$;

-- Recuperar los 4 registros cancelados indebidamente.
-- Solo tocamos los que tienen cancel_motivo exacto del bug y flushing_id NOT NULL
-- (confirmamos que los creó el trigger, no el frontend).
UPDATE cria_recordatorio
SET estado        = CASE
      WHEN fecha_vto < CURRENT_DATE THEN 'vencido'
      ELSE 'pendiente'
    END,
    cancel_motivo = NULL,
    updated_at    = now()
WHERE tipo = 'Revisión PG'
  AND estado = 'cancelado'
  AND cancel_motivo = 'Ciclo cerrado por nuevo flushing'
  AND flushing_id IS NOT NULL;
