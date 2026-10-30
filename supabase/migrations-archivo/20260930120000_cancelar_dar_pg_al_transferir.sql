-- fix: cancelar recordatorios "Dar PG" pendientes/vencidos de la receptora al transferir
--
-- Cuando se registra OV en una receptora, se agenda "Dar PG" a N dias.
-- Si la receptora se transfiere antes de que se cumpla, el "Dar PG" ya no
-- corresponde: la receptora pasa a otro flujo (Eco 1/2/3). Sin esta
-- cancelacion, el recordatorio queda flotando y confunde al vet.
--
-- Se agrega el UPDATE justo antes de los INSERTs de Eco 1/2/3 para que la
-- cancelacion quede dentro de la misma transaccion que la transferencia.

CREATE OR REPLACE FUNCTION registrar_transferencia_embrionaria(
  p_sociedad_id          uuid,
  p_fecha                date,
  p_caballo_receptora_id uuid,
  p_caballo_donante_id   uuid,
  p_embrion_id           uuid,
  p_padrillo_id          uuid    DEFAULT NULL,
  p_flushing_id          uuid    DEFAULT NULL,
  p_ovario_izq           text[]  DEFAULT '{}',
  p_ovario_der           text[]  DEFAULT '{}',
  p_cl_calidad           text    DEFAULT NULL,
  p_tono_uterino         text    DEFAULT NULL,
  p_tono_cervical        text    DEFAULT NULL,
  p_clasificacion        text    DEFAULT NULL,
  p_notas                text    DEFAULT NULL
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
  v_eco1     smallint;
  v_eco2     smallint;
  v_eco3     smallint;
BEGIN
  IF v_vet IS NULL THEN
    RAISE EXCEPTION 'Sesion no autenticada';
  END IF;

  IF NOT vet_tiene_acceso(p_caballo_receptora_id) THEN
    RAISE EXCEPTION 'Sin acceso a la receptora';
  END IF;

  IF NOT (
    vet_tiene_acceso(p_caballo_donante_id)
    OR es_admin(p_sociedad_id)
    OR is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Sin permiso para descontar el embrion de la donante';
  END IF;

  -- Lock de la fila: si otra transferencia esta usando este embrion, espera y
  -- despues ve el estado ya actualizado.
  SELECT estado INTO v_estado
  FROM embrion
  WHERE id                 = p_embrion_id
    AND sociedad_id        = p_sociedad_id
    AND caballo_donante_id = p_caballo_donante_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El embrion no existe o no pertenece a esa donante';
  END IF;

  -- 'en_nube' es stock vivo junto a 'disponible' y 'congelado'.
  IF v_estado NOT IN ('disponible', 'congelado', 'en_nube') THEN
    RAISE EXCEPTION 'El embrion ya no esta disponible (estado actual: %)', v_estado;
  END IF;

  INSERT INTO cria_registro_clinico (
    caballo_id, sociedad_id, fecha, veterinario_id,
    ovario_izq, ovario_der, utero, obs_chips,
    review_dias, observaciones
  ) VALUES (
    p_caballo_receptora_id, p_sociedad_id, p_fecha, v_vet,
    p_ovario_izq, p_ovario_der, '{}', ARRAY['Transferida'],
    NULL, p_notas
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

  -- NO se marca prenada = true aqui. La prenez solo se confirma cuando la
  -- Eco 1 devuelve resultado = 'prenada' (trigger sincronizar_prenez_ecografia).

  -- ── Cancelar "Dar PG" pendientes/vencidos de la receptora ──────────────────
  -- Al transferir, la receptora entra al flujo de ecografias: el "Dar PG"
  -- que se habia agendado al registrar OV ya no corresponde.
  UPDATE cria_recordatorio
  SET estado        = 'cancelado',
      cancel_motivo = 'Receptora transferida',
      updated_at    = now()
  WHERE caballo_id  = p_caballo_receptora_id
    AND sociedad_id = p_sociedad_id
    AND tipo        = 'Dar PG'
    AND estado      IN ('pendiente', 'vencido');

  -- Las tres ecografias, con los plazos del vet que transfiere.
  SELECT receptora_transf_a_eco1, receptora_transf_a_eco2, receptora_transf_a_eco3
  INTO v_eco1, v_eco2, v_eco3
  FROM cria_plazo_vet
  WHERE veterinario_id = v_vet;

  v_eco1 := COALESCE(v_eco1, 30);
  v_eco2 := COALESCE(v_eco2, 60);
  v_eco3 := COALESCE(v_eco3, 90);

  INSERT INTO cria_recordatorio (
    caballo_id, sociedad_id, tipo, fecha_vto, estado,
    veterinario_id, auto_generado, origen_registro_id
  ) VALUES
    (p_caballo_receptora_id, p_sociedad_id, 'Eco 1', p_fecha + v_eco1, 'pendiente', v_vet, true, v_registro),
    (p_caballo_receptora_id, p_sociedad_id, 'Eco 2', p_fecha + v_eco2, 'pendiente', v_vet, true, v_registro),
    (p_caballo_receptora_id, p_sociedad_id, 'Eco 3', p_fecha + v_eco3, 'pendiente', v_vet, true, v_registro);

  RETURN jsonb_build_object(
    'registro_id',      v_registro,
    'transferencia_id', v_transf,
    'embrion_id',       p_embrion_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_transferencia_embrionaria(
  uuid, date, uuid, uuid, uuid, uuid, uuid, text[], text[],
  text, text, text, text, text
) TO authenticated, service_role;
