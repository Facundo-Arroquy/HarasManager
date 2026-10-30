-- embrion_insert: el embrión de un flushing también tiene que quedar a nombre
-- de la empresa de su donante.
--
-- Regla de negocio: el dueño de un embrión es el dueño de la donante a la que
-- se le extrajo, y eso es `embrion.sociedad_id` (la pantalla Embriones muestra
-- y filtra por esa columna). La policy ya lo exigía en la carga manual de
-- vitrificados (migración 20260923160124), pero para el embrión que sale de un
-- flushing solo pedía `vet_tiene_acceso(caballo_donante_id)`: que la sociedad
-- coincida con la de la donante lo sostenía el front
-- (`FlushingModal`: `sociedadActiva ?? recordatorio.sociedad_id`). Con empresa
-- activa A y un recordatorio de una donante de B, el embrión quedaba a nombre
-- de A y se mostraba como de A.
--
-- Cambio: los dos orígenes (flushing y carga manual) exigen que la donante
-- pertenezca a `embrion.sociedad_id`. Lo demás queda igual.
--
-- Alcance:
--   * Solo valida INSERT futuros. No toca filas existentes (verificado en
--     producción antes de escribirla: los 59 embriones ya cumplen) y no hay
--     backfill.
--   * ALTER POLICY en vez de DROP + CREATE: no hay instante sin policy.
--   * Si el front manda una sociedad distinta de la de la donante, el INSERT de
--     los embriones falla con "new row violates row-level security policy" y
--     `FlushingModal` lo informa ("El flushing se guardó, pero no se pudieron
--     crear los embriones…"). Antes se guardaba mal en silencio.
--   * No cubre UPDATE: `embrion_update` no tiene WITH CHECK, pero la app no
--     edita `sociedad_id` ni `caballo_donante_id` (EditarEmbrionModal).

ALTER POLICY embrion_insert ON public.embrion WITH CHECK (
  -- La donante pertenece a la empresa a la que queda asignado el embrión.
  EXISTS (
    SELECT 1 FROM caballo c
     WHERE c.id = embrion.caballo_donante_id
       AND c.sociedad_id = embrion.sociedad_id
  )
  AND (
    -- Desde un flushing: el vet con acceso a la donante.
    (flushing_id IS NOT NULL AND vet_tiene_acceso(caballo_donante_id))
    OR (
      -- Carga manual: solo vitrificado, a nombre de quien lo carga, por el vet
      -- con acceso a la donante o el admin de la sociedad.
      flushing_id IS NULL
      AND estado     = 'congelado'
      AND creado_por = auth.uid()
      AND (vet_tiene_acceso(caballo_donante_id) OR es_admin(sociedad_id))
    )
  )
);
