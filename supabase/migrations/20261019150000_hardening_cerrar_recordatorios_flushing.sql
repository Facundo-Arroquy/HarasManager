-- cerrar_recordatorios_flushing era SECURITY DEFINER sin ninguna validación y
-- con EXECUTE para anon: cualquiera podía cerrar recordatorios de Flushing de
-- cualquier caballo de cualquier sociedad. Ahora exige acceso al caballo
-- (vet con acceso, miembro de la sociedad o superadmin) y se revoca a anon.
-- También se ata cria_reprogramacion.creado_por al usuario autenticado.

CREATE OR REPLACE FUNCTION cerrar_recordatorios_flushing(p_caballo_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada';
  END IF;

  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR tiene_membresia((SELECT c.sociedad_id FROM caballo c WHERE c.id = p_caballo_id))
    OR is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE cria_recordatorio
  SET estado = 'hecho', updated_at = now()
  WHERE caballo_id = p_caballo_id
    AND tipo = 'Flushing'
    AND estado IN ('pendiente', 'vencido');
END;
$$;

REVOKE ALL ON FUNCTION cerrar_recordatorios_flushing(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cerrar_recordatorios_flushing(UUID) TO authenticated;

DROP POLICY IF EXISTS "Vet inserta reprogramaciones de sus recordatorios" ON cria_reprogramacion;
CREATE POLICY "Vet inserta reprogramaciones de sus recordatorios"
  ON cria_reprogramacion FOR INSERT
  WITH CHECK (
    creado_por = auth.uid()
    AND EXISTS (SELECT 1 FROM cria_recordatorio r WHERE r.id = recordatorio_id)
  );
