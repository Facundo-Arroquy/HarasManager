-- Limpieza única: cancelar recordatorios vencidos auto-generados donde el
-- animal ya fue atendido en un registro clínico o flushing posterior a la
-- fecha de vencimiento. Estos se acumularon porque la versión anterior de
-- cerrar_recordatorios_flushing solo cancelaba los de tipo 'Flushing'.
--
-- No se eliminan: se pasan a 'cancelado' con motivo para trazabilidad.

UPDATE cria_recordatorio r
SET estado        = 'cancelado',
    cancel_motivo = 'Limpieza: animal atendido en registro/flushing posterior',
    updated_at    = now()
WHERE r.estado = 'vencido'
  AND r.auto_generado = true
  AND (
    EXISTS (SELECT 1 FROM cria_registro_clinico reg
            WHERE reg.caballo_id = r.caballo_id AND reg.fecha > r.fecha_vto)
    OR EXISTS (SELECT 1 FROM cria_flushing f
               WHERE f.caballo_id = r.caballo_id AND f.fecha > r.fecha_vto)
  );
