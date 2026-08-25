-- =============================================================================
-- Plazos de las ecografías post-transferencia, configurables por veterinario.
-- =============================================================================
-- Pedido de Facu (2026-08-24): que las tres ecografías se recuerden solas a los
-- 30, 60 y 90 días por defecto, y que cada plazo se pueda cambiar.
--
-- Hasta ahora no existía ningún recordatorio de ecografía: la transferencia se
-- registraba y después había que acordarse de volver a mirar a la yegua. Las
-- ecografías se cargaban desde la lista de embriones, cuando alguien se acordaba.
--
-- Los plazos van en `cria_plazo_vet` como el resto, con el mismo criterio de
-- Gero: manda el plazo del vet que hace el registro, no el de la sociedad.
--
-- El rango es distinto al de los demás plazos: `cria_plazo_vet_rangos` los acota
-- a 1..30 días, y 60 y 90 no entran ahí. Por eso un CHECK aparte de 1..365.
-- =============================================================================

ALTER TABLE cria_plazo_vet
  ADD COLUMN IF NOT EXISTS receptora_transf_a_eco1 SMALLINT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS receptora_transf_a_eco2 SMALLINT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS receptora_transf_a_eco3 SMALLINT NOT NULL DEFAULT 90;

ALTER TABLE cria_plazo_vet DROP CONSTRAINT IF EXISTS cria_plazo_vet_rangos_eco;
ALTER TABLE cria_plazo_vet ADD CONSTRAINT cria_plazo_vet_rangos_eco CHECK (
  receptora_transf_a_eco1 BETWEEN 1 AND 365 AND
  receptora_transf_a_eco2 BETWEEN 1 AND 365 AND
  receptora_transf_a_eco3 BETWEEN 1 AND 365
);

-- ── La transferencia agenda las tres ecografías ──────────────────────────────
-- Se suma al final de registrar_transferencia_embrionaria, en la misma
-- transacción: si la transferencia se guarda, los recordatorios existen.
--
-- Los plazos salen de la fila del vet que ejecuta (auth.uid()). Si no tiene fila
-- —vet nuevo que nunca entró a Configuración— se usan los mismos defaults que
-- muestra el frontend, en vez de no agendar nada.
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
  v_eco1     smallint;
  v_eco2     smallint;
  v_eco3     smallint;
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

  -- 'en_nube' es stock vivo junto a 'disponible' y 'congelado'.
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

  -- La receptora queda preñada desde la fecha de la transferencia. Si ya tenía
  -- una preñez marcada, la nueva transferencia la pisa: es un ciclo nuevo.
  UPDATE caballo
  SET prenada      = true,
      fecha_prenez = p_fecha,
      updated_at   = now()
  WHERE id = p_caballo_receptora_id;

  -- Las tres ecografías, con los plazos del vet que transfiere.
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
