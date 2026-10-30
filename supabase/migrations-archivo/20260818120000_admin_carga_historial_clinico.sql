-- El admin de la empresa puede cargar consultas/tratamientos y corregir las
-- que cargó él mismo.
--
-- Hasta ahora `historial_clinico_insert` exigía rol veterinario (membresía o
-- `usuario.rol`), así que el admin veía el historial pero no podía escribirlo.
-- El UPDATE ya era `creado_por = auth.uid()` sin mirar el rol: alcanza con
-- habilitar el INSERT para que el admin pueda corregir lo suyo, y sigue sin
-- poder tocar lo que cargó un veterinario (inmutabilidad del historial).

DROP POLICY IF EXISTS historial_clinico_insert ON historial_clinico;

CREATE POLICY historial_clinico_insert ON historial_clinico
  FOR INSERT
  WITH CHECK (
    creado_por = auth.uid()
    AND (
      -- admin de la empresa dueña del caballo
      es_admin((
        SELECT c.sociedad_id FROM caballo c WHERE c.id = historial_clinico.caballo_id
      ))
      -- veterinario con membresía en esa empresa
      OR EXISTS (
        SELECT 1
        FROM membresia m
        JOIN cat_rol r ON r.id = m.rol_id
        WHERE m.usuario_id  = auth.uid()
          AND m.sociedad_id = (
            SELECT c.sociedad_id FROM caballo c WHERE c.id = historial_clinico.caballo_id
          )
          AND m.activa = TRUE
          AND r.nombre = 'veterinario'
      )
      -- veterinario global (independiente)
      OR EXISTS (
        SELECT 1 FROM usuario u
        WHERE u.id = auth.uid() AND u.rol = 'veterinario' AND u.activo = TRUE
      )
    )
  );

-- Editar una consulta reescribe partes y medicamentos: el front borra las filas
-- viejas y reinserta. Ninguna de las dos tablas tenía policy de DELETE, con lo
-- que ese borrado no afectaba ninguna fila y no daba error — las partes y los
-- medicamentos previos quedaban duplicados junto a los nuevos. Mismo predicado
-- que el INSERT/UPDATE: solo el autor del historial.

DROP POLICY IF EXISTS historial_parte_afectada_delete ON historial_parte_afectada;
CREATE POLICY historial_parte_afectada_delete ON historial_parte_afectada
  FOR DELETE TO authenticated
  USING ((
    SELECT h.creado_por FROM historial_clinico h
    WHERE h.id = historial_parte_afectada.historial_id
  ) = auth.uid());

DROP POLICY IF EXISTS historial_medicamento_delete ON historial_medicamento;
CREATE POLICY historial_medicamento_delete ON historial_medicamento
  FOR DELETE TO authenticated
  USING ((
    SELECT h.creado_por FROM historial_clinico h
    WHERE h.id = historial_medicamento.historial_id
  ) = auth.uid());
