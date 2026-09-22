-- =============================================================================
-- Borrar un registro del centro arrastra la cadena de eventos que generó.
-- =============================================================================
-- Reportado por Facu (2026-09-21): registro A genera el recordatorio R; el vet
-- lo marca como hecho cargando el registro B (B.origen_recordatorio_id = R), y
-- B genera sus propios recordatorios (S). Al borrar A, `_cria_borrar_registro`
-- solo se llevaba los recordatorios NO resueltos: R quedaba 'hecho' sin
-- origen, y B y S seguían vivos — eventos que existen por un registro que ya
-- no está.
--
-- Criterio nuevo: todo lo que nació de A se va con A.
--   · Los recordatorios de A se borran siempre, estén como estén (antes los
--     'hecho' quedaban sueltos).
--   · Si alguno se resolvió con un registro, ese registro se borra con la misma
--     función, en recursión: se lleva a su vez sus recordatorios y los
--     registros que los resolvieron, y así hasta el final de la cadena.
--   · Si alguno se resolvió con un flushing o una ecografía, se aborta: son
--     procedimientos con embriones/preñez colgando y no se borran en cascada.
--     El mensaje explica qué borrar primero (mismo criterio que el resto de las
--     RPC de borrado de `20260912220008`).
--   · Un registro de la cadena cargado por otro vet también aborta: solo el
--     autor borra lo propio.
--
-- No hay ciclos posibles: cada registro de la cadena es posterior al
-- recordatorio que resolvió, que a su vez es posterior al registro que lo
-- generó.
-- =============================================================================

CREATE OR REPLACE FUNCTION public._cria_borrar_registro(p_registro_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_origen uuid;
  v_hijo   record;
BEGIN
  SELECT origen_recordatorio_id INTO v_origen
    FROM cria_registro_clinico WHERE id = p_registro_id;

  IF EXISTS (
    SELECT 1 FROM cria_recordatorio r
      JOIN cria_flushing f ON f.origen_recordatorio_id = r.id
     WHERE r.origen_registro_id = p_registro_id
  ) THEN
    RAISE EXCEPTION 'Un recordatorio que generó este registro se resolvió con un flushing: para borrarlo, eliminá primero el flushing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cria_recordatorio r
      JOIN cria_ecografia e ON e.origen_recordatorio_id = r.id
     WHERE r.origen_registro_id = p_registro_id
  ) THEN
    RAISE EXCEPTION 'Un recordatorio que generó este registro se resolvió con una ecografía: para borrarlo, eliminá primero la ecografía.';
  END IF;

  -- Registros que resolvieron un recordatorio de este: se van con él.
  FOR v_hijo IN
    SELECT h.id, h.veterinario_id, h.fecha
      FROM cria_registro_clinico h
      JOIN cria_recordatorio r ON r.id = h.origen_recordatorio_id
     WHERE r.origen_registro_id = p_registro_id
  LOOP
    IF v_hijo.veterinario_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'El registro del % que salió de este lo cargó otro veterinario: no se puede borrar en cascada.',
        to_char(v_hijo.fecha, 'DD/MM/YYYY');
    END IF;
    IF EXISTS (SELECT 1 FROM cria_transferencia WHERE registro_id = v_hijo.id) THEN
      RAISE EXCEPTION 'El registro del % que salió de este es el de una transferencia: eliminá primero la transferencia.',
        to_char(v_hijo.fecha, 'DD/MM/YYYY');
    END IF;

    -- Se suelta el vínculo antes de bajar: si no, al borrarse el hijo
    -- intentaría reabrir un recordatorio que igual se borra acá abajo.
    UPDATE cria_registro_clinico SET origen_recordatorio_id = NULL
     WHERE id = v_hijo.id;

    PERFORM _cria_borrar_registro(v_hijo.id);
  END LOOP;

  DELETE FROM cria_recordatorio WHERE origen_registro_id = p_registro_id;

  UPDATE cria_estado_transicion SET registro_origen_id = NULL
   WHERE registro_origen_id = p_registro_id;

  DELETE FROM cria_registro_clinico WHERE id = p_registro_id;

  PERFORM _cria_reabrir_recordatorio(v_origen);
END;
$$;

REVOKE ALL ON FUNCTION public._cria_borrar_registro(uuid) FROM PUBLIC, anon, authenticated;
