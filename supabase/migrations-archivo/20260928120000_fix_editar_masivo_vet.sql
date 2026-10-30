-- Fix: edicion masiva de veterinarios.
-- Corrige los hallazgos del code review del PR #102:
--   1. Validacion de rol al inicio de la funcion.
--   2. UUID centinela para desasignar campo (00000000-... → campo_id = NULL).
--   3. UPDATE solo sobre caballos activos (AND activo = TRUE).
--   4. GRANT/REVOKE correctos para la funcion.
--   5. Comentarios actualizados sobre p_campo_id y p_subcategoria.

CREATE OR REPLACE FUNCTION editar_masivo_veterinario(
  p_caballo_ids   UUID[],
  p_campo_id      UUID     DEFAULT NULL,
  p_categoria     TEXT     DEFAULT NULL,
  p_subcategoria  TEXT     DEFAULT NULL,
  p_prenada       BOOLEAN  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  -- UUID centinela: el front lo manda cuando el usuario elige "Sin asignar".
  -- No puede ser NULL porque NULL ya significa "no tocar este campo".
  UUID_CERO CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- 1. Solo veterinarios activos pueden ejecutar esta funcion.
  IF NOT EXISTS (
    SELECT 1 FROM usuario WHERE id = auth.uid() AND rol = 'veterinario' AND activo = TRUE
  ) THEN
    RAISE EXCEPTION 'Solo veterinarios pueden usar esta función';
  END IF;

  -- 2. Validar que el vet tiene acceso a TODOS los caballos del lote.
  FOREACH v_id IN ARRAY p_caballo_ids LOOP
    IF NOT (
      vet_tiene_acceso(v_id)
      OR EXISTS (SELECT 1 FROM caballo WHERE id = v_id AND vet_owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'Sin acceso al caballo %', v_id;
    END IF;
  END LOOP;

  -- 3. Aplicar cambios.
  --
  -- p_campo_id puede ser:
  --   NULL            → no tocar campo_id (el front no incluyó este campo en los cambios)
  --   UUID_CERO       → limpiar campo_id (el usuario eligió "Sin asignar")
  --   cualquier UUID  → asignar ese campo
  --
  -- p_subcategoria puede ser:
  --   NULL  → no tocar rol_reproductivo
  --   ''    → quitar rol reproductivo (la RPC usa NULLIF para convertirlo en NULL)
  --   texto → asignar ese rol
  UPDATE caballo
  SET
    campo_id         = CASE
                         WHEN p_campo_id = UUID_CERO THEN NULL
                         WHEN p_campo_id IS NOT NULL THEN p_campo_id
                         ELSE campo_id
                       END,
    categoria        = COALESCE(p_categoria, categoria),
    rol_reproductivo = CASE WHEN p_subcategoria IS NOT NULL THEN NULLIF(p_subcategoria, '')
                            ELSE rol_reproductivo END,
    prenada          = COALESCE(p_prenada, prenada),
    fecha_prenez     = CASE WHEN p_prenada = FALSE THEN NULL
                            ELSE fecha_prenez END
  WHERE id = ANY(p_caballo_ids)
    AND activo = TRUE;
END;
$$;

-- Permisos: solo usuarios autenticados pueden llamar esta funcion.
REVOKE ALL ON FUNCTION editar_masivo_veterinario(UUID[], UUID, TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION editar_masivo_veterinario(UUID[], UUID, TEXT, TEXT, BOOLEAN)
  TO authenticated;
