-- Cierra TODOS los recordatorios de tipo 'Flushing' abiertos de una donante,
-- sin importar fecha de vencimiento ni quién los creó. SECURITY DEFINER
-- esquiva la RLS de UPDATE que exige veterinario_id = auth.uid().
-- Patrón idéntico al de registrar_resultado_ecografia y registrar_transferencia_embrionaria.

CREATE OR REPLACE FUNCTION cerrar_recordatorios_flushing(p_caballo_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE cria_recordatorio
  SET estado = 'hecho', updated_at = now()
  WHERE caballo_id = p_caballo_id
    AND tipo = 'Flushing'
    AND estado IN ('pendiente', 'vencido');
END;
$$;
