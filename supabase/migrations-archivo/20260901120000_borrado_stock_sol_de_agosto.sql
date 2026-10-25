-- Borrado físico del stock de caballos de la sociedad "Sol de Agosto"
-- (sociedad_id = fc880764-c628-4961-92f9-527a0bf03d8f) para reemplazarlo por
-- el stock real cargado desde Excel (ver migración siguiente).
--
-- ADVERTENCIA: esto es un DELETE físico, no la baja lógica que usa el resto
-- del sistema. Se ejecuta a pedido explícito del cliente, confirmado varias
-- veces con el impacto real mostrado de antemano (incluye historial clínico
-- y trabajo de cría en curso). Se hizo backup de las filas afectadas fuera
-- de la base antes de aplicar esta migración.
--
-- `caballo` no tiene policy RLS de DELETE (ver docs/SKILL.md); esta
-- migración corre con privilegios elevados vía el MCP de Supabase, que
-- bypassa RLS pero no las foreign keys -- por eso el orden hijos-antes-que-
-- padres, igual que hace superadmin_eliminar_usuario(). cria_transferencia
-- referencia embrion_id (va antes de borrar embrion) y trabajo_sanitario_caballo
-- referencia historial_id (va antes de borrar historial_clinico).

DO $$
DECLARE
  v_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO v_ids
  FROM caballo
  WHERE sociedad_id = 'fc880764-c628-4961-92f9-527a0bf03d8f';

  DELETE FROM cria_estado_transicion WHERE caballo_id = ANY(v_ids);
  DELETE FROM cria_ecografia WHERE caballo_receptora_id = ANY(v_ids);
  DELETE FROM cria_transferencia WHERE caballo_receptora_id = ANY(v_ids) OR caballo_donante_id = ANY(v_ids) OR padrillo_id = ANY(v_ids);
  DELETE FROM embrion WHERE padrillo_id = ANY(v_ids) OR caballo_donante_id = ANY(v_ids);
  DELETE FROM cria_flushing WHERE caballo_id = ANY(v_ids) OR padrillo_id = ANY(v_ids);
  DELETE FROM cria_recordatorio WHERE caballo_id = ANY(v_ids);
  DELETE FROM cria_registro_clinico WHERE caballo_id = ANY(v_ids) OR padrillo_id = ANY(v_ids);
  DELETE FROM trabajo_sanitario_caballo WHERE caballo_id = ANY(v_ids);
  DELETE FROM historial_clinico WHERE caballo_id = ANY(v_ids);
  DELETE FROM acceso_vet WHERE caballo_id = ANY(v_ids);
  DELETE FROM venta_caballo WHERE caballo_id = ANY(v_ids);
  DELETE FROM propiedad WHERE caballo_id = ANY(v_ids);

  -- caballo_tag, alerta_caballo, torneo_asignacion, cria_padrillo_preferido
  -- tienen ON DELETE CASCADE, no requieren DELETE manual.

  DELETE FROM caballo WHERE id = ANY(v_ids);
END $$;
