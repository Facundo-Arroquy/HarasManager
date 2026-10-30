-- `superadmin_eliminar_usuario` no limpiaba dos referencias a `usuario`, y las
-- dos son `NO ACTION`: `campo.vet_owner_id` y `trabajo_sanitario.vet_owner_id`.
--
-- El efecto era el peor posible. La función valida, arma la lista de bloqueos,
-- devuelve un mensaje prolijo... y después revienta en el `DELETE FROM usuario`
-- con un error crudo de Postgres que el superadmin no puede interpretar ni
-- resolver. Le pasa a cualquier vet que se haya creado un campo propio o un
-- plan sanitario sobre sus propios caballos, que es el uso normal del rol.
--
-- Son datos del mismo tipo que sus caballos propios: no los ve nadie más, así
-- que se borran con él. El orden importa —los campos van después de los
-- caballos, porque `caballo.campo_id` los referencia— y los trabajos van
-- después de sus `trabajo_sanitario_caballo`.
--
-- De paso: `historial_clinico` sigue bloqueando el borrado, pero resolverlo a
-- mano choca con `trabajo_sanitario_caballo.historial_id`, que la consulta de
-- bloqueos no menciona. Ahora el mensaje lo dice.

CREATE OR REPLACE FUNCTION public.superadmin_eliminar_usuario(p_usuario_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    SELECT COALESCE(array_agg(id), '{}') INTO v_caballos
    FROM caballo
    WHERE vet_owner_id = p_usuario_id AND sociedad_id IS NULL;

    SELECT COUNT(*) INTO v_n FROM membresia WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s membresía(s) en empresas', v_n);
    END IF;

    SELECT COUNT(*) INTO v_n FROM pago_veterinario WHERE usuario_id = p_usuario_id;
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s pago(s) registrado(s)', v_n);
    END IF;

    -- Se avisa cuántas de esas consultas cuelgan de un plan sanitario: son las
    -- que no se pueden borrar sin antes soltar `trabajo_sanitario_caballo.historial_id`.
    SELECT COUNT(*) INTO v_n
    FROM historial_clinico
    WHERE creado_por = p_usuario_id OR caballo_id = ANY(v_caballos);
    IF v_n > 0 THEN
      DECLARE v_en_plan INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_en_plan
        FROM trabajo_sanitario_caballo tsc
        JOIN historial_clinico h ON h.id = tsc.historial_id
        WHERE h.creado_por = p_usuario_id OR h.caballo_id = ANY(v_caballos);

        v_bloqueos := v_bloqueos || format(
          '%s consulta(s) de historial clínico (no se eliminan nunca)%s',
          v_n,
          CASE WHEN v_en_plan > 0
            THEN format(', de las cuales %s están enganchadas a un plan sanitario', v_en_plan)
            ELSE '' END
        );
      END;
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

    SELECT COUNT(*) INTO v_n
    FROM caballo c
    WHERE (c.padre_id = ANY(v_caballos) OR c.madre_id = ANY(v_caballos))
      AND NOT (c.id = ANY(v_caballos));
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s caballo(s) de terceros lo usan en su pedigree', v_n);
    END IF;

    -- Un caballo de una sociedad parado en un campo del vet impediría borrar el
    -- campo. `trg_validar_campo_caballo` no lo permite, pero si alguna vez esa
    -- regla se afloja, esto avisa en vez de reventar con un error de FK.
    SELECT COUNT(*) INTO v_n
    FROM caballo c
    WHERE c.campo_id IN (SELECT id FROM campo WHERE vet_owner_id = p_usuario_id)
      AND NOT (c.id = ANY(v_caballos));
    IF v_n > 0 THEN
      v_bloqueos := v_bloqueos || format('%s caballo(s) de terceros están en un campo suyo', v_n);
    END IF;

    IF array_length(v_bloqueos, 1) > 0 THEN
      RAISE EXCEPTION
        'No se puede eliminar a % porque dejó datos que no se pueden borrar: %. Hay que resolverlos a mano antes.',
        v_email, array_to_string(v_bloqueos, '; ')
        USING ERRCODE = 'HM409';
    END IF;

    v_borrados := jsonb_build_object(
      'email',    v_email,
      'caballos', COALESCE(array_length(v_caballos, 1), 0),
      'campos',   (SELECT COUNT(*) FROM campo WHERE vet_owner_id = p_usuario_id)
    );

    UPDATE trabajo_sanitario      SET creado_por     = NULL WHERE creado_por     = p_usuario_id;
    UPDATE cria_registro_clinico  SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_ecografia         SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_flushing          SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_transferencia     SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_estado_transicion SET creado_por      = NULL WHERE creado_por     = p_usuario_id;
    UPDATE cria_recordatorio      SET veterinario_id = NULL WHERE veterinario_id = p_usuario_id;
    UPDATE cria_padrillo_preferido SET creado_por     = NULL WHERE creado_por    = p_usuario_id;

    IF array_length(v_caballos, 1) > 0 THEN
      DELETE FROM venta_caballo             WHERE caballo_id = ANY(v_caballos);
      DELETE FROM trabajo_sanitario_caballo WHERE caballo_id = ANY(v_caballos);
      DELETE FROM propiedad                 WHERE caballo_id = ANY(v_caballos);
      DELETE FROM acceso_vet                WHERE caballo_id = ANY(v_caballos);
      DELETE FROM caballo                   WHERE id = ANY(v_caballos);
    END IF;

    -- Los planes sanitarios sobre sus propios caballos: sus filas puente ya se
    -- fueron con los caballos, así que lo que queda es el trabajo vacío.
    DELETE FROM trabajo_sanitario_caballo
    WHERE trabajo_id IN (SELECT id FROM trabajo_sanitario WHERE vet_owner_id = p_usuario_id);
    DELETE FROM trabajo_sanitario WHERE vet_owner_id = p_usuario_id;

    -- Sus campos propios. Van después de los caballos: `caballo.campo_id` los
    -- referencia.
    DELETE FROM campo WHERE vet_owner_id = p_usuario_id;

    DELETE FROM acceso_vet WHERE vet_id = p_usuario_id;
    UPDATE acceso_vet SET otorgado_por = NULL WHERE otorgado_por = p_usuario_id;

    DELETE FROM suscripcion_veterinario WHERE usuario_id = p_usuario_id;
    UPDATE suscripcion_veterinario SET activado_por = NULL WHERE activado_por = p_usuario_id;

    UPDATE caballo_tag SET creado_por = NULL WHERE creado_por = p_usuario_id;

    DELETE FROM usuario WHERE id = p_usuario_id;

    RETURN v_borrados;
  END;
$function$;
