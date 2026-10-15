-- Cambia las FK de cria_recordatorio a ON DELETE CASCADE para que al eliminar
-- una transferencia, flushing o registro clínico se borren sus recordatorios.

ALTER TABLE cria_recordatorio
  DROP CONSTRAINT cria_recordatorio_transferencia_id_fkey,
  ADD CONSTRAINT cria_recordatorio_transferencia_id_fkey
    FOREIGN KEY (transferencia_id) REFERENCES cria_transferencia(id) ON DELETE CASCADE;

ALTER TABLE cria_recordatorio
  DROP CONSTRAINT cria_recordatorio_flushing_id_fkey,
  ADD CONSTRAINT cria_recordatorio_flushing_id_fkey
    FOREIGN KEY (flushing_id) REFERENCES cria_flushing(id) ON DELETE CASCADE;

ALTER TABLE cria_recordatorio
  DROP CONSTRAINT cria_recordatorio_origen_registro_id_fkey,
  ADD CONSTRAINT cria_recordatorio_origen_registro_id_fkey
    FOREIGN KEY (origen_registro_id) REFERENCES cria_registro_clinico(id) ON DELETE CASCADE;

-- Actualiza la función para borrar recordatorios explícitamente antes del DELETE
-- (cinturón y tirantes: el CASCADE también los borraría).
CREATE OR REPLACE FUNCTION eliminar_transferencia_cria(p_transferencia_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  t      cria_transferencia%ROWTYPE;
  v_ecos integer;
BEGIN
  SELECT * INTO t FROM cria_transferencia WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La transferencia no existe.';
  END IF;
  IF t.veterinario_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó la transferencia puede eliminarla.';
  END IF;

  SELECT COUNT(*) INTO v_ecos FROM cria_ecografia WHERE transferencia_id = p_transferencia_id;
  IF v_ecos > 0 THEN
    RAISE EXCEPTION 'La transferencia tiene % ecografía(s) cargada(s): eliminalas primero, empezando por la última.', v_ecos;
  END IF;

  -- Borrar recordatorios asociados
  DELETE FROM cria_recordatorio WHERE transferencia_id = p_transferencia_id;

  UPDATE cria_estado_transicion SET transferencia_origen_id = NULL
   WHERE transferencia_origen_id = p_transferencia_id;

  DELETE FROM cria_transferencia WHERE id = p_transferencia_id;

  IF t.embrion_id IS NOT NULL THEN
    UPDATE embrion SET estado = 'disponible', updated_at = now()
     WHERE id = t.embrion_id AND estado = 'transferido';
  END IF;

  UPDATE caballo c
     SET prenada = false, fecha_prenez = NULL, updated_at = now()
   WHERE c.id = t.caballo_receptora_id
     AND c.prenada
     AND c.fecha_prenez = t.fecha
     AND NOT EXISTS (
       SELECT 1 FROM cria_transferencia x
        WHERE x.caballo_receptora_id = t.caballo_receptora_id
          AND x.fecha >= t.fecha
     );

  PERFORM _cria_borrar_registro(t.registro_id);
END;
$$;
