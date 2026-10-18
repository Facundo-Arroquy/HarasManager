-- =============================================================================
-- ECO vacía + resincronizar → genera "Dar PG" automáticamente
--
-- Cuando una receptora da resultado 'vacia_resincronizar', se agenda un
-- recordatorio "Dar PG" para reiniciar su ciclo. El plazo usado es
-- receptora_ov_a_dar_pg (default 3 días).
--
-- Además, se cancelan "Dar PG" pendientes previos de esa receptora antes de
-- crear uno nuevo, para evitar duplicados si la eco se borra y se recarga.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.registrar_resultado_ecografia(
  p_transferencia_id uuid,p_numero smallint,p_fecha date,p_resultado text,
  p_ovario_izq text[] DEFAULT '{}',p_ovario_der text[] DEFAULT '{}',p_notas text DEFAULT NULL,
  p_origen_recordatorio_id uuid DEFAULT NULL,p_revision_dias smallint DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_t cria_transferencia%ROWTYPE; v_id uuid;
  v_revision smallint; v_eco2 smallint; v_eco3 smallint;
  v_dias_pg smallint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no autenticada'; END IF;
  IF p_numero NOT BETWEEN 1 AND 3 OR p_resultado NOT IN ('prenada','volver_a_ver','vacia','vacia_resincronizar')
    THEN RAISE EXCEPTION 'Resultado de ECO inválido'; END IF;
  IF p_resultado='volver_a_ver' AND (p_revision_dias IS NULL OR p_revision_dias NOT BETWEEN 1 AND 120)
    THEN RAISE EXCEPTION 'Indicá entre 1 y 120 días para volver a ver'; END IF;
  SELECT * INTO v_t FROM cria_transferencia WHERE id=p_transferencia_id FOR UPDATE;
  IF NOT FOUND OR NOT vet_tiene_acceso(v_t.caballo_receptora_id) THEN
    RAISE EXCEPTION 'Transferencia inexistente o sin acceso'; END IF;
  IF NOT _cria_transferencia_vigente(v_t.id) THEN RAISE EXCEPTION 'La transferencia ya no está vigente'; END IF;
  SELECT COALESCE(max(revision),0)+1 INTO v_revision FROM cria_ecografia
    WHERE transferencia_id=v_t.id AND numero=p_numero;
  INSERT INTO cria_ecografia(sociedad_id,transferencia_id,caballo_receptora_id,veterinario_id,
    numero,revision,fecha,resultado,ovario_izq,ovario_der,notas,origen_recordatorio_id)
  VALUES(v_t.sociedad_id,v_t.id,v_t.caballo_receptora_id,v_uid,p_numero,v_revision,p_fecha,p_resultado,
    p_ovario_izq,p_ovario_der,p_notas,p_origen_recordatorio_id) RETURNING id INTO v_id;
  UPDATE cria_recordatorio SET estado='hecho',updated_at=now()
    WHERE id=p_origen_recordatorio_id AND estado IN ('pendiente','vencido');
  INSERT INTO cria_evento_reproductivo(sociedad_id,caballo_id,transferencia_id,tipo,datos,creado_por)
  VALUES(v_t.sociedad_id,v_t.caballo_receptora_id,v_t.id,'ecografia',
    jsonb_build_object('eco',p_numero,'revision',v_revision,'fecha',p_fecha,'resultado',p_resultado),v_uid);
  IF p_resultado='prenada' THEN
    UPDATE cria_seguimiento_gestacion SET estado='prenada',eco_actual=LEAST(p_numero+1,3),updated_at=now()
      WHERE transferencia_id=v_t.id;
    SELECT receptora_transf_a_eco2,receptora_transf_a_eco3 INTO v_eco2,v_eco3 FROM cria_plazo_vet WHERE veterinario_id=v_uid;
    INSERT INTO cria_recordatorio(caballo_id,sociedad_id,tipo,fecha_vto,estado,veterinario_id,auto_generado,
      origen_registro_id,transferencia_id,eco_numero) VALUES
      (v_t.caballo_receptora_id,v_t.sociedad_id,'Eco 2',v_t.fecha+COALESCE(v_eco2,60),'pendiente',v_uid,true,v_t.registro_id,v_t.id,2),
      (v_t.caballo_receptora_id,v_t.sociedad_id,'Eco 3',v_t.fecha+COALESCE(v_eco3,90),'pendiente',v_uid,true,v_t.registro_id,v_t.id,3)
    ON CONFLICT DO NOTHING;
  ELSIF p_resultado='volver_a_ver' THEN
    UPDATE cria_seguimiento_gestacion SET estado='volver_a_ver',eco_actual=p_numero,updated_at=now() WHERE transferencia_id=v_t.id;
    INSERT INTO cria_recordatorio(caballo_id,sociedad_id,tipo,fecha_vto,estado,veterinario_id,auto_generado,
      origen_registro_id,transferencia_id,eco_numero,notas)
    VALUES(v_t.caballo_receptora_id,v_t.sociedad_id,'Revisión Eco',p_fecha+p_revision_dias,'pendiente',v_uid,true,
      v_t.registro_id,v_t.id,p_numero,format('Volver a ver ECO %s en %s días',p_numero,p_revision_dias));
    PERFORM _cria_cambiar_estado_reproductivo(v_t.caballo_receptora_id,v_t.sociedad_id,'pendiente_eco',
      format('ECO %s: volver a ver',p_numero),v_uid);
  ELSE
    -- vacía o vacía_resincronizar
    UPDATE cria_seguimiento_gestacion SET estado=p_resultado,finalizado_at=now(),updated_at=now() WHERE transferencia_id=v_t.id;
    UPDATE caballo SET prenada=false,fecha_prenez=NULL,updated_at=now() WHERE id=v_t.caballo_receptora_id;
    UPDATE cria_recordatorio SET estado='cancelado',cancel_motivo='Seguimiento finalizado',updated_at=now()
      WHERE transferencia_id=v_t.id AND estado IN ('pendiente','vencido');
    PERFORM _cria_cambiar_estado_reproductivo(v_t.caballo_receptora_id,v_t.sociedad_id,
      CASE WHEN p_resultado='vacia_resincronizar' THEN 'volviendo_sincronizar' ELSE 'vacia' END,
      format('ECO %s: %s',p_numero,p_resultado),v_uid);

    -- Resincronizar → agendar "Dar PG" para reiniciar ciclo de la receptora
    IF p_resultado = 'vacia_resincronizar' THEN
      -- Cancelar "Dar PG" pendientes previos de esta receptora (evitar duplicados)
      UPDATE cria_recordatorio SET estado='cancelado',cancel_motivo='Reemplazado por nueva resincronización',updated_at=now()
        WHERE caballo_id=v_t.caballo_receptora_id AND tipo='Dar PG' AND estado IN ('pendiente','vencido');

      SELECT receptora_ov_a_dar_pg INTO v_dias_pg FROM cria_plazo_vet WHERE veterinario_id=v_uid;
      INSERT INTO cria_recordatorio(caballo_id,sociedad_id,tipo,fecha_vto,estado,veterinario_id,
        notas,auto_generado)
      VALUES(v_t.caballo_receptora_id,v_t.sociedad_id,'Dar PG',
        p_fecha+COALESCE(v_dias_pg,3),'pendiente',v_uid,
        format('Resincronización tras ECO %s vacía',p_numero),true);
    END IF;
  END IF;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.registrar_resultado_ecografia(uuid,smallint,date,text,text[],text[],text,uuid,smallint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_resultado_ecografia(uuid,smallint,date,text,text[],text[],text,uuid,smallint) TO authenticated;
