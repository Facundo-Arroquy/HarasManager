-- Ajusta `superadmin_eliminar_usuario` (migración `20260814120000`) tras
-- probarla en prod: bloqueaba la baja de un vet que solo había atendido
-- caballos de terceros (0 caballos propios), por planes sanitarios y registros
-- de centro de cría que había creado.
--
-- Esos registros son del **caballo**, no del vet: un plan sanitario o una
-- ecografía documentan lo que se le hizo al animal, y el animal sigue
-- existiendo (es de un haras) aunque el vet que lo atendió se vaya de la
-- plataforma. Bloquear la baja por eso protegía la autoría, no el dato.
--
-- Nuevo criterio, más preciso que el anterior:
--
--   * Si el vet es apenas el **autor** de un plan sanitario o un registro de
--     centro de cría sobre un caballo que **no es suyo** — se desvincula la
--     autoría (columna a NULL) y el registro se conserva intacto.
--   * Si el registro está sobre un caballo **propio del vet** (que se borra
--     junto con él, sea quien sea el autor) — sigue bloqueando. Ahí no hay
--     forma segura de decidir en automático si el registro debe sobrevivir
--     desvinculado o desaparecer con el caballo, así que se lo deja para
--     resolver a mano.
--   * `historial_clinico` no cambia: sigue bloqueando siempre, sin excepción
--     — es la inmutabilidad real del historial clínico, no una preferencia de
--     esta función.
--
-- Requiere que estas columnas dejen de ser NOT NULL, porque la autoría se va
-- a desvincular en vez de forzar el borrado del registro.

ALTER TABLE trabajo_sanitario        ALTER COLUMN creado_por      DROP NOT NULL;
ALTER TABLE cria_registro_clinico    ALTER COLUMN veterinario_id  DROP NOT NULL;
ALTER TABLE cria_ecografia           ALTER COLUMN veterinario_id  DROP NOT NULL;
ALTER TABLE cria_flushing            ALTER COLUMN veterinario_id  DROP NOT NULL;
ALTER TABLE cria_transferencia       ALTER COLUMN veterinario_id  DROP NOT NULL;
ALTER TABLE cria_estado_transicion   ALTER COLUMN creado_por      DROP NOT NULL;

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

    -- Caballos propios del vet: sin sociedad y con él como dueño. Son los
    -- únicos que desaparecen con el usuario.
    SELECT COALESCE(array_agg(id), '{}') INTO v_caballos
    FROM caballo
    WHERE vet_owner_id = p_usuario_id AND sociedad_id IS NULL;

    -- ── Guardas: lo que de verdad no se puede resolver en automático ────────

    SELECT COUNT(*) INTO v_n FROM membresia WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s membresía(s) en empresas', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM pago_veterinario WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s pago(s) registrado(s)', v_n);
    END IF;

    -- El historial clínico no se toca nunca, sea de quien sea el caballo.
    SELECT COUNT(*) INTO v_n
    FROM historial_clinico
    WHERE creado_por = p_usuario_id OR caballo_id = ANY(v_caballos);
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s consulta(s) de historial clínico (no se eliminan nunca)', v_n);
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

    -- Centro de cría: bloquea SOLO si el registro está sobre uno de sus
    -- propios caballos (que se borra con él), sin importar quién lo escribió.
    -- Lo que él haya escrito sobre caballos de terceros no bloquea — se
    -- desvincula más abajo, en la purga.
    SELECT
      (SELECT COUNT(*) FROM cria_registro_clinico
        WHERE caballo_id = ANY(v_caballos) OR padrillo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_ecografia
        WHERE caballo_receptora_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_flushing
        WHERE caballo_id = ANY(v_caballos) OR padrillo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_transferencia
        WHERE caballo_donante_id = ANY(v_caballos)
           OR caballo_receptora_id = ANY(v_caballos)
           OR padrillo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_estado_transicion WHERE caballo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM cria_recordatorio WHERE caballo_id = ANY(v_caballos))
    + (SELECT COUNT(*) FROM embrion
        WHERE padrillo_id = ANY(v_caballos) OR caballo_donante_id = ANY(v_caballos))
    INTO v_n;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s registro(s) de centro de cría sobre sus propios caballos', v_n);
    END IF;

    -- Sus caballos usados como padre/madre en el pedigree de caballos ajenos.
    SELECT COUNT(*) INTO v_n
    FROM caballo c
    WHERE (c.padre_id = ANY(v_caballos) OR c.madre_id = ANY(v_caballos))
      AND NOT (c.id = ANY(v_caballos));
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s caballo(s) de terceros lo usan en su pedigree', v_n);
    END IF;

    IF array_length(v_bloqueos, 1) > 0 THEN
      RAISE EXCEPTION
        'No se puede eliminar a % porque dejó datos que no se pueden borrar: %. Hay que resolverlos a mano antes.',
        v_email, array_to_string(v_bloqueos, '; ')
        USING ERRCODE = 'HM409';
    END IF;

    v_borrados := jsonb_build_object(
      'email',    v_email,
      'caballos', COALESCE(array_length(v_caballos, 1), 0)
    );

    -- ── Purga ───────────────────────────────────────────────────────────────
    -- Llegar hasta acá garantiza que ningún trabajo_sanitario/cria_* referencia
    -- v_caballos (si lo hiciera, ya habría bloqueado arriba). Así que desvincular
    -- la autoría acá es seguro: el registro queda, solo pierde el "quién".
    UPDATE trabajo_sanitario      SET creado_por     = NULL WHERE creado_por     = p_usuario_id;
    UPDATE cria_registro_clinico  SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_ecografia         SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_flushing          SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_transferencia     SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_estado_transicion SET creado_por      = NULL WHERE creado_por     = p_usuario_id;
    UPDATE cria_recordatorio      SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_padrillo_preferido SET creado_por     = NULL WHERE creado_por    = p_usuario_id;

    -- No hay DELETE de historial_clinico: si hubiera alguno, la guarda ya abortó.
    IF array_length(v_caballos, 1) > 0 THEN
      DELETE FROM venta_caballo             WHERE caballo_id = ANY(v_caballos);
      DELETE FROM trabajo_sanitario_caballo WHERE caballo_id = ANY(v_caballos);
      DELETE FROM propiedad                 WHERE caballo_id = ANY(v_caballos);
      DELETE FROM acceso_vet                WHERE caballo_id = ANY(v_caballos);
      DELETE FROM caballo                   WHERE id = ANY(v_caballos);
    END IF;

    DELETE FROM acceso_vet WHERE vet_id = p_usuario_id;
    UPDATE acceso_vet SET otorgado_por = NULL WHERE otorgado_por = p_usuario_id;

    DELETE FROM suscripcion_veterinario WHERE usuario_id = p_usuario_id;
    UPDATE suscripcion_veterinario SET activado_por = NULL WHERE activado_por = p_usuario_id;

    UPDATE caballo_tag SET creado_por = NULL WHERE creado_por = p_usuario_id;

    DELETE FROM usuario WHERE id = p_usuario_id;

    RETURN v_borrados;
  END;
$$;
