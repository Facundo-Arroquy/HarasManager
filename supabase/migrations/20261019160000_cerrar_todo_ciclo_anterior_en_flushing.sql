-- cerrar_recordatorios_flushing solo cancelaba recordatorios de tipo 'Flushing'.
-- Al hacer un flushing (= fin de ciclo de la donante), los recordatorios de IN,
-- OXI, Revisión, Revisión PG, Dar PG del ciclo anterior quedaban colgados como
-- "vencidos" y ensuciaban la agenda del vet.
--
-- Ahora cancela TODOS los recordatorios auto-generados del ciclo anterior de la
-- donante, excepto los de Eco y Revisión Eco (que son de receptoras post-transfer).

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
    AND tipo NOT IN ('Eco 1', 'Eco 2', 'Eco 3', 'Revisión Eco');
END;
$$;
