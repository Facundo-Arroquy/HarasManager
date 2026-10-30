-- =============================================================================
-- Nuevo destino para un embrión recién flusheado: "en nube".
-- =============================================================================
-- Al cargar el flushing, cada embrión recuperado se manda a uno de tres lados:
--   transferir  → se transfiere en el acto a una receptora (estado 'transferido'
--                 vía registrar_transferencia_embrionaria)
--   vitrificar  → queda congelado en el tanque      (estado 'congelado')
--   en nube     → queda en el stock de "la nube"    (estado 'en_nube')  ← nuevo
--
-- "En nube" es el nombre provisorio que usó Facu; el término correcto lo define
-- Gero y se renombra después. Se guarda como estado del embrión y no como una
-- tabla aparte porque, igual que 'congelado', es stock vivo: sale de ahí cuando
-- se transfiere.
--
-- Por eso registrar_transferencia_embrionaria también tiene que aceptarlo como
-- estado de partida — si no, un embrión en nube nunca se podría transferir.
-- La función se recrea entera (única diferencia: el IF de la línea del estado).
-- =============================================================================

ALTER TABLE embrion DROP CONSTRAINT IF EXISTS embrion_estado_check;
ALTER TABLE embrion ADD CONSTRAINT embrion_estado_check
  CHECK (estado IN ('disponible', 'transferido', 'descartado', 'congelado', 'en_nube'));

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

  -- 'en_nube' se suma al stock transferible junto a 'disponible' y 'congelado'.
  IF v_estado NOT IN ('disponible', 'congelado', 'en_nube') THEN
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
