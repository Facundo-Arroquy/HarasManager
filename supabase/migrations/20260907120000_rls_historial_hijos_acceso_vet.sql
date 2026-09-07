-- El veterinario independiente no ve partes afectadas ni medicamentos.
--
-- `historial_clinico_select` contempla las dos vías de acceso al historial
-- (`tiene_membresia` de la sociedad del caballo O una fila activa en
-- `acceso_vet`), pero `historial_parte_afectada_select` e
-- `historial_medicamento_select` solo tienen la rama `tiene_membresia`. Para el
-- vet que se autoregistra en /registro-veterinario (sin membresía en ninguna
-- sociedad) esa rama da FALSE, así que abre una consulta y ve diagnóstico,
-- tratamiento y observaciones pero las partes afectadas y los medicamentos le
-- vienen vacíos — incluso los que cargó él mismo.
--
-- Fix: sumarle a esas dos policies SELECT la misma rama `acceso_vet` que ya
-- tiene la tabla madre. No hay cambios de frontend.

DROP POLICY IF EXISTS "historial_parte_afectada_select" ON historial_parte_afectada;
CREATE POLICY "historial_parte_afectada_select"
  ON historial_parte_afectada FOR SELECT TO authenticated
  USING (
    tiene_membresia(
      (SELECT c.sociedad_id
       FROM caballo c
       JOIN historial_clinico h ON h.caballo_id = c.id
       WHERE h.id = historial_parte_afectada.historial_id)
    )
    OR EXISTS (
      SELECT 1
      FROM acceso_vet av
      JOIN historial_clinico h ON h.id = historial_parte_afectada.historial_id
      WHERE av.vet_id     = auth.uid()
        AND av.caballo_id  = h.caballo_id
        AND av.activo      = TRUE
    )
  );

DROP POLICY IF EXISTS "historial_medicamento_select" ON historial_medicamento;
CREATE POLICY "historial_medicamento_select"
  ON historial_medicamento FOR SELECT TO authenticated
  USING (
    tiene_membresia(
      (SELECT c.sociedad_id
       FROM caballo c
       JOIN historial_clinico h ON h.caballo_id = c.id
       WHERE h.id = historial_medicamento.historial_id)
    )
    OR EXISTS (
      SELECT 1
      FROM acceso_vet av
      JOIN historial_clinico h ON h.id = historial_medicamento.historial_id
      WHERE av.vet_id     = auth.uid()
        AND av.caballo_id  = h.caballo_id
        AND av.activo      = TRUE
    )
  );
