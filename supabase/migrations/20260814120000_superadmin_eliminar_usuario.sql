-- Borrado definitivo de un usuario desde el panel de superadmin.
--
-- Existe para un caso concreto y real: un veterinario que se registró (de
-- prueba, o mal) y necesita volver a registrarse desde cero con el mismo email.
-- Hoy eso requiere borrar a mano en dos lugares y en el orden correcto, porque
-- casi todas las FK contra `usuario` son NO ACTION y bloquean el DELETE.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Por qué rechaza en vez de borrar todo
-- ─────────────────────────────────────────────────────────────────────────────
-- El historial clínico **no se elimina nunca**, aunque se elimine el vet que lo
-- escribió: es el registro médico del animal, no del usuario, y le sobrevive.
-- Como `historial_clinico.creado_por` es NOT NULL, tampoco se puede desvincular
-- la autoría — no existe una tercera opción que no sea destruir el registro.
--
-- Así que la función distingue dos mundos:
--
--   * Lo que es **del usuario** (sus caballos propios sin historia clínica, su
--     suscripción, sus accesos) se borra.
--   * Lo que **no le pertenece o no puede destruirse** (cualquier historial
--     clínico, membresías en empresas, pagos, planes sanitarios, centro de
--     cría) bloquea la operación con un mensaje que enumera qué lo frena.
--
-- Es deliberado que falle ruidosamente: un botón de "eliminar" que se lleva
-- puesto el historial clínico de un haras es mucho peor que uno que a veces
-- dice que no.
--
-- Esta función NO borra de `auth.users` — eso lo hace la Edge Function
-- `eliminar-usuario` con la Admin API, en el mismo flujo.

CREATE OR REPLACE FUNCTION superadmin_eliminar_usuario(p_usuario_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
  DECLARE
    v_rol       TEXT;
    v_email     TEXT;
    v_caballos  UUID[];
    v_bloqueos  TEXT[] := '{}';
    v_n         INTEGER;
    v_borrados  JSONB;
  BEGIN
    IF NOT is_superadmin() THEN
      RAISE EXCEPTION 'No autorizado.' USING ERRCODE = 'HM403';
    END IF;

    -- Borrarse a uno mismo deja la plataforma sin quien administre.
    IF p_usuario_id = auth.uid() THEN
      RAISE EXCEPTION 'No podés eliminar tu propio usuario.' USING ERRCODE = 'HM400';
    END IF;

    SELECT rol, email INTO v_rol, v_email FROM usuario WHERE id = p_usuario_id;
    IF v_rol IS NULL THEN
      RAISE EXCEPTION 'El usuario no existe o ya fue eliminado.' USING ERRCODE = 'HM404';
    END IF;

    IF v_rol = 'superadmin' THEN
      RAISE EXCEPTION 'No se puede eliminar a otro superadmin desde el panel.' USING ERRCODE = 'HM400';
    END IF;

    -- Los caballos propios del vet: sin sociedad y con él como dueño. Son los
    -- únicos que se van con el usuario.
    SELECT COALESCE(array_agg(id), '{}') INTO v_caballos
    FROM caballo
    WHERE vet_owner_id = p_usuario_id AND sociedad_id IS NULL;

    -- ── Guardas: huella sobre datos que no son suyos ────────────────────────

    SELECT COUNT(*) INTO v_n FROM membresia WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s membresía(s) en empresas', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM pago_veterinario WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s pago(s) registrado(s)', v_n);
    END IF;

    -- El historial clínico no se borra nunca, ni siquiera el que está sobre los
    -- caballos propios del vet: es el registro médico del animal y sobrevive al
    -- usuario que lo escribió. Como `creado_por` es NOT NULL, tampoco se puede
    -- desvincular. Así que cualquier historial vinculado al usuario bloquea el
    -- borrado — no hay una tercera opción que no sea destruir un registro
    -- clínico.
    SELECT COUNT(*) INTO v_n
    FROM historial_clinico
    WHERE creado_por = p_usuario_id OR caballo_id = ANY(v_caballos);
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s consulta(s) de historial clínico (no se eliminan nunca)', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM trabajo_sanitario WHERE creado_por = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s plan(es) sanitario(s) creado(s)', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM propiedad WHERE registrado_por = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s registro(s) de propiedad', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM torneo WHERE creado_por = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s torneo(s) creado(s)', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM torneo_jugador WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s participación(es) en torneos', v_n);
    END IF;

    -- Centro de cría entero, tanto lo que él creó como lo que exista sobre sus
    -- caballos. Es un subgrafo con estados y transiciones: purgarlo en
    -- automático es más riesgo del que vale para este caso de uso.
    SELECT
      (SELECT COUNT(*) FROM cria_registro_clinico
        WHERE veterinario_id = p_usuario_id
           OR caballo_id = ANY(v_caballos) OR padrillo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_ecografia
        WHERE veterinario_id = p_usuario_id OR caballo_receptora_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_flushing
        WHERE veterinario_id = p_usuario_id
           OR caballo_id = ANY(v_caballos) OR padrillo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_transferencia
        WHERE veterinario_id = p_usuario_id
           OR caballo_donante_id = ANY(v_caballos)
           OR caballo_receptora_id = ANY(v_caballos)
           OR padrillo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_estado_transicion
        WHERE creado_por = p_usuario_id OR caballo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_recordatorio
        WHERE veterinario_id = p_usuario_id OR caballo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM embrion
        WHERE padrillo_id = ANY(v_caballos) OR caballo_donante_id = ANY(v_caballos))
    INTO v_n;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s registro(s) de centro de cría', v_n);
    END IF;

    -- Sus caballos usados como padre/madre en el pedigree de caballos ajenos:
    -- borrarlos dejaría huecos en la genealogía de otro.
    SELECT COUNT(*) INTO v_n
    FROM caballo c
    WHERE (c.padre_id = ANY(v_caballos) OR c.madre_id = ANY(v_caballos))
      AND NOT (c.id = ANY(v_caballos));
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s caballo(s) de terceros lo usan en su pedigree', v_n);
    END IF;

    IF array_length(v_bloqueos, 1) > 0 THEN
      RAISE EXCEPTION
        'No se puede eliminar a % porque dejó datos vinculados a terceros: %. Hay que resolverlos a mano antes de borrarlo.',
        v_email, array_to_string(v_bloqueos, '; ')
        USING ERRCODE = 'HM409';
    END IF;

    -- ── Purga ───────────────────────────────────────────────────────────────
    -- A esta altura solo queda lo que es del usuario. El orden respeta las FK
    -- RESTRICT/NO ACTION que cuelgan de `caballo`.

    v_borrados := jsonb_build_object(
      'email',    v_email,
      'caballos', COALESCE(array_length(v_caballos, 1), 0)
    );

    -- No hay DELETE de `historial_clinico` acá a propósito: si hubiera alguno,
    -- la guarda de arriba ya habría abortado. Llegar hasta acá significa que
    -- estos caballos no tienen historia clínica que preservar.
    IF array_length(v_caballos, 1) > 0 THEN
      DELETE FROM venta_caballo             WHERE caballo_id = ANY(v_caballos);
      DELETE FROM trabajo_sanitario_caballo WHERE caballo_id = ANY(v_caballos);
      DELETE FROM propiedad                 WHERE caballo_id = ANY(v_caballos);
      DELETE FROM acceso_vet                WHERE caballo_id = ANY(v_caballos);
      -- alerta_caballo, caballo_tag, torneo_asignacion y cria_padrillo_preferido
      -- son ON DELETE CASCADE: se van solos con el caballo.
      DELETE FROM caballo                   WHERE id = ANY(v_caballos);
    END IF;

    DELETE FROM acceso_vet WHERE vet_id = p_usuario_id;
    UPDATE acceso_vet SET otorgado_por = NULL WHERE otorgado_por = p_usuario_id;

    DELETE FROM suscripcion_veterinario WHERE usuario_id = p_usuario_id;
    UPDATE suscripcion_veterinario SET activado_por = NULL WHERE activado_por = p_usuario_id;

    UPDATE caballo_tag SET creado_por = NULL WHERE creado_por = p_usuario_id;

    -- `membresia`, `usuario_modulo`, `cria_plazo_vet` y `cat_chip_obs` son
    -- ON DELETE CASCADE contra `usuario`: se van con esta última sentencia.
    DELETE FROM usuario WHERE id = p_usuario_id;

    RETURN v_borrados;
  END;
$$;

-- Solo el superadmin la ejecuta, y la propia función revalida `is_superadmin()`
-- (el GRANT a `authenticated` es necesario porque el superadmin se autentica
-- como un usuario más; la autorización real está adentro).
REVOKE ALL ON FUNCTION superadmin_eliminar_usuario(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION superadmin_eliminar_usuario(UUID) TO authenticated, service_role;
