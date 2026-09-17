-- =============================================================================
-- Revisión programable a N días (reemplaza el checkbox "Revisión mañana").
-- =============================================================================
-- Pedido de Facu (2026-09-17): el checkbox fijo agendaba la revisión siempre
-- para el próximo lunes/miércoles/viernes (`reglasParaRegistro` → `proximoMWF`).
-- Se reemplaza por una cantidad de días libre (1 a 60) elegida en el formulario
-- de tacto/ecografía: la revisión se agenda a `fecha + review_dias`.
--
-- `review_manana` / `review_manana_desc` se dan de baja: `review_dias` (NULL =
-- no se pidió revisión) sigue el mismo criterio que `ov_dias` (NULL = no
-- aplica) en vez de un sentinel numérico. `review_manana_desc` se renombra a
-- `review_desc` — es el mismo campo de motivo, ya no atado al nombre viejo.
--
-- Nota: esta migración también da de baja `revisar_en_dias`, una columna que
-- había quedado aplicada en esta base (SMALLINT NOT NULL DEFAULT 0, rango
-- 0..365) sin archivo de migración en el repo y sin ningún código que la
-- lea o escriba — scaffolding de un intento anterior que no se terminó. No
-- encajaba con el rango pedido (1..60) ni con el criterio NULL=sin revisión,
-- así que se remueve y se reemplaza por `review_dias` en este mismo cambio.
-- =============================================================================

ALTER TABLE cria_registro_clinico
  DROP CONSTRAINT IF EXISTS cria_registro_revisar_en_dias_rango;

ALTER TABLE cria_registro_clinico
  DROP COLUMN IF EXISTS revisar_en_dias;

ALTER TABLE cria_registro_clinico
  RENAME COLUMN review_manana_desc TO review_desc;

ALTER TABLE cria_registro_clinico
  ADD COLUMN review_dias SMALLINT;

ALTER TABLE cria_registro_clinico
  ADD CONSTRAINT cria_registro_review_dias_rango
  CHECK (review_dias IS NULL OR (review_dias BETWEEN 1 AND 60));

COMMENT ON COLUMN cria_registro_clinico.review_dias IS
  'Cantidad de días desde `fecha` para agendar la revisión de seguimiento (1..60). NULL = no se pidió revisión. Dispara la creación de un cria_recordatorio tipo ''Revisión'' con fecha_vto = fecha + review_dias (reglasParaRegistro en crianzaStore.ts).';

-- Los registros viejos con review_manana = true agendaban "mañana": se
-- traducen a 1 día para no perder la intención al migrar.
UPDATE cria_registro_clinico
SET review_dias = 1
WHERE review_manana = TRUE;

ALTER TABLE cria_registro_clinico
  DROP COLUMN review_manana;

-- ── registrar_transferencia_embrionaria: insertaba review_manana = false ────
-- Sin revisión propia (la receptora recién transferida ya agenda sus propias
-- Eco 1/2/3 más abajo en la misma función): pasa a review_dias = NULL.
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
