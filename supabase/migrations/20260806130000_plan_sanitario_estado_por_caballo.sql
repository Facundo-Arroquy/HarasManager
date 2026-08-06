-- Los trabajos que se cargan juntos desde "Nuevo plan sanitario" (ej: Vacuna y
-- Desparasitación sobre el mismo grupo) pasan a compartir un plan_id, para poder
-- abrirlos como una sola grilla caballo × trabajo. Cada trabajo ya existente
-- queda como un plan de un solo tipo, que es lo que era.
ALTER TABLE trabajo_sanitario
  ADD COLUMN plan_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX idx_trabajo_sanitario_plan ON trabajo_sanitario (plan_id);

-- Estado por caballo y por trabajo. NULL = todavía sin definir: al cerrar el
-- plan hay que marcar cada celda. Solo 'realizado' escribe en el historial;
-- 'pendiente' es lo que se reprograma en un plan nuevo.
ALTER TABLE trabajo_sanitario_caballo
  ADD COLUMN estado TEXT CHECK (estado IN ('realizado', 'no_realizado', 'pendiente'));

-- Los trabajos ya cerrados se traducen desde `excluido`, que era el único dato
-- que había: incluido = se le hizo, excluido = no se le hizo.
UPDATE trabajo_sanitario_caballo tsc
   SET estado = CASE WHEN tsc.excluido THEN 'no_realizado' ELSE 'realizado' END
  FROM trabajo_sanitario t
 WHERE t.id = tsc.trabajo_id
   AND t.estado = 'realizado';

-- Cierra las celdas de un plan en una sola transacción: guarda el estado de cada
-- caballo/trabajo y escribe el historial clínico únicamente de los realizados.
-- El trabajo pasa a 'realizado' cuando ya no le quedan celdas sin definir.
-- Devuelve cuántas filas de historial se crearon.
CREATE OR REPLACE FUNCTION public.cerrar_plan_sanitario(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     UUID := auth.uid();
  v_count   INTEGER := 0;
  r         RECORD;
  v_trabajo trabajo_sanitario%ROWTYPE;
  v_tipo_id INTEGER;
  v_hist_id UUID;
  v_hist_actual UUID;
BEGIN
  FOR r IN
    SELECT (i->>'caballo_row_id')::uuid AS row_id,
           (i->>'estado')               AS estado
      FROM jsonb_array_elements(p_items) AS i
  LOOP
    IF r.estado NOT IN ('realizado', 'no_realizado', 'pendiente') THEN
      RAISE EXCEPTION 'Estado inválido: %', r.estado;
    END IF;

    SELECT t.* INTO v_trabajo
      FROM trabajo_sanitario_caballo tsc
      JOIN trabajo_sanitario t ON t.id = tsc.trabajo_id
     WHERE tsc.id = r.row_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fila de trabajo % no encontrada', r.row_id;
    END IF;

    -- Mismo criterio que la RLS de trabajo_sanitario: miembro de la sociedad,
    -- superadmin, o el veterinario que lo creó.
    IF NOT (tiene_membresia(v_trabajo.sociedad_id)
            OR is_superadmin()
            OR v_trabajo.creado_por = v_uid) THEN
      RAISE EXCEPTION 'Sin permiso sobre el trabajo %', v_trabajo.id;
    END IF;

    SELECT historial_id INTO v_hist_actual
      FROM trabajo_sanitario_caballo WHERE id = r.row_id;

    -- `excluido` se mantiene en línea con el estado para el flujo viejo de Sanidad.
    UPDATE trabajo_sanitario_caballo
       SET estado = r.estado, excluido = (r.estado <> 'realizado')
     WHERE id = r.row_id;

    IF r.estado = 'realizado' AND v_hist_actual IS NULL THEN
      INSERT INTO cat_tipo_consulta (nombre) VALUES (v_trabajo.nombre)
        ON CONFLICT (nombre) DO NOTHING;
      SELECT id INTO v_tipo_id FROM cat_tipo_consulta WHERE nombre = v_trabajo.nombre;

      INSERT INTO historial_clinico
        (caballo_id, tipo_consulta_id, fecha_consulta, tratamiento, observaciones, creado_por)
      SELECT tsc.caballo_id, v_tipo_id, NOW(), v_trabajo.tratamiento, v_trabajo.observaciones, v_uid
        FROM trabajo_sanitario_caballo tsc
       WHERE tsc.id = r.row_id
      RETURNING id INTO v_hist_id;

      UPDATE trabajo_sanitario_caballo SET historial_id = v_hist_id WHERE id = r.row_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  UPDATE trabajo_sanitario t
     SET estado = 'realizado', fecha_realizado = CURRENT_DATE
   WHERE t.estado = 'pendiente'
     AND NOT EXISTS (
       SELECT 1 FROM trabajo_sanitario_caballo tsc
        WHERE tsc.trabajo_id = t.id AND tsc.estado IS NULL
     )
     AND EXISTS (
       SELECT 1 FROM trabajo_sanitario_caballo tsc
        WHERE tsc.trabajo_id = t.id
          AND tsc.id IN (
            SELECT (i->>'caballo_row_id')::uuid FROM jsonb_array_elements(p_items) AS i
          )
     );

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cerrar_plan_sanitario(jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cerrar_plan_sanitario(jsonb) TO authenticated;
