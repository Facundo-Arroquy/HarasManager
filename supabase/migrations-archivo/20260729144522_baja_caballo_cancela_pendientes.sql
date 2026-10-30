-- =============================================================================
-- Baja de un caballo → cancelación en cascada de pendientes
-- =============================================================================
-- Definición de Gero: al dar de baja (o marcar muerta) una yegua, lo pendiente
-- se cancela solo en cascada, pero se conserva el historial del animal.
--
-- Se implementa con un trigger sobre `caballo` que dispara cuando `activo` pasa
-- a false, así aplica venga de donde venga (baja manual, venta, etc.):
--   - cria_recordatorio pendientes/vencidos → 'cancelado'
--   - trabajo_sanitario_caballo de trabajos pendientes → excluido = true
-- No se toca el historial clínico ni los registros ya hechos.

CREATE OR REPLACE FUNCTION cancelar_pendientes_por_baja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recordatorios del centro de cría pendientes/vencidos → cancelados
  UPDATE cria_recordatorio
    SET estado = 'cancelado',
        cancel_motivo = COALESCE(cancel_motivo, 'Baja del animal')
    WHERE caballo_id = NEW.id
      AND estado IN ('pendiente', 'vencido');

  -- Trabajos sanitarios pendientes: excluir al caballo (sin cancelar el trabajo
  -- completo, que puede tener otros caballos)
  UPDATE trabajo_sanitario_caballo tsc
    SET excluido = true
    FROM trabajo_sanitario t
    WHERE tsc.trabajo_id = t.id
      AND tsc.caballo_id = NEW.id
      AND t.estado = 'pendiente'
      AND tsc.excluido = false
      AND tsc.historial_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancelar_pendientes_baja ON caballo;
CREATE TRIGGER trg_cancelar_pendientes_baja
  AFTER UPDATE OF activo ON caballo
  FOR EACH ROW
  WHEN (OLD.activo IS DISTINCT FROM NEW.activo AND NEW.activo = false)
  EXECUTE FUNCTION cancelar_pendientes_por_baja();
