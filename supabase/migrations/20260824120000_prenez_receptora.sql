-- =============================================================================
-- La preñez de la receptora se marca sola.
-- =============================================================================
-- Definición de Facu (2026-08-24): "si a una receptora se le hace una
-- transferencia se pone como preñada, se guarda esa fecha de preñez, a menos
-- que en alguna de las ecografías salga 'abortada', que se le sale el tag".
--
-- Hasta ahora `caballo.prenada` / `caballo.fecha_prenez` solo se tocaban a mano
-- desde la ficha del caballo (CaballoDetalleModal). El centro de cría llevaba su
-- propia máquina de estados en `caballo.estado_reproductivo`, en paralelo y sin
-- hablarse con el tag que se ve en el listado de caballos.
--
-- Los dos cambios de acá van del lado de la base, no del frontend, por una razón
-- concreta: la única policy de UPDATE sobre `caballo` es `es_admin(sociedad_id)`,
-- así que un veterinario —que es justamente quien transfiere y ecografía— no
-- puede escribir esa tabla desde el cliente. Un UPDATE suyo vía PostgREST no
-- falla: no matchea ninguna fila y devuelve 204. Silencioso.
--
-- Por eso:
--   1. La marca de preñez viaja adentro de registrar_transferencia_embrionaria,
--      que ya es SECURITY DEFINER y ya es transaccional.
--   2. El destag por aborto es un trigger sobre cria_ecografia, también
--      SECURITY DEFINER, para que corra sin importar por dónde entre la
--      ecografía y sin depender de los permisos del cliente.
--
-- OJO: la transferencia marca preñada de entrada, antes de que ninguna ecografía
-- lo confirme. Es lo pedido explícitamente. Clínicamente la preñez se confirma
-- con la eco, así que entre la transferencia y la Eco 1 el tag es una expectativa,
-- no un diagnóstico.
-- =============================================================================

-- ── 1. La transferencia marca a la receptora como preñada ────────────────────
-- Única diferencia con 20260823120000: el UPDATE sobre caballo al final.
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

  RETURN jsonb_build_object(
    'registro_id',      v_registro,
    'transferencia_id', v_transf,
    'embrion_id',       p_embrion_id
  );
END;
$$;

-- ── 2. La ecografía saca (o confirma) el tag de preñada ──────────────────────
CREATE OR REPLACE FUNCTION public.sincronizar_prenez_ecografia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fecha_transf date;
BEGIN
  IF NEW.resultado = 'abortada' THEN
    -- Abortó: se cae el tag y la fecha. Cualquiera de las ecos alcanza.
    UPDATE caballo
    SET prenada      = false,
        fecha_prenez = NULL,
        updated_at   = now()
    WHERE id = NEW.caballo_receptora_id;

  ELSIF NEW.resultado = 'prenada' THEN
    -- Confirma lo que ya marcó la transferencia. La fecha de preñez que vale es
    -- la de la transferencia, no la del día de la eco; solo se completa si por
    -- algún camino quedó vacía.
    SELECT fecha INTO v_fecha_transf
    FROM cria_transferencia
    WHERE id = NEW.transferencia_id;

    UPDATE caballo
    SET prenada      = true,
        fecha_prenez = COALESCE(fecha_prenez, v_fecha_transf, NEW.fecha),
        updated_at   = now()
    WHERE id = NEW.caballo_receptora_id;
  END IF;

  -- 'pendiente' no toca nada: todavía no dice ni que sí ni que no.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_prenez_ecografia ON cria_ecografia;
CREATE TRIGGER trg_sincronizar_prenez_ecografia
  AFTER INSERT OR UPDATE OF resultado ON cria_ecografia
  FOR EACH ROW EXECUTE FUNCTION sincronizar_prenez_ecografia();
