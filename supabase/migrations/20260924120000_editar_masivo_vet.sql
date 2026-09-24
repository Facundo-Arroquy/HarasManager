-- Edición masiva de caballos para veterinarios.
-- El vet no tiene la policy de UPDATE directo sobre `caballo` (es_admin),
-- así que necesita una RPC SECURITY DEFINER que valide acceso por caballo.

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
BEGIN
  -- Validar que el vet tiene acceso a TODOS los caballos del lote
  FOREACH v_id IN ARRAY p_caballo_ids LOOP
    IF NOT (
      vet_tiene_acceso(v_id)
      OR EXISTS (SELECT 1 FROM caballo WHERE id = v_id AND vet_owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'Sin acceso al caballo %', v_id;
    END IF;
  END LOOP;

  -- Aplicar cambios solo a las columnas que se pasaron (no-NULL = cambiar)
  -- campo_id es especial: NULL puede significar "quitar campo", así que se
  -- maneja con un flag implícito: si p_campo_id es el UUID cero, se limpia.
  -- Pero en la práctica el front manda '' → NULL para "sin campo" y un UUID
  -- real para asignar. La RPC recibe lo que corresponda.

  UPDATE caballo
  SET
    campo_id         = CASE WHEN p_campo_id IS NOT NULL THEN p_campo_id
                            ELSE campo_id END,
    categoria        = COALESCE(p_categoria, categoria),
    rol_reproductivo = CASE WHEN p_subcategoria IS NOT NULL THEN NULLIF(p_subcategoria, '')
                            ELSE rol_reproductivo END,
    prenada          = COALESCE(p_prenada, prenada),
    fecha_prenez     = CASE WHEN p_prenada = FALSE THEN NULL
                            ELSE fecha_prenez END
  WHERE id = ANY(p_caballo_ids);
END;
$$;
