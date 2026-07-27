-- =============================================================================
-- RPC transaccional para la transferencia embrionaria.
--
-- Hasta ahora el frontend hacía tres llamadas sueltas: insert del registro
-- clínico, insert de la transferencia y update del embrión a 'transferido'.
-- Si la tercera fallaba quedaban las dos primeras y el embrión seguía figurando
-- disponible — exactamente el estado inconsistente que dejaron las 9
-- transferencias de julio.
--
-- Además, entre el SELECT de embriones disponibles y el UPDATE había una
-- ventana en la que dos vets podían transferir el mismo embrión a receptoras
-- distintas. El SELECT ... FOR UPDATE de acá cierra esa carrera.
--
-- SECURITY DEFINER: bypassa RLS, así que los permisos se verifican explícitamente
-- replicando el criterio de las policies que sustituye:
--   cria_transf_insert → vet_tiene_acceso(caballo_receptora_id)
--   embrion_update     → vet_tiene_acceso(caballo_donante_id) OR es_admin OR is_superadmin
--
-- El veterinario_id sale de auth.uid(), no de un parámetro: no se puede falsear
-- desde el cliente.
--
-- Aplicada en prod vía MCP como 20260724000626_rpc_registrar_transferencia_embrionaria.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.registrar_transferencia_embrionaria(
  p_sociedad_id          uuid,
  p_fecha                date,
  p_caballo_receptora_id uuid,
  p_caballo_donante_id   uuid,
  p_embrion_id           uuid,
  p_padrillo_id          uuid   DEFAULT NULL,
  p_flushing_id          uuid   DEFAULT NULL,
  p_ovario_izq           text[] DEFAULT '{}',
  p_ovario_der           text[] DEFAULT '{}',
  p_cl_calidad           text   DEFAULT NULL,
  p_tono_uterino         text   DEFAULT NULL,
  p_tono_cervical        text   DEFAULT NULL,
  p_clasificacion        text   DEFAULT NULL,
  p_notas                text   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vet      uuid := auth.uid();
  v_estado   text;
  v_registro uuid;
  v_transf   uuid;
BEGIN
  IF v_vet IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada';
  END IF;

  IF NOT vet_tiene_acceso(p_caballo_receptora_id) THEN
    RAISE EXCEPTION 'Sin acceso a la receptora';
  END IF;

  IF NOT (
    vet_tiene_acceso(p_caballo_donante_id)
    OR es_admin(p_sociedad_id)
    OR is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Sin permiso para descontar el embrión de la donante';
  END IF;

  -- Lock de la fila: si otra transferencia está usando este embrión, espera y
  -- después ve el estado ya actualizado.
  SELECT estado INTO v_estado
  FROM embrion
  WHERE id                 = p_embrion_id
    AND sociedad_id        = p_sociedad_id
    AND caballo_donante_id = p_caballo_donante_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El embrión no existe o no pertenece a esa donante';
  END IF;

  IF v_estado NOT IN ('disponible', 'congelado') THEN
    RAISE EXCEPTION 'El embrión ya no está disponible (estado actual: %)', v_estado;
  END IF;

  INSERT INTO cria_registro_clinico (
    caballo_id, sociedad_id, fecha, veterinario_id,
    ovario_izq, ovario_der, utero, obs_chips,
    review_manana, observaciones
  ) VALUES (
    p_caballo_receptora_id, p_sociedad_id, p_fecha, v_vet,
    p_ovario_izq, p_ovario_der, '{}', ARRAY['Transferida'],
    false, p_notas
  )
  RETURNING id INTO v_registro;

  INSERT INTO cria_transferencia (
    sociedad_id, fecha, veterinario_id, registro_id,
    caballo_receptora_id, caballo_donante_id, padrillo_id,
    flushing_id, embrion_id,
    cl_calidad, tono_uterino, tono_cervical, clasificacion, notas
  ) VALUES (
    p_sociedad_id, p_fecha, v_vet, v_registro,
    p_caballo_receptora_id, p_caballo_donante_id, p_padrillo_id,
    p_flushing_id, p_embrion_id,
    p_cl_calidad, p_tono_uterino, p_tono_cervical, p_clasificacion, p_notas
  )
  RETURNING id INTO v_transf;

  UPDATE embrion
  SET estado = 'transferido', updated_at = now()
  WHERE id = p_embrion_id;

  RETURN jsonb_build_object(
    'registro_id',      v_registro,
    'transferencia_id', v_transf,
    'embrion_id',       p_embrion_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_transferencia_embrionaria(
  uuid, date, uuid, uuid, uuid, uuid, uuid, text[], text[], text, text, text, text, text
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.registrar_transferencia_embrionaria(
  uuid, date, uuid, uuid, uuid, uuid, uuid, text[], text[], text, text, text, text, text
) TO authenticated;
