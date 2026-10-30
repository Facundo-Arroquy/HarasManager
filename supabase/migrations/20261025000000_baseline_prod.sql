-- =============================================================================
-- BASELINE — schema de producción al 2026-10-25 (PostgreSQL 17.6)
--
-- Reemplaza las 137 migraciones históricas (ver supabase/migrations-archivo/).
-- Se generó con `supabase db dump --linked` (solo estructura, sin datos) y se
-- completó con lo que vive fuera de `public` y el dump no trae:
--   1. trigger on_auth_user_created sobre auth.users
--   2. buckets de Storage
--   3. policies de storage.objects
-- y de una Parte 0 (abajo) que hace falta solo en local.
--
-- NO EDITAR. Los cambios de schema van en migraciones nuevas, posteriores a esta.
-- Prod ya tiene este schema: este archivo solo existe para reconstruirlo en local.
-- Plan: docs/PLAN-MIGRACION-BACKEND.md (F1).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Parte 0: partir sin privilegios por defecto
--
-- El Supabase local trae `ALTER DEFAULT PRIVILEGES ... GRANT ALL TO anon,
-- authenticated, service_role` sobre `public`, así que todo objeto nace abierto.
-- pg_dump asume que los objetos nacen cerrados y solo emite los GRANT que
-- existen: sin esto, las 67 funciones y las 3 tablas que en prod tienen acceso
-- restringido (ej. las `_cria_*`, `vet_suscripcion_activa`) quedarían abiertas
-- en local y los tests de permisos mentirían. Los ALTER DEFAULT PRIVILEGES del
-- final de la Parte 1 restituyen los defaults tal como están en prod.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Parte 1: schema public
-- ---------------------------------------------------------------------------



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."_cria_auditar_correccion_ecografia"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
    INSERT INTO cria_evento_reproductivo(sociedad_id,caballo_id,transferencia_id,tipo,datos,creado_por)
    VALUES(OLD.sociedad_id,OLD.caballo_receptora_id,OLD.transferencia_id,'ecografia_corregida',
      jsonb_build_object('anterior',to_jsonb(OLD),'nuevo',to_jsonb(NEW)),COALESCE(auth.uid(),NEW.veterinario_id));
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."_cria_auditar_correccion_ecografia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_borrar_registro"("p_registro_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."_cria_borrar_registro"("p_registro_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_cambiar_estado_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_estado" "text", "p_motivo" "text", "p_creado_por" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actual text;
BEGIN
  SELECT estado_reproductivo INTO v_actual
    FROM caballo WHERE id = p_caballo_id FOR UPDATE;
  IF NOT FOUND OR v_actual IS NOT DISTINCT FROM p_estado THEN
    RETURN;
  END IF;

  UPDATE caballo
     SET estado_reproductivo = p_estado, updated_at = now()
   WHERE id = p_caballo_id;

  INSERT INTO cria_estado_transicion
    (caballo_id, sociedad_id, estado_anterior, estado_nuevo, motivo, creado_por)
  VALUES
    (p_caballo_id, p_sociedad_id, v_actual, p_estado, p_motivo, p_creado_por);
END;
$$;


ALTER FUNCTION "public"."_cria_cambiar_estado_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_estado" "text", "p_motivo" "text", "p_creado_por" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_filtrar_recordatorio_automatico"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE v_estado text;
BEGIN
  IF NEW.tipo IN ('Eco 1','Eco 2','Eco 3') THEN
    IF NEW.transferencia_id IS NULL AND NEW.origen_registro_id IS NOT NULL THEN
      SELECT id INTO NEW.transferencia_id FROM cria_transferencia WHERE registro_id=NEW.origen_registro_id LIMIT 1;
    END IF;
    NEW.eco_numero:=substring(NEW.tipo FROM '^Eco ([123])$')::smallint;
    IF NEW.eco_numero>1 THEN
      SELECT estado INTO v_estado FROM cria_seguimiento_gestacion WHERE transferencia_id=NEW.transferencia_id;
      IF v_estado IS DISTINCT FROM 'prenada' THEN RETURN NULL; END IF;
    END IF;
  END IF;
  IF NEW.tipo='IN' AND NEW.origen_registro_id IS NOT NULL AND EXISTS
    (SELECT 1 FROM cria_registro_clinico WHERE id=NEW.origen_registro_id AND obs_chips @> ARRAY['IN']::text[])
  THEN RETURN NULL; END IF;
  RETURN NEW;
END $_$;


ALTER FUNCTION "public"."_cria_filtrar_recordatorio_automatico"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_flushing_aplicar_config_pg"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_aplica boolean;
BEGIN
  SELECT donante_flushing_aplica_pg INTO v_aplica
  FROM cria_plazo_vet
  WHERE veterinario_id = NEW.veterinario_id;

  NEW.pg_given := NEW.pg_given OR COALESCE(v_aplica, true);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_cria_flushing_aplicar_config_pg"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_flushing_sincronizar_revision_pg"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_dias smallint;
BEGIN
  IF NEW.pg_given THEN
    SELECT donante_pg_a_revision_pg INTO v_dias
    FROM cria_plazo_vet
    WHERE veterinario_id = NEW.veterinario_id;
    v_dias := COALESCE(v_dias, 3);

    INSERT INTO cria_recordatorio(
      caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id,
      notas, auto_generado, origen_registro_id, flushing_id
    ) VALUES (
      NEW.caballo_id, NEW.sociedad_id, 'Revisión PG', NEW.fecha + v_dias,
      'pendiente', NEW.veterinario_id,
      format('PG aplicada en flushing. Revisar a los %s días.', v_dias),
      true, NULL, NEW.id
    )
    ON CONFLICT (flushing_id, tipo) WHERE flushing_id IS NOT NULL
    DO UPDATE SET
      caballo_id = EXCLUDED.caballo_id,
      sociedad_id = EXCLUDED.sociedad_id,
      fecha_vto = EXCLUDED.fecha_vto,
      estado = 'pendiente',
      veterinario_id = EXCLUDED.veterinario_id,
      notas = EXCLUDED.notas,
      cancel_motivo = NULL,
      updated_at = now();
  ELSE
    UPDATE cria_recordatorio
    SET estado = 'cancelado',
        cancel_motivo = 'Se corrigió el flushing: PG no aplicada',
        updated_at = now()
    WHERE flushing_id = NEW.id
      AND tipo = 'Revisión PG'
      AND estado IN ('pendiente', 'vencido');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_cria_flushing_sincronizar_revision_pg"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_iniciar_seguimiento_transferencia"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO cria_seguimiento_gestacion(transferencia_id,sociedad_id,caballo_receptora_id)
  VALUES(NEW.id,NEW.sociedad_id,NEW.caballo_receptora_id) ON CONFLICT DO NOTHING;
  INSERT INTO cria_evento_reproductivo(sociedad_id,caballo_id,transferencia_id,registro_id,tipo,datos,creado_por)
  VALUES(NEW.sociedad_id,NEW.caballo_receptora_id,NEW.id,NEW.registro_id,'transferencia',
    jsonb_build_object('fecha',NEW.fecha),NEW.veterinario_id);
  PERFORM _cria_cambiar_estado_reproductivo(NEW.caballo_receptora_id,NEW.sociedad_id,'pendiente_eco',
    'Transferencia registrada; ECO 1 pendiente',NEW.veterinario_id);
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."_cria_iniciar_seguimiento_transferencia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_reabrir_recordatorio"("p_recordatorio_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_recordatorio_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE cria_recordatorio r
     SET estado = 'pendiente'
   WHERE r.id = p_recordatorio_id
     AND r.estado = 'hecho'
     AND NOT EXISTS (SELECT 1 FROM cria_registro_clinico x WHERE x.origen_recordatorio_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM cria_ecografia        x WHERE x.origen_recordatorio_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM cria_flushing         x WHERE x.origen_recordatorio_id = r.id);
END;
$$;


ALTER FUNCTION "public"."_cria_reabrir_recordatorio"("p_recordatorio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_reprogramar_revisiones_pg_por_config"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.donante_pg_a_revision_pg IS DISTINCT FROM OLD.donante_pg_a_revision_pg THEN
    UPDATE cria_recordatorio r
    SET fecha_vto = f.fecha + NEW.donante_pg_a_revision_pg,
        notas = format('PG aplicada en flushing. Revisar a los %s días.', NEW.donante_pg_a_revision_pg),
        updated_at = now()
    FROM cria_flushing f
    WHERE r.flushing_id = f.id
      AND f.veterinario_id = NEW.veterinario_id
      AND f.pg_given
      AND r.tipo = 'Revisión PG'
      AND r.estado IN ('pendiente', 'vencido');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_cria_reprogramar_revisiones_pg_por_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_revertir_aborto"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_transferencia_id" "uuid", "p_numero" integer, "p_motivo" "text", "p_creado_por" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_fecha_transf date;
  v_previo       text;
BEGIN
  SELECT fecha INTO v_fecha_transf
    FROM cria_transferencia WHERE id = p_transferencia_id;

  UPDATE caballo
     SET prenada = true, fecha_prenez = COALESCE(fecha_prenez, v_fecha_transf), updated_at = now()
   WHERE id = p_caballo_id;

  SELECT estado_anterior INTO v_previo
    FROM cria_estado_transicion
   WHERE caballo_id   = p_caballo_id
     AND estado_nuevo = 'vacia'
     AND motivo       = format('Ecografía %s: abortada', p_numero)
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND AND EXISTS (
    SELECT 1 FROM caballo WHERE id = p_caballo_id AND estado_reproductivo = 'vacia'
  ) THEN
    PERFORM _cria_cambiar_estado_reproductivo(p_caballo_id, p_sociedad_id, v_previo, p_motivo, p_creado_por);
  END IF;
END;
$$;


ALTER FUNCTION "public"."_cria_revertir_aborto"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_transferencia_id" "uuid", "p_numero" integer, "p_motivo" "text", "p_creado_por" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cria_transferencia_vigente"("p_transferencia_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1
      FROM cria_transferencia t
      JOIN cria_transferencia x
        ON x.caballo_receptora_id = t.caballo_receptora_id
       AND x.id <> t.id
     WHERE t.id = p_transferencia_id
       AND (x.fecha > t.fecha OR (x.fecha = t.fecha AND x.created_at > t.created_at))
  );
$$;


ALTER FUNCTION "public"."_cria_transferencia_vigente"("p_transferencia_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_vet_valida_propios"("p_caballo_ids" "uuid"[], "p_activo_esperado" boolean) RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM unnest(p_caballo_ids) AS sel(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM caballo c
         WHERE c.id     = sel.id
           AND c.activo = p_activo_esperado
           AND (
             (c.vet_owner_id = auth.uid() AND c.sociedad_id IS NULL)
             OR vet_tiene_acceso(c.id)
           )
      )
    ) THEN
      IF p_activo_esperado THEN
        RAISE EXCEPTION 'Alguno de los caballos seleccionados no es tuyo, no tenés acceso, o ya estaba dado de baja.';
      ELSE
        RAISE EXCEPTION 'Alguno de los caballos seleccionados no es tuyo, no tenés acceso, o ya estaba activo.';
      END IF;
    END IF;
  END;
  $$;


ALTER FUNCTION "public"."_vet_valida_propios"("p_caballo_ids" "uuid"[], "p_activo_esperado" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text" DEFAULT NULL::"text", "p_raza_id" integer DEFAULT NULL::integer, "p_pelaje_id" integer DEFAULT NULL::integer, "p_numero_chip" "text" DEFAULT NULL::"text", "p_numero_registro" "text" DEFAULT NULL::"text", "p_padre_id" "uuid" DEFAULT NULL::"uuid", "p_padre_nombre" "text" DEFAULT NULL::"text", "p_madre_id" "uuid" DEFAULT NULL::"uuid", "p_madre_nombre" "text" DEFAULT NULL::"text", "p_campo_id" "uuid" DEFAULT NULL::"uuid", "p_sexo" "text" DEFAULT NULL::"text", "p_observaciones" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo
      WHERE id = p_caballo_id AND vet_owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE caballo SET
    nombre           = p_nombre,
    fecha_nacimiento = p_fecha_nacimiento,
    categoria        = p_categoria,
    rol_reproductivo = p_subcategoria,
    raza_id          = p_raza_id,
    pelaje_id        = p_pelaje_id,
    numero_chip      = p_numero_chip,
    numero_registro  = p_numero_registro,
    padre_id         = p_padre_id,
    padre_nombre     = p_padre_nombre,
    madre_id         = p_madre_id,
    madre_nombre     = p_madre_nombre,
    campo_id         = p_campo_id,
    sexo             = p_sexo,
    observaciones    = p_observaciones
  WHERE id = p_caballo_id;
END;
$$;


ALTER FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text", "p_padre_id" "uuid", "p_padre_nombre" "text", "p_madre_id" "uuid", "p_madre_nombre" "text", "p_campo_id" "uuid", "p_sexo" "text", "p_observaciones" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text" DEFAULT NULL::"text", "p_raza_id" integer DEFAULT NULL::integer, "p_pelaje_id" integer DEFAULT NULL::integer, "p_numero_chip" "text" DEFAULT NULL::"text", "p_numero_registro" "text" DEFAULT NULL::"text", "p_padre_id" "uuid" DEFAULT NULL::"uuid", "p_padre_nombre" "text" DEFAULT NULL::"text", "p_madre_id" "uuid" DEFAULT NULL::"uuid", "p_madre_nombre" "text" DEFAULT NULL::"text", "p_campo_id" "uuid" DEFAULT NULL::"uuid", "p_sexo" "text" DEFAULT NULL::"text", "p_observaciones" "text" DEFAULT NULL::"text", "p_domador" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo
      WHERE id = p_caballo_id AND vet_owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE caballo SET
    nombre           = p_nombre,
    fecha_nacimiento = p_fecha_nacimiento,
    categoria        = p_categoria,
    rol_reproductivo = p_subcategoria,
    raza_id          = p_raza_id,
    pelaje_id        = p_pelaje_id,
    numero_chip      = p_numero_chip,
    numero_registro  = p_numero_registro,
    padre_id         = p_padre_id,
    padre_nombre     = p_padre_nombre,
    madre_id         = p_madre_id,
    madre_nombre     = p_madre_nombre,
    campo_id         = p_campo_id,
    sexo             = p_sexo,
    observaciones    = p_observaciones,
    domador          = p_domador
  WHERE id = p_caballo_id;
END;
$$;


ALTER FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text", "p_padre_id" "uuid", "p_padre_nombre" "text", "p_madre_id" "uuid", "p_madre_nombre" "text", "p_campo_id" "uuid", "p_sexo" "text", "p_observaciones" "text", "p_domador" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_rol_reproductivo_vet"("p_caballo_id" "uuid", "p_rol" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_rol IS NOT NULL AND p_rol NOT IN ('Donante', 'Receptora') THEN
    RAISE EXCEPTION 'rol_reproductivo inválido: %', p_rol;
  END IF;

  IF NOT vet_tiene_acceso(p_caballo_id) THEN
    RAISE EXCEPTION 'Acceso denegado al caballo %', p_caballo_id;
  END IF;

  UPDATE public.caballo
  SET    rol_reproductivo = p_rol
  WHERE  id = p_caballo_id;
END;
$$;


ALTER FUNCTION "public"."actualizar_rol_reproductivo_vet"("p_caballo_id" "uuid", "p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ancestros_caballo"("p_caballo_id" "uuid", "p_gen" integer DEFAULT 2) RETURNS TABLE("caballo_id" "uuid", "nivel" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH RECURSIVE arbol AS (
    SELECT p_caballo_id AS id, 0 AS nivel
    UNION ALL
    SELECT padres.parent_id, arbol.nivel + 1
    FROM arbol
    JOIN caballo c ON c.id = arbol.id
    CROSS JOIN LATERAL (VALUES (c.padre_id), (c.madre_id)) AS padres(parent_id)
    WHERE padres.parent_id IS NOT NULL
      AND arbol.nivel < p_gen
  )
  SELECT id, MIN(nivel)::INT FROM arbol WHERE id IS NOT NULL GROUP BY id;
$$;


ALTER FUNCTION "public"."ancestros_caballo"("p_caballo_id" "uuid", "p_gen" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anular_consulta"("p_historial_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_autor   uuid;
  v_anulada timestamptz;
BEGIN
  SELECT creado_por, anulada_at INTO v_autor, v_anulada
    FROM historial_clinico
   WHERE id = p_historial_id
   FOR UPDATE;

  IF NOT FOUND OR v_anulada IS NOT NULL THEN
    RAISE EXCEPTION 'La consulta no existe o ya fue anulada.';
  END IF;
  IF v_autor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó la consulta puede anularla.';
  END IF;

  UPDATE historial_clinico
     SET anulada_at = now(), anulada_por = auth.uid()
   WHERE id = p_historial_id;
END;
$$;


ALTER FUNCTION "public"."anular_consulta"("p_historial_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bloquear_padrillo_familiar"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.padrillo_id IS NOT NULL
     AND es_familiar_directo(NEW.caballo_id, NEW.padrillo_id, 2) THEN
    RAISE EXCEPTION
      'El padrillo seleccionado es familiar directo de la yegua; no se puede inseminar.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bloquear_padrillo_familiar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bloquear_self_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() = NEW.id THEN
    IF (NEW.rol    IS DISTINCT FROM OLD.rol)
    OR (NEW.activo IS DISTINCT FROM OLD.activo)
    OR (NEW.email  IS DISTINCT FROM OLD.email)
    THEN
      RAISE EXCEPTION
        'No se pueden modificar rol/activo/email desde la propia sesión';
    END IF;

    IF (NEW.dni       IS DISTINCT FROM OLD.dni)
    OR (NEW.matricula IS DISTINCT FROM OLD.matricula)
    THEN
      RAISE EXCEPTION
        'El DNI y la matrícula no se pueden modificar desde la propia sesión';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bloquear_self_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_usuario_por_email"("p_email" "text") RETURNS TABLE("id" "uuid", "nombre" "text", "apellido" "text", "email" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
   SELECT u.id, u.nombre, u.apellido, u.email
   FROM usuario u
   WHERE lower(u.email) = lower(p_email)
     AND u.activo = true
     AND (
       EXISTS (
         SELECT 1 FROM membresia m
         JOIN cat_rol r ON r.id = m.rol_id
         WHERE m.usuario_id = auth.uid()
           AND m.activa = true
           AND r.nombre = 'admin'
       )
       OR EXISTS (
         SELECT 1 FROM usuario sa
         WHERE sa.id = auth.uid() AND sa.rol = 'superadmin'
       )
     );
 $$;


ALTER FUNCTION "public"."buscar_usuario_por_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."caballos_sin_acceso_vet"("p_vet_id" "uuid", "p_caballo_ids" "uuid"[]) RETURNS TABLE("caballo_id" "uuid", "nombre" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id, COALESCE(c.nombre, c.numero_registro, 'Sin nombre')::TEXT
    FROM caballo c
   WHERE c.id = ANY(p_caballo_ids)
     AND (tiene_membresia(c.sociedad_id) OR is_superadmin())
     AND NOT EXISTS (
       SELECT 1 FROM acceso_vet av
        WHERE av.vet_id     = p_vet_id
          AND av.caballo_id = c.id
          AND av.activo
     )
     AND NOT EXISTS (
       SELECT 1 FROM acceso_vet_sociedad avs
        WHERE avs.vet_id      = p_vet_id
          AND avs.sociedad_id = c.sociedad_id
          AND avs.activo
     )
   ORDER BY c.nombre;
$$;


ALTER FUNCTION "public"."caballos_sin_acceso_vet"("p_vet_id" "uuid", "p_caballo_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancelar_pendientes_por_baja"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE cria_recordatorio
    SET estado = 'cancelado',
        cancel_motivo = COALESCE(cancel_motivo, 'Baja del animal')
    WHERE caballo_id = NEW.id
      AND estado IN ('pendiente', 'vencido');

  UPDATE trabajo_sanitario_caballo tsc
    SET excluido = true
    FROM trabajo_sanitario t
    WHERE tsc.trabajo_id = t.id
      AND tsc.caballo_id = NEW.id
      AND t.estado = 'pendiente'
      AND tsc.excluido = false
      AND tsc.historial_id IS NULL;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cancelar_pendientes_por_baja"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancelar_venta_caballo"("p_venta_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE v_caballo_id UUID;
  BEGIN
    SELECT caballo_id INTO v_caballo_id FROM venta_caballo WHERE id = p_venta_id AND estado =
  'pendiente';
    IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada o no pendiente'; END IF;
    UPDATE caballo SET en_venta_pendiente = false WHERE id = v_caballo_id;
    UPDATE venta_caballo SET estado = 'cancelada', updated_at = NOW() WHERE id = p_venta_id;
  END;
  $$;


ALTER FUNCTION "public"."cancelar_venta_caballo"("p_venta_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cerrar_plan_sanitario"("p_items" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_count   INTEGER := 0;
  r         RECORD;
  v_trabajo trabajo_sanitario%ROWTYPE;
  v_tipo_id INTEGER;
  v_hist_id UUID;
  v_hist_actual UUID;
BEGIN
  FOR r IN
    SELECT (i->>'caballo_row_id')::uuid AS row_id,
           (i->>'estado')               AS estado
      FROM jsonb_array_elements(p_items) AS i
  LOOP
    IF r.estado NOT IN ('realizado', 'no_realizado', 'pendiente') THEN
      RAISE EXCEPTION 'Estado inválido: %', r.estado;
    END IF;

    SELECT t.* INTO v_trabajo
      FROM trabajo_sanitario_caballo tsc
      JOIN trabajo_sanitario t ON t.id = tsc.trabajo_id
     WHERE tsc.id = r.row_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fila de trabajo % no encontrada', r.row_id;
    END IF;

    IF NOT (tiene_membresia(v_trabajo.sociedad_id)
            OR is_superadmin()
            OR v_trabajo.creado_por     = v_uid
            OR v_trabajo.compartido_con = v_uid
            OR v_trabajo.vet_owner_id   = v_uid) THEN
      RAISE EXCEPTION 'Sin permiso sobre el trabajo %', v_trabajo.id;
    END IF;

    SELECT historial_id INTO v_hist_actual
      FROM trabajo_sanitario_caballo WHERE id = r.row_id;

    UPDATE trabajo_sanitario_caballo
       SET estado = r.estado, excluido = (r.estado <> 'realizado')
     WHERE id = r.row_id;

    IF r.estado = 'realizado' AND v_hist_actual IS NULL THEN
      INSERT INTO cat_tipo_consulta (nombre) VALUES (v_trabajo.nombre)
        ON CONFLICT (nombre) DO NOTHING;
      SELECT id INTO v_tipo_id FROM cat_tipo_consulta WHERE nombre = v_trabajo.nombre;

      INSERT INTO historial_clinico
        (caballo_id, tipo_consulta_id, fecha_consulta, tratamiento, observaciones, creado_por)
      SELECT tsc.caballo_id, v_tipo_id, NOW(), v_trabajo.tratamiento, v_trabajo.observaciones, v_uid
        FROM trabajo_sanitario_caballo tsc
       WHERE tsc.id = r.row_id
      RETURNING id INTO v_hist_id;

      UPDATE trabajo_sanitario_caballo SET historial_id = v_hist_id WHERE id = r.row_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  UPDATE trabajo_sanitario t
     SET estado = 'realizado', fecha_realizado = CURRENT_DATE
   WHERE t.estado = 'pendiente'
     AND NOT EXISTS (
       SELECT 1 FROM trabajo_sanitario_caballo tsc
        WHERE tsc.trabajo_id = t.id AND tsc.estado IS NULL
     )
     AND EXISTS (
       SELECT 1 FROM trabajo_sanitario_caballo tsc
        WHERE tsc.trabajo_id = t.id
          AND tsc.id IN (
            SELECT (i->>'caballo_row_id')::uuid FROM jsonb_array_elements(p_items) AS i
          )
     );

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."cerrar_plan_sanitario"("p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cerrar_recordatorios_flushing"("p_caballo_id" "uuid", "p_flushing_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada';
  END IF;

  IF p_flushing_id IS NULL THEN
    RAISE EXCEPTION 'p_flushing_id es obligatorio';
  END IF;

  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR tiene_membresia((SELECT c.sociedad_id FROM caballo c WHERE c.id = p_caballo_id))
    OR is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE cria_recordatorio
  SET estado        = 'cancelado',
      cancel_motivo = 'Ciclo cerrado por nuevo flushing',
      updated_at    = now()
  WHERE caballo_id = p_caballo_id
    AND estado IN ('pendiente', 'vencido')
    AND auto_generado = true
    AND tipo NOT IN ('Eco 1', 'Eco 2', 'Eco 3', 'Revisión Eco')
    AND flushing_id IS DISTINCT FROM p_flushing_id;
END;
$$;


ALTER FUNCTION "public"."cerrar_recordatorios_flushing"("p_caballo_id" "uuid", "p_flushing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compartir_trabajos_con_vet"("p_trabajo_ids" "uuid"[], "p_vet_id" "uuid", "p_otorgar_acceso" boolean) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_caballos   UUID[];
  v_faltantes  INTEGER;
  v_otorgados  INTEGER := 0;
  v_nombre     TEXT;
  v_plan       TEXT;
  v_fecha      DATE;
  v_soc        UUID;
BEGIN
  IF p_vet_id IS NULL THEN
    RAISE EXCEPTION 'Falta el veterinario';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM usuario u
     WHERE u.id = p_vet_id AND u.rol = 'veterinario' AND u.activo
  ) THEN
    RAISE EXCEPTION 'El usuario seleccionado no es un veterinario activo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM trabajo_sanitario t
     WHERE t.id = ANY(p_trabajo_ids) AND t.vet_owner_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Los planes sobre caballos propios de un veterinario no se pueden compartir';
  END IF;

  IF EXISTS (
    SELECT 1 FROM trabajo_sanitario t
     WHERE t.id = ANY(p_trabajo_ids)
       AND NOT (tiene_membresia(t.sociedad_id) OR is_superadmin() OR t.creado_por = v_uid)
  ) THEN
    RAISE EXCEPTION 'Sin permiso para compartir alguno de estos trabajos';
  END IF;

  SELECT ARRAY_AGG(DISTINCT tsc.caballo_id)
    INTO v_caballos
    FROM trabajo_sanitario_caballo tsc
   WHERE tsc.trabajo_id = ANY(p_trabajo_ids);

  SELECT COUNT(*) INTO v_faltantes
    FROM caballos_sin_acceso_vet(p_vet_id, COALESCE(v_caballos, '{}'));

  IF v_faltantes > 0 AND NOT p_otorgar_acceso THEN
    RAISE EXCEPTION
      'El veterinario no tiene acceso a % caballo(s) del plan', v_faltantes;
  END IF;

  IF v_faltantes > 0 THEN
    INSERT INTO acceso_vet (vet_id, caballo_id, otorgado_por, activo)
    SELECT p_vet_id, s.caballo_id, v_uid, TRUE
      FROM caballos_sin_acceso_vet(p_vet_id, COALESCE(v_caballos, '{}')) s
    ON CONFLICT (vet_id, caballo_id) DO UPDATE
      SET activo = TRUE, otorgado_por = EXCLUDED.otorgado_por;
    GET DIAGNOSTICS v_otorgados = ROW_COUNT;
  END IF;

  UPDATE trabajo_sanitario
     SET compartido_con = p_vet_id
   WHERE id = ANY(p_trabajo_ids);

  SELECT STRING_AGG(DISTINCT t.nombre, ', '), MIN(t.fecha_programada), MIN(t.sociedad_id::TEXT)::UUID
    INTO v_plan, v_fecha, v_soc
    FROM trabajo_sanitario t
   WHERE t.id = ANY(p_trabajo_ids);

  SELECT s.nombre INTO v_nombre FROM sociedad s WHERE s.id = v_soc;

  INSERT INTO notificacion (usuario_id, sociedad_id, tipo, titulo, cuerpo, link)
  VALUES (
    p_vet_id,
    v_soc,
    'plan_sanitario_compartido',
    'Te asignaron un plan sanitario',
    COALESCE(v_nombre, 'Una empresa') || ' te asignó ' || COALESCE(v_plan, 'un plan sanitario')
      || ' sobre ' || COALESCE(ARRAY_LENGTH(v_caballos, 1), 0) || ' caballo(s)'
      || ' para el ' || TO_CHAR(v_fecha, 'DD/MM/YYYY') || '.',
    '/sanidad'
  );

  RETURN v_otorgados;
END;
$$;


ALTER FUNCTION "public"."compartir_trabajos_con_vet"("p_trabajo_ids" "uuid"[], "p_vet_id" "uuid", "p_otorgar_acceso" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."completar_trabajo_sanitario"("p_trabajo_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_trabajo   trabajo_sanitario%ROWTYPE;
  v_tipo_id   INTEGER;
  v_uid       UUID := auth.uid();
  v_count     INTEGER := 0;
  r           RECORD;
  v_hist_id   UUID;
BEGIN
  SELECT * INTO v_trabajo FROM trabajo_sanitario WHERE id = p_trabajo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trabajo sanitario % no encontrado', p_trabajo_id;
  END IF;

  IF NOT (tiene_membresia(v_trabajo.sociedad_id)
          OR is_superadmin()
          OR v_trabajo.compartido_con = v_uid
          OR v_trabajo.vet_owner_id   = v_uid) THEN
    RAISE EXCEPTION 'Sin permiso para completar este trabajo';
  END IF;

  IF v_trabajo.estado = 'realizado' THEN
    RAISE EXCEPTION 'El trabajo ya fue marcado como realizado';
  END IF;

  INSERT INTO cat_tipo_consulta (nombre) VALUES (v_trabajo.nombre)
    ON CONFLICT (nombre) DO NOTHING;
  SELECT id INTO v_tipo_id FROM cat_tipo_consulta WHERE nombre = v_trabajo.nombre;

  FOR r IN
    SELECT tsc.id, tsc.caballo_id
    FROM trabajo_sanitario_caballo tsc
    WHERE tsc.trabajo_id = p_trabajo_id
      AND tsc.excluido = false
      AND tsc.historial_id IS NULL
  LOOP
    INSERT INTO historial_clinico
      (caballo_id, tipo_consulta_id, fecha_consulta, tratamiento, observaciones, creado_por)
    VALUES
      (r.caballo_id, v_tipo_id, NOW(), v_trabajo.tratamiento, v_trabajo.observaciones, v_uid)
    RETURNING id INTO v_hist_id;

    UPDATE trabajo_sanitario_caballo SET historial_id = v_hist_id WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  UPDATE trabajo_sanitario
    SET estado = 'realizado', fecha_realizado = CURRENT_DATE
    WHERE id = p_trabajo_id;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."completar_trabajo_sanitario"("p_trabajo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_caballo_veterinario"("p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text" DEFAULT NULL::"text", "p_numero_registro" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE
    v_caballo_id uuid;
  BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('vet_limite_caballos'), hashtext(auth.uid()::text));

    IF NOT vet_puede_agregar_caballo(auth.uid()) THEN
      IF vet_suscripcion_activa(auth.uid()) THEN
        RAISE EXCEPTION 'Llegaste al límite de % caballos propios que incluye la membresía de veterinario. Escribinos y lo vemos.', vet_limite_pago()
          USING ERRCODE = 'HM002';
      ELSE
        RAISE EXCEPTION 'Alcanzaste el límite de % caballos propios del plan gratuito. Activá tu membresía para llegar hasta %.', vet_limite_gratuito(), vet_limite_pago()
          USING ERRCODE = 'HM001';
      END IF;
    END IF;

    INSERT INTO caballo(
      nombre, fecha_nacimiento, categoria,
      raza_id, pelaje_id, numero_chip, numero_registro,
      sociedad_id, campo_id, vet_owner_id, activo
    )
    VALUES (
      p_nombre, p_fecha_nacimiento, p_categoria,
      p_raza_id, p_pelaje_id, p_numero_chip, p_numero_registro,
      null, null, auth.uid(), true
    )
    RETURNING id INTO v_caballo_id;

    INSERT INTO acceso_vet(vet_id, caballo_id, otorgado_por, activo)
    VALUES (auth.uid(), v_caballo_id, auth.uid(), true)
    ON CONFLICT (vet_id, caballo_id) DO UPDATE SET activo = true;

    RETURN v_caballo_id;
  END;
$$;


ALTER FUNCTION "public"."crear_caballo_veterinario"("p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_plan_sanitario_compartido"("p_items" "jsonb", "p_vet_id" "uuid" DEFAULT NULL::"uuid", "p_otorgar_acceso" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_plan_id     UUID := gen_random_uuid();
  v_trabajo_ids UUID[] := '{}';
  v_trabajo_id  UUID;
  v_soc         UUID;
  v_owner       UUID;
  v_cabs        UUID[];
  v_ajenos      INTEGER;
  it            JSONB;
BEGIN
  IF JSONB_ARRAY_LENGTH(p_items) = 0 THEN
    RAISE EXCEPTION 'No hay trabajos para crear';
  END IF;

  FOR it IN SELECT * FROM JSONB_ARRAY_ELEMENTS(p_items)
  LOOP
    v_soc   := NULLIF(it->>'sociedad_id', '')::UUID;
    v_owner := NULL;

    SELECT ARRAY_AGG(cab::UUID) INTO v_cabs
      FROM JSONB_ARRAY_ELEMENTS_TEXT(it->'caballo_ids') AS cab;

    IF v_cabs IS NULL OR ARRAY_LENGTH(v_cabs, 1) IS NULL THEN
      RAISE EXCEPTION 'Un trabajo del plan vino sin caballos';
    END IF;

    IF v_soc IS NULL THEN
      v_owner := v_uid;

      SELECT COUNT(*) INTO v_ajenos
        FROM UNNEST(v_cabs) AS cid
       WHERE NOT EXISTS (
         SELECT 1 FROM caballo c
          WHERE c.id = cid AND c.sociedad_id IS NULL AND c.vet_owner_id = v_uid
       );
      IF v_ajenos > 0 THEN
        RAISE EXCEPTION 'El plan incluye % caballo(s) que no son propios', v_ajenos;
      END IF;
    ELSE
      IF NOT (tiene_membresia(v_soc) OR EXISTS (
        SELECT 1 FROM acceso_vet av
          JOIN caballo c ON c.id = av.caballo_id
         WHERE av.vet_id = v_uid AND av.activo AND c.sociedad_id = v_soc
      )) THEN
        RAISE EXCEPTION 'Sin permiso para crear trabajos en esa empresa';
      END IF;

      SELECT COUNT(*) INTO v_ajenos
        FROM UNNEST(v_cabs) AS cid
       WHERE NOT EXISTS (
         SELECT 1 FROM caballo c WHERE c.id = cid AND c.sociedad_id = v_soc
       );
      IF v_ajenos > 0 THEN
        RAISE EXCEPTION 'El plan incluye % caballo(s) que no son de esa empresa', v_ajenos;
      END IF;
    END IF;

    INSERT INTO trabajo_sanitario
      (plan_id, sociedad_id, vet_owner_id, nombre, fecha_programada,
       tratamiento, observaciones, creado_por)
    VALUES (
      v_plan_id,
      v_soc,
      v_owner,
      it->>'nombre',
      (it->>'fecha_programada')::DATE,
      NULLIF(it->>'tratamiento', ''),
      NULLIF(it->>'observaciones', ''),
      v_uid
    )
    RETURNING id INTO v_trabajo_id;

    INSERT INTO trabajo_sanitario_caballo (trabajo_id, caballo_id)
    SELECT v_trabajo_id, cid FROM UNNEST(v_cabs) AS cid;

    v_trabajo_ids := v_trabajo_ids || v_trabajo_id;
  END LOOP;

  IF p_vet_id IS NOT NULL THEN
    PERFORM compartir_trabajos_con_vet(v_trabajo_ids, p_vet_id, p_otorgar_acceso);
  END IF;

  RETURN v_plan_id;
END;
$$;


ALTER FUNCTION "public"."crear_plan_sanitario_compartido"("p_items" "jsonb", "p_vet_id" "uuid", "p_otorgar_acceso" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dar_de_baja_caballos_veterinario"("p_caballo_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE
    v_afectados INTEGER;
  BEGIN
    IF p_caballo_ids IS NULL OR array_length(p_caballo_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No seleccionaste ningún caballo para dar de baja.';
    END IF;

    PERFORM _vet_valida_propios(p_caballo_ids, TRUE);

    UPDATE caballo
       SET activo = FALSE
     WHERE id = ANY(p_caballo_ids)
       AND (
         (vet_owner_id = auth.uid() AND sociedad_id IS NULL)
         OR vet_tiene_acceso(id)
       );

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RETURN v_afectados;
  END;
  $$;


ALTER FUNCTION "public"."dar_de_baja_caballos_veterinario"("p_caballo_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."editar_masivo_veterinario"("p_caballo_ids" "uuid"[], "p_campo_id" "uuid" DEFAULT NULL::"uuid", "p_categoria" "text" DEFAULT NULL::"text", "p_subcategoria" "text" DEFAULT NULL::"text", "p_prenada" boolean DEFAULT NULL::boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id UUID;
  UUID_CERO CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuario WHERE id = auth.uid() AND rol = 'veterinario' AND activo = TRUE
  ) THEN
    RAISE EXCEPTION 'Solo veterinarios pueden usar esta función';
  END IF;

  FOREACH v_id IN ARRAY p_caballo_ids LOOP
    IF NOT (
      vet_tiene_acceso(v_id)
      OR EXISTS (SELECT 1 FROM caballo WHERE id = v_id AND vet_owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'Sin acceso al caballo %', v_id;
    END IF;
  END LOOP;

  UPDATE caballo
  SET
    campo_id         = CASE
                         WHEN p_campo_id = UUID_CERO THEN NULL
                         WHEN p_campo_id IS NOT NULL THEN p_campo_id
                         ELSE campo_id
                       END,
    categoria        = COALESCE(p_categoria, categoria),
    rol_reproductivo = CASE WHEN p_subcategoria IS NOT NULL THEN NULLIF(p_subcategoria, '')
                            ELSE rol_reproductivo END,
    prenada          = COALESCE(p_prenada, prenada),
    fecha_prenez     = CASE WHEN p_prenada = FALSE THEN NULL
                            ELSE fecha_prenez END
  WHERE id = ANY(p_caballo_ids)
    AND activo = TRUE;
END;
$$;


ALTER FUNCTION "public"."editar_masivo_veterinario"("p_caballo_ids" "uuid"[], "p_campo_id" "uuid", "p_categoria" "text", "p_subcategoria" "text", "p_prenada" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."editar_ovulacion"("p_registro_id" "uuid", "p_fecha" "date", "p_fecha_flushing" "date", "p_veterinario_id" "uuid", "p_caballo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_uid uuid:=auth.uid(); v_old cria_registro_clinico%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM cria_registro_clinico WHERE id=p_registro_id FOR UPDATE;
  IF NOT FOUND OR NOT (v_old.ovario_izq @> ARRAY['OV']::text[] OR v_old.ovario_der @> ARRAY['OV']::text[])
    THEN RAISE EXCEPTION 'La ovulación no existe'; END IF;
  IF v_uid IS NULL OR NOT vet_tiene_acceso(v_old.caballo_id) OR NOT vet_tiene_acceso(p_caballo_id)
    THEN RAISE EXCEPTION 'Sin permiso para editar la ovulación'; END IF;
  UPDATE cria_registro_clinico SET fecha=p_fecha,fecha_flushing_programada=p_fecha_flushing,
    veterinario_id=p_veterinario_id,caballo_id=p_caballo_id,updated_at=now() WHERE id=p_registro_id;
  UPDATE cria_recordatorio SET caballo_id=p_caballo_id,veterinario_id=p_veterinario_id,
    fecha_vto=CASE WHEN tipo='Flushing' THEN p_fecha_flushing ELSE p_fecha+(fecha_vto-v_old.fecha) END,updated_at=now()
    WHERE origen_registro_id=p_registro_id AND estado IN ('pendiente','vencido');
  INSERT INTO cria_evento_reproductivo(sociedad_id,caballo_id,registro_id,tipo,datos,creado_por)
  VALUES(v_old.sociedad_id,p_caballo_id,p_registro_id,'ovulacion_editada',
    jsonb_build_object('anterior',jsonb_build_object('fecha',v_old.fecha,'fecha_flushing',v_old.fecha_flushing_programada,
      'veterinario_id',v_old.veterinario_id,'caballo_id',v_old.caballo_id),
      'nuevo',jsonb_build_object('fecha',p_fecha,'fecha_flushing',p_fecha_flushing,
      'veterinario_id',p_veterinario_id,'caballo_id',p_caballo_id)),v_uid);
END $$;


ALTER FUNCTION "public"."editar_ovulacion"("p_registro_id" "uuid", "p_fecha" "date", "p_fecha_flushing" "date", "p_veterinario_id" "uuid", "p_caballo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ejecutar_venta_caballo"("p_venta_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE v_caballo_id UUID; v_compradora UUID; v_tipo TEXT;
  BEGIN
    SELECT caballo_id, sociedad_compradora_id, tipo_comprador
    INTO v_caballo_id, v_compradora, v_tipo FROM venta_caballo WHERE id = p_venta_id AND estado
  = 'pendiente';
    IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada o no pendiente'; END IF;
    IF v_tipo = 'registrado' AND v_compradora IS NOT NULL THEN
      UPDATE caballo SET sociedad_id = v_compradora, en_venta_pendiente = false WHERE id =
  v_caballo_id;
    ELSE
      UPDATE caballo SET activo = false, en_venta_pendiente = false WHERE id = v_caballo_id;
    END IF;
    UPDATE venta_caballo SET estado = 'aceptada', updated_at = NOW() WHERE id = p_venta_id;
  END;
  $$;


ALTER FUNCTION "public"."ejecutar_venta_caballo"("p_venta_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."eliminar_ecografia_cria"("p_ecografia_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  e cria_ecografia%ROWTYPE;
BEGIN
  SELECT * INTO e FROM cria_ecografia WHERE id = p_ecografia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La ecografía no existe.';
  END IF;
  IF e.veterinario_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó la ecografía puede eliminarla.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cria_ecografia x
     WHERE x.transferencia_id = e.transferencia_id AND x.numero > e.numero
  ) THEN
    RAISE EXCEPTION 'Solo se puede eliminar la última ecografía de la transferencia.';
  END IF;

  DELETE FROM cria_ecografia WHERE id = p_ecografia_id;

  -- Solo se deshace un aborto, y solo si es la transferencia vigente de la receptora.
  IF e.resultado = 'abortada' AND _cria_transferencia_vigente(e.transferencia_id) THEN
    PERFORM _cria_revertir_aborto(
      e.caballo_receptora_id, e.sociedad_id, e.transferencia_id, e.numero,
      format('Ecografía %s abortada eliminada', e.numero), auth.uid());
  END IF;

  PERFORM _cria_reabrir_recordatorio(e.origen_recordatorio_id);
END;
$$;


ALTER FUNCTION "public"."eliminar_ecografia_cria"("p_ecografia_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."eliminar_embrion_cria"("p_embrion_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_flushing uuid;
  v_autor    uuid;
BEGIN
  SELECT e.flushing_id, COALESCE(f.veterinario_id, e.creado_por) INTO v_flushing, v_autor
    FROM embrion e
    LEFT JOIN cria_flushing f ON f.id = e.flushing_id
   WHERE e.id = p_embrion_id
   FOR UPDATE OF e;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El embrión no existe.';
  END IF;
  IF v_autor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó el embrión (o su flushing) puede eliminarlo.';
  END IF;
  IF EXISTS (SELECT 1 FROM cria_transferencia WHERE embrion_id = p_embrion_id) THEN
    RAISE EXCEPTION 'El embrión ya se transfirió: eliminá primero la transferencia.';
  END IF;

  DELETE FROM embrion WHERE id = p_embrion_id;

  IF v_flushing IS NOT NULL THEN
    UPDATE cria_flushing
       SET cantidad = GREATEST(COALESCE(cantidad, 1) - 1, 0), updated_at = now()
     WHERE id = v_flushing;
  END IF;
END;
$$;


ALTER FUNCTION "public"."eliminar_embrion_cria"("p_embrion_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."eliminar_flushing_cria"("p_flushing_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  f          cria_flushing%ROWTYPE;
  v_embriones integer;
BEGIN
  SELECT * INTO f FROM cria_flushing WHERE id = p_flushing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El flushing no existe.';
  END IF;
  IF f.veterinario_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó el flushing puede eliminarlo.';
  END IF;

  SELECT COUNT(*) INTO v_embriones FROM embrion WHERE flushing_id = p_flushing_id;
  IF v_embriones > 0 THEN
    RAISE EXCEPTION 'El flushing tiene % embrión(es) cargado(s): eliminalos primero desde Embriones.', v_embriones;
  END IF;
  IF EXISTS (SELECT 1 FROM cria_transferencia WHERE flushing_id = p_flushing_id) THEN
    RAISE EXCEPTION 'Hay transferencias hechas con este flushing: eliminalas primero.';
  END IF;

  UPDATE cria_estado_transicion SET flushing_origen_id = NULL
   WHERE flushing_origen_id = p_flushing_id;

  DELETE FROM cria_flushing WHERE id = p_flushing_id;

  PERFORM _cria_reabrir_recordatorio(f.origen_recordatorio_id);
END;
$$;


ALTER FUNCTION "public"."eliminar_flushing_cria"("p_flushing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."eliminar_recordatorio_cria"("p_recordatorio_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_autor uuid;
BEGIN
  SELECT veterinario_id INTO v_autor
    FROM cria_recordatorio WHERE id = p_recordatorio_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El recordatorio no existe.';
  END IF;
  IF v_autor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó el recordatorio puede eliminarlo.';
  END IF;

  -- Registros y ecografías sueltan el vínculo solos (ON DELETE SET NULL); el
  -- flushing tiene la FK sin acción y se suelta a mano, con el mismo criterio.
  UPDATE cria_flushing SET origen_recordatorio_id = NULL
   WHERE origen_recordatorio_id = p_recordatorio_id;

  DELETE FROM cria_recordatorio WHERE id = p_recordatorio_id;
END;
$$;


ALTER FUNCTION "public"."eliminar_recordatorio_cria"("p_recordatorio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."eliminar_registro_cria"("p_registro_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_autor uuid;
BEGIN
  SELECT veterinario_id INTO v_autor
    FROM cria_registro_clinico WHERE id = p_registro_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El registro no existe.';
  END IF;
  IF v_autor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó el registro puede eliminarlo.';
  END IF;
  IF EXISTS (SELECT 1 FROM cria_transferencia WHERE registro_id = p_registro_id) THEN
    RAISE EXCEPTION 'Este registro es el de una transferencia embrionaria: para borrarlo, eliminá la transferencia.';
  END IF;

  PERFORM _cria_borrar_registro(p_registro_id);
END;
$$;


ALTER FUNCTION "public"."eliminar_registro_cria"("p_registro_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."eliminar_transferencia_cria"("p_transferencia_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  t      cria_transferencia%ROWTYPE;
  v_ecos integer;
BEGIN
  SELECT * INTO t FROM cria_transferencia WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La transferencia no existe.';
  END IF;
  IF t.veterinario_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó la transferencia puede eliminarla.';
  END IF;

  SELECT COUNT(*) INTO v_ecos FROM cria_ecografia WHERE transferencia_id = p_transferencia_id;
  IF v_ecos > 0 THEN
    RAISE EXCEPTION 'La transferencia tiene % ecografía(s) cargada(s): eliminalas primero, empezando por la última.', v_ecos;
  END IF;

  -- Borrar registros dependientes
  DELETE FROM cria_recordatorio WHERE transferencia_id = p_transferencia_id;
  DELETE FROM cria_evento_reproductivo WHERE transferencia_id = p_transferencia_id;
  DELETE FROM cria_seguimiento_gestacion WHERE transferencia_id = p_transferencia_id;

  UPDATE cria_estado_transicion SET transferencia_origen_id = NULL
   WHERE transferencia_origen_id = p_transferencia_id;

  DELETE FROM cria_transferencia WHERE id = p_transferencia_id;

  -- El estado previo del embrión no se guarda: vuelve a disponible.
  IF t.embrion_id IS NOT NULL THEN
    UPDATE embrion SET estado = 'disponible', updated_at = now()
     WHERE id = t.embrion_id AND estado = 'transferido';
  END IF;

  -- La preñez la marcó esta transferencia: se deshace si no hay otra posterior.
  UPDATE caballo c
     SET prenada = false, fecha_prenez = NULL, updated_at = now()
   WHERE c.id = t.caballo_receptora_id
     AND c.prenada
     AND c.fecha_prenez = t.fecha
     AND NOT EXISTS (
       SELECT 1 FROM cria_transferencia x
        WHERE x.caballo_receptora_id = t.caballo_receptora_id
          AND x.fecha >= t.fecha
     );

  -- El registro de la receptora lo creó la transferencia: se va con ella.
  PERFORM _cria_borrar_registro(t.registro_id);
END;
$$;


ALTER FUNCTION "public"."eliminar_transferencia_cria"("p_transferencia_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_admin"("p_sociedad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membresia m
    JOIN cat_rol   r ON r.id = m.rol_id
    WHERE m.usuario_id  = auth.uid()
      AND m.sociedad_id = p_sociedad_id
      AND m.activa      = TRUE
      AND r.nombre      = 'admin'
  );
$$;


ALTER FUNCTION "public"."es_admin"("p_sociedad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_familiar_directo"("p_a" "uuid", "p_b" "uuid", "p_gen" integer DEFAULT 2) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p_a IS NOT NULL AND p_b IS NOT NULL AND EXISTS (
    SELECT 1
    FROM ancestros_caballo(p_a, p_gen) x
    JOIN ancestros_caballo(p_b, p_gen) y ON y.caballo_id = x.caballo_id
  );
$$;


ALTER FUNCTION "public"."es_familiar_directo"("p_a" "uuid", "p_b" "uuid", "p_gen" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_veterinario"("p_sociedad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
      SELECT 1
      FROM membresia m
      JOIN cat_rol r ON r.id = m.rol_id
      WHERE m.usuario_id  = auth.uid()
        AND m.sociedad_id = p_sociedad_id
        AND m.activa      = TRUE
        AND r.nombre      = 'veterinario'
    )
    OR EXISTS (
      SELECT 1 FROM usuario
      WHERE id     = auth.uid()
        AND rol    = 'veterinario'
        AND activo = TRUE
    );
  $$;


ALTER FUNCTION "public"."es_veterinario"("p_sociedad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_auditar"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_antes    JSONB;
  v_despues  JSONB;
  v_fila     JSONB;
  v_campos   TEXT[];
  v_registro TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_despues := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_antes := to_jsonb(OLD);
  ELSE
    v_antes   := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);

    SELECT array_agg(o.key ORDER BY o.key)
      INTO v_campos
      FROM jsonb_each(v_antes) AS o
     WHERE o.value IS DISTINCT FROM v_despues -> o.key;

    IF v_campos IS NULL OR v_campos = ARRAY['updated_at'] THEN
      RETURN NULL;
    END IF;
  END IF;

  v_fila := COALESCE(v_despues, v_antes);

  SELECT string_agg(v_fila ->> att.attname, ':' ORDER BY att.attnum)
    INTO v_registro
    FROM pg_index i
    JOIN pg_attribute att
      ON att.attrelid = i.indrelid
     AND att.attnum   = ANY (i.indkey)
   WHERE i.indrelid = TG_RELID
     AND i.indisprimary;

  INSERT INTO auditoria (
    tabla, registro_id, operacion, usuario_id, sociedad_id,
    campos, datos_antes, datos_despues
  )
  VALUES (
    TG_TABLE_NAME,
    v_registro,
    TG_OP,
    auth.uid(),
    NULLIF(v_fila ->> 'sociedad_id', '')::UUID,
    v_campos,
    v_antes,
    v_despues
  );

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."fn_auditar"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_auditar"() IS 'Trigger genérico de auditoría. Se engancha AFTER INSERT/UPDATE/DELETE en las tablas sensibles.';



CREATE OR REPLACE FUNCTION "public"."get_alertas_vet"() RETURNS TABLE("historial_id" "uuid", "proxima_consulta" "date", "caballo_id" "uuid", "caballo_nombre" "text", "tipo" "text", "dias_restantes" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    hc.id AS historial_id,
    hc.proxima_consulta,
    hc.caballo_id,
    c.nombre::text AS caballo_nombre,
    ct.nombre::text AS tipo,
    (hc.proxima_consulta - CURRENT_DATE)::INTEGER AS dias_restantes
  FROM historial_clinico hc
  JOIN caballo c ON c.id = hc.caballo_id
  LEFT JOIN cat_tipo_consulta ct ON ct.id = hc.tipo_consulta_id
  WHERE hc.creado_por = auth.uid()
    AND hc.anulada_at IS NULL
    AND c.activo = TRUE
    AND hc.proxima_consulta IS NOT NULL
    AND hc.proxima_consulta <= CURRENT_DATE + INTERVAL '30 days'
  ORDER BY hc.proxima_consulta ASC;
$$;


ALTER FUNCTION "public"."get_alertas_vet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_caballos_pedigree_vet"() RETURNS TABLE("id" "uuid", "nombre" "text", "categoria" "text", "activo" boolean, "sociedad_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id, c.nombre::TEXT, c.categoria::TEXT, c.activo, c.sociedad_id
  FROM acceso_vet av
  JOIN caballo c ON c.id = av.caballo_id
  WHERE av.vet_id = auth.uid() AND av.activo = TRUE

  UNION

  SELECT c.id, c.nombre::TEXT, c.categoria::TEXT, c.activo, c.sociedad_id
  FROM acceso_vet_sociedad avs
  JOIN caballo c ON c.sociedad_id = avs.sociedad_id
  WHERE avs.vet_id = auth.uid() AND avs.activo = TRUE

  ORDER BY 2;
$$;


ALTER FUNCTION "public"."get_caballos_pedigree_vet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_caballos_propios_vet"() RETURNS TABLE("id" "uuid", "nombre" "text", "categoria" "text", "fecha_nacimiento" "date", "raza_nombre" "text", "pelaje_nombre" "text", "created_at" timestamp with time zone, "consultas" integer, "ultima_consulta" "date")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    c.id,
    c.nombre::TEXT,
    c.categoria::TEXT,
    c.fecha_nacimiento,
    r.nombre::TEXT   AS raza_nombre,
    pel.nombre::TEXT AS pelaje_nombre,
    c.created_at,
    COALESCE(h.total, 0)::INTEGER AS consultas,
    h.ultima::date                AS ultima_consulta
  FROM caballo c
  LEFT JOIN cat_raza   r   ON r.id   = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total, MAX(hc.fecha_consulta) AS ultima
    FROM historial_clinico hc
    WHERE hc.caballo_id = c.id
      AND hc.anulada_at IS NULL
  ) h ON TRUE
  WHERE c.vet_owner_id = auth.uid()
    AND c.sociedad_id  IS NULL
    AND c.activo       = TRUE
  ORDER BY c.created_at DESC;
$$;


ALTER FUNCTION "public"."get_caballos_propios_vet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_caballos_propios_vet_inactivos"() RETURNS TABLE("id" "uuid", "nombre" "text", "categoria" "text", "fecha_nacimiento" "date", "raza_nombre" "text", "pelaje_nombre" "text", "fecha_baja" timestamp with time zone, "consultas" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    c.id,
    c.nombre::TEXT,
    c.categoria::TEXT,
    c.fecha_nacimiento,
    r.nombre::TEXT   AS raza_nombre,
    pel.nombre::TEXT AS pelaje_nombre,
    c.updated_at     AS fecha_baja,
    COALESCE(h.total, 0)::INTEGER AS consultas
  FROM caballo c
  LEFT JOIN cat_raza   r   ON r.id   = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM historial_clinico hc
    WHERE hc.caballo_id = c.id
      AND hc.anulada_at IS NULL
  ) h ON TRUE
  WHERE c.vet_owner_id = auth.uid()
    AND c.sociedad_id  IS NULL
    AND c.activo       = FALSE
  ORDER BY c.updated_at DESC;
$$;


ALTER FUNCTION "public"."get_caballos_propios_vet_inactivos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_caballos_sociedad"("p_sociedad_id" "uuid") RETURNS TABLE("id" "uuid", "nombre" "text", "fecha_nacimiento" "date", "categoria" "text", "sexo" "text", "rol_reproductivo" "text", "estado_reproductivo" "text", "prenada" boolean, "fecha_prenez" "date", "observaciones" "text", "domador" "text", "numero_chip" "text", "numero_registro" "text", "activo" boolean, "sociedad_id" "uuid", "campo_id" "uuid", "raza_id" integer, "pelaje_id" integer, "padre_id" "uuid", "padre_nombre" "text", "madre_id" "uuid", "madre_nombre" "text", "raza_nombre" "text", "pelaje_nombre" "text", "campo_nombre" "text", "tags" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    c.id, c.nombre, c.fecha_nacimiento,
    c.categoria, c.sexo, c.rol_reproductivo, c.estado_reproductivo,
    COALESCE(c.prenada, false), c.fecha_prenez,
    c.observaciones, c.domador,
    c.numero_chip, c.numero_registro,
    c.activo, c.sociedad_id, c.campo_id,
    c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre, pel.nombre, ca.nombre,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ct.id, 'nombre', ct.nombre, 'color', ct.color, 'activo', ct.activo))
       FROM caballo_tag cta JOIN cat_tag ct ON ct.id = cta.tag_id
       WHERE cta.caballo_id = c.id),
      '[]'::jsonb
    )
  FROM caballo c
  LEFT JOIN cat_raza r ON r.id = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN campo ca ON ca.id = c.campo_id
  WHERE c.sociedad_id = p_sociedad_id AND c.activo = true
    AND tiene_membresia(p_sociedad_id)
  ORDER BY c.nombre;
$$;


ALTER FUNCTION "public"."get_caballos_sociedad"("p_sociedad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_caballos_veterinario"() RETURNS TABLE("id" "uuid", "nombre" "text", "fecha_nacimiento" "date", "categoria" "text", "rol_reproductivo" "text", "estado_reproductivo" "text", "prenada" boolean, "fecha_prenez" "date", "numero_chip" "text", "numero_registro" "text", "activo" boolean, "sociedad_id" "uuid", "empresa_nombre" "text", "vet_owner_id" "uuid", "campo_id" "uuid", "raza_id" integer, "pelaje_id" integer, "padre_id" "uuid", "padre_nombre" "text", "madre_id" "uuid", "madre_nombre" "text", "raza_nombre" "text", "pelaje_nombre" "text", "campo_nombre" "text", "propietario_nombre" "text", "domador" "text", "sexo" "text", "observaciones" "text", "tags" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    c.id, c.nombre, c.fecha_nacimiento,
    c.categoria, c.rol_reproductivo, c.estado_reproductivo,
    COALESCE(c.prenada, false), c.fecha_prenez,
    c.numero_chip, c.numero_registro,
    c.activo, c.sociedad_id,
    s.nombre, c.vet_owner_id,
    c.campo_id, c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre, pel.nombre, ca.nombre,
    pr.nombre, c.domador, c.sexo, c.observaciones,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ct.id, 'nombre', ct.nombre, 'color', ct.color, 'activo', ct.activo))
       FROM caballo_tag cta JOIN cat_tag ct ON ct.id = cta.tag_id
       WHERE cta.caballo_id = c.id),
      '[]'::jsonb
    )
  FROM acceso_vet av
  JOIN caballo c ON c.id = av.caballo_id
  LEFT JOIN sociedad s ON s.id = c.sociedad_id
  LEFT JOIN cat_raza r ON r.id = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN campo ca ON ca.id = c.campo_id
  LEFT JOIN propiedad pp ON pp.caballo_id = c.id AND pp.fecha_fin IS NULL
  LEFT JOIN propietario pr ON pr.id = pp.propietario_id
  WHERE av.vet_id = auth.uid() AND av.activo = true AND c.activo = true

  UNION

  SELECT
    c.id, c.nombre, c.fecha_nacimiento,
    c.categoria, c.rol_reproductivo, c.estado_reproductivo,
    COALESCE(c.prenada, false), c.fecha_prenez,
    c.numero_chip, c.numero_registro,
    c.activo, c.sociedad_id,
    s.nombre, c.vet_owner_id,
    c.campo_id, c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre, pel.nombre, ca.nombre,
    pr.nombre, c.domador, c.sexo, c.observaciones,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ct.id, 'nombre', ct.nombre, 'color', ct.color, 'activo', ct.activo))
       FROM caballo_tag cta JOIN cat_tag ct ON ct.id = cta.tag_id
       WHERE cta.caballo_id = c.id),
      '[]'::jsonb
    )
  FROM acceso_vet_sociedad avs
  JOIN caballo c ON c.sociedad_id = avs.sociedad_id
  LEFT JOIN sociedad s ON s.id = c.sociedad_id
  LEFT JOIN cat_raza r ON r.id = c.raza_id
  LEFT JOIN cat_pelaje pel ON pel.id = c.pelaje_id
  LEFT JOIN campo ca ON ca.id = c.campo_id
  LEFT JOIN propiedad pp ON pp.caballo_id = c.id AND pp.fecha_fin IS NULL
  LEFT JOIN propietario pr ON pr.id = pp.propietario_id
  WHERE avs.vet_id = auth.uid() AND avs.activo = true AND c.activo = true

  ORDER BY 2;
$$;


ALTER FUNCTION "public"."get_caballos_veterinario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_configuracion_cria_efectiva"("p_veterinario_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row public.cria_plazo_vet%ROWTYPE;
  v_personalizada boolean := false;
  v_origen text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesion no autenticada';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_veterinario_id
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT *
    INTO v_row
  FROM public.cria_plazo_vet
  WHERE veterinario_id = p_veterinario_id;

  v_personalizada := FOUND;
  v_origen := CASE WHEN v_personalizada THEN 'veterinario' ELSE 'sistema' END;

  RETURN jsonb_build_object(
    'donante_strelin_a_in', jsonb_build_object(
      'valor', COALESCE(v_row.donante_strelin_a_in, 1), 'default', 1,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_in_a_oxi', jsonb_build_object(
      'valor', COALESCE(v_row.donante_in_a_oxi, 1), 'default', 1,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_ov_a_flushing', jsonb_build_object(
      'valor', COALESCE(v_row.donante_ov_a_flushing, 6), 'default', 6,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_ov_sin_in_a_dar_pg', jsonb_build_object(
      'valor', COALESCE(v_row.donante_ov_sin_in_a_dar_pg, 4), 'default', 4,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_pg_a_revision_pg', jsonb_build_object(
      'valor', COALESCE(v_row.donante_pg_a_revision_pg, 3), 'default', 3,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_flushing_a_revision', jsonb_build_object(
      'valor', COALESCE(v_row.donante_flushing_a_revision, 4), 'default', 4,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_flushing_aplica_pg', jsonb_build_object(
      'valor', COALESCE(v_row.donante_flushing_aplica_pg, true), 'default', true,
      'origen', v_origen),
    'receptora_pg_a_revision_pg', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_pg_a_revision_pg, 4), 'default', 4,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'receptora_ov_a_dar_pg', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_ov_a_dar_pg, 3), 'default', 3,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'receptora_transf_a_eco1', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_transf_a_eco1, 30), 'default', 30,
      'origen', v_origen, 'min', 1, 'max', 365, 'unidad', 'dias'),
    'receptora_transf_a_eco2', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_transf_a_eco2, 60), 'default', 60,
      'origen', v_origen, 'min', 1, 'max', 365, 'unidad', 'dias'),
    'receptora_transf_a_eco3', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_transf_a_eco3, 90), 'default', 90,
      'origen', v_origen, 'min', 1, 'max', 365, 'unidad', 'dias'),
    'donante_oxi_a_revision', jsonb_build_object(
      'valor', 1, 'default', 1, 'origen', 'sistema',
      'min', 1, 'max', 30, 'unidad', 'dias'),
    'ventana_inseminacion_dias', jsonb_build_object(
      'valor', 7, 'default', 7, 'origen', 'sistema',
      'min', 1, 'max', 30, 'unidad', 'dias'),
    'strelin_dias_semana', jsonb_build_object(
      'valor', to_jsonb(ARRAY[1, 3, 5]), 'default', to_jsonb(ARRAY[1, 3, 5]),
      'origen', 'sistema', 'unidad', 'dias_iso')
  );
END;
$$;


ALTER FUNCTION "public"."get_configuracion_cria_efectiva"("p_veterinario_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_configuracion_cria_efectiva"("p_veterinario_id" "uuid") IS 'Configuracion reproductiva efectiva del veterinario, con defaults, origen y rangos para la UI.';



CREATE OR REPLACE FUNCTION "public"."get_consultas_recientes_vet"("p_limit" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "fecha_consulta" "date", "proxima_consulta" "date", "caballo_id" "uuid", "caballo_nombre" "text", "tipo" "text", "diagnostico" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT hc.id, hc.fecha_consulta::date, hc.proxima_consulta,
         hc.caballo_id, c.nombre::text AS caballo_nombre,
         ct.nombre::text AS tipo, hc.diagnostico
    FROM historial_clinico hc
    JOIN caballo c ON c.id = hc.caballo_id
    LEFT JOIN cat_tipo_consulta ct ON ct.id = hc.tipo_consulta_id
   WHERE hc.creado_por = auth.uid()
     AND hc.anulada_at IS NULL
   ORDER BY hc.fecha_consulta DESC
   LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_consultas_recientes_vet"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"("p_sociedad_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total int; v_sin_campo int; v_sin_chip int; v_por_cat jsonb;
BEGIN
  IF NOT tiene_membresia(p_sociedad_id) THEN
    RAISE EXCEPTION 'Sin acceso a esta sociedad';
  END IF;
  SELECT count(*),
         count(*) FILTER (WHERE campo_id IS NULL),
         count(*) FILTER (WHERE numero_chip IS NULL OR numero_chip = '')
  INTO v_total, v_sin_campo, v_sin_chip
  FROM caballo WHERE sociedad_id = p_sociedad_id AND activo = true;

  SELECT jsonb_object_agg(categoria, cnt) INTO v_por_cat
  FROM (SELECT categoria, count(*) cnt FROM caballo
        WHERE sociedad_id = p_sociedad_id AND activo = true GROUP BY categoria) sub;

  RETURN jsonb_build_object(
    'total', v_total, 'sinCampo', v_sin_campo,
    'sinChip', v_sin_chip, 'porCategoria', COALESCE(v_por_cat, '{}'::jsonb));
END;
$$;


ALTER FUNCTION "public"."get_dashboard_stats"("p_sociedad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_empresas_visibles"() RETURNS TABLE("id" "uuid", "nombre" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT s.id, s.nombre::TEXT
    FROM sociedad s
   WHERE s.activa
     AND (
       tiene_membresia(s.id)
       OR EXISTS (
         SELECT 1
           FROM acceso_vet av
           JOIN caballo c ON c.id = av.caballo_id
          WHERE av.vet_id = auth.uid()
            AND av.activo
            AND c.sociedad_id = s.id
       )
       OR EXISTS (
         SELECT 1
           FROM acceso_vet_sociedad avs
          WHERE avs.vet_id = auth.uid()
            AND avs.activo
            AND avs.sociedad_id = s.id
       )
     )
   ORDER BY s.nombre;
$$;


ALTER FUNCTION "public"."get_empresas_visibles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mis_accesos_modulo"() RETURNS TABLE("modulo_codigo" "text", "org_habilitado" boolean, "usuario_habilitado" boolean)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rol          TEXT;
  v_sociedad_id  UUID;
  v_membresia_id UUID;
BEGIN
  SELECT rol INTO v_rol FROM usuario WHERE id = auth.uid();

  IF v_rol = 'veterinario' THEN
    RETURN QUERY
    SELECT cm.codigo, FALSE, COALESCE(um.habilitado, FALSE)
    FROM cat_modulo cm
    LEFT JOIN usuario_modulo um ON um.modulo_id = cm.id AND um.usuario_id = auth.uid()
    WHERE cm.activo;
    RETURN;
  END IF;

  SELECT m.id, m.sociedad_id INTO v_membresia_id, v_sociedad_id
  FROM membresia m
  WHERE m.usuario_id = auth.uid() AND m.activa = TRUE
  LIMIT 1;

  RETURN QUERY
  SELECT cm.codigo,
         COALESCE(sm.habilitado, FALSE),
         COALESCE(mm.habilitado, FALSE)
  FROM cat_modulo cm
  LEFT JOIN sociedad_modulo  sm ON sm.modulo_id = cm.id AND sm.sociedad_id  = v_sociedad_id
  LEFT JOIN membresia_modulo mm ON mm.modulo_id = cm.id AND mm.membresia_id = v_membresia_id
  WHERE cm.activo;
END;
$$;


ALTER FUNCTION "public"."get_mis_accesos_modulo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_padrillos_familiares"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) RETURNS TABLE("padrillo_id" "uuid", "parentesco" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH donante AS (
    SELECT a.caballo_id, a.nivel FROM ancestros_caballo(p_donante_id, 2) a
  ),
  candidatos AS (
    SELECT UNNEST(p_padrillo_ids) AS id
  ),
  cruce AS (
    SELECT
      c.id,
      MIN(CASE WHEN c.id = d.caballo_id      THEN d.nivel END)  AS nivel_es_ancestro,
      MIN(CASE WHEN p_donante_id = p.caballo_id THEN p.nivel END) AS nivel_es_desc,
      MIN(GREATEST(d.nivel, p.nivel))                            AS nivel_comun
    FROM candidatos c
    JOIN LATERAL ancestros_caballo(c.id, 2) p ON TRUE
    JOIN donante d ON d.caballo_id = p.caballo_id
    GROUP BY c.id
  )
  SELECT
    cruce.id,
    CASE
      WHEN cruce.nivel_es_ancestro = 1 THEN 'Padre'
      WHEN cruce.nivel_es_ancestro = 2 THEN 'Abuelo'
      WHEN cruce.nivel_es_desc     = 1 THEN 'Hijo'
      WHEN cruce.nivel_es_desc     = 2 THEN 'Nieto'
      WHEN cruce.nivel_comun       = 1 THEN 'Hermano'
      ELSE 'Familiar'
    END
  FROM cruce
  WHERE cruce.id <> p_donante_id;
END;
$$;


ALTER FUNCTION "public"."get_padrillos_familiares"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sociedades_activas"() RETURNS TABLE("id" "uuid", "nombre" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT id, nombre FROM sociedad WHERE activa = true ORDER BY nombre;
  $$;


ALTER FUNCTION "public"."get_sociedades_activas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_veterinarios_plataforma"() RETURNS TABLE("id" "uuid", "nombre" "text", "apellido" "text", "email" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$                    
    SELECT id, nombre, apellido, email         
    FROM usuario                               
    WHERE rol = 'veterinario' AND activo = true
    ORDER BY apellido, nombre;                 
  $$;


ALTER FUNCTION "public"."get_veterinarios_plataforma"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_asignaciones_torneo"("p_torneo_id" "uuid", "p_jugador_id" "uuid", "p_caballo_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sociedad_id UUID;
  v_estado TEXT;
  v_ids UUID[] := COALESCE(p_caballo_ids, '{}'::UUID[]);
  v_tag_jugador INTEGER;
  v_invalido TEXT;
BEGIN
  SELECT sociedad_id, estado INTO v_sociedad_id, v_estado
  FROM torneo WHERE id = p_torneo_id;

  IF v_sociedad_id IS NULL THEN
    RAISE EXCEPTION 'El torneo no existe.';
  END IF;

  IF NOT (is_superadmin() OR puede_gestionar_polo(v_sociedad_id)) THEN
    RAISE EXCEPTION 'Solo un administrador o piloto puede asignar caballos del torneo.';
  END IF;

  IF v_estado <> 'activo' THEN
    RAISE EXCEPTION 'El torneo está %; no admite cambios de asignación.', v_estado;
  END IF;

  IF p_jugador_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM torneo_jugador
    WHERE id = p_jugador_id AND torneo_id = p_torneo_id
  ) THEN
    RAISE EXCEPTION 'El jugador no pertenece a este torneo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM UNNEST(v_ids) AS t(id) GROUP BY t.id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'La lista no puede repetir el mismo caballo.';
  END IF;

  SELECT id INTO v_tag_jugador FROM cat_tag WHERE nombre = 'Jugador';

  SELECT c.nombre INTO v_invalido
  FROM UNNEST(v_ids) AS t(id)
  JOIN caballo c ON c.id = t.id
  WHERE c.sociedad_id IS DISTINCT FROM v_sociedad_id
     OR c.activo IS NOT TRUE
     OR (v_tag_jugador IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM caballo_tag ct
          WHERE ct.caballo_id = c.id AND ct.tag_id = v_tag_jugador
        ))
  LIMIT 1;

  IF v_invalido IS NOT NULL THEN
    RAISE EXCEPTION 'El caballo % no está disponible para este torneo.', v_invalido;
  END IF;

  IF array_length(v_ids, 1) IS NOT NULL AND EXISTS (
    SELECT 1 FROM UNNEST(v_ids) AS t(id)
    LEFT JOIN caballo c ON c.id = t.id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Alguno de los caballos no existe.';
  END IF;

  DELETE FROM torneo_asignacion
  WHERE torneo_id = p_torneo_id AND caballo_id = ANY(v_ids);

  IF p_jugador_id IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM torneo_asignacion
  WHERE torneo_id = p_torneo_id AND jugador_id = p_jugador_id;

  INSERT INTO torneo_asignacion (torneo_id, jugador_id, caballo_id, orden)
  SELECT p_torneo_id, p_jugador_id, t.id, t.orden
  FROM UNNEST(v_ids) WITH ORDINALITY AS t(id, orden);

  RETURN COALESCE(array_length(v_ids, 1), 0);
END;
$$;


ALTER FUNCTION "public"."guardar_asignaciones_torneo"("p_torneo_id" "uuid", "p_jugador_id" "uuid", "p_caballo_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_ranking_padrillos"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sociedad_id UUID;
  v_es_vet      BOOLEAN;
  v_ids         UUID[] := COALESCE(p_padrillo_ids, '{}'::UUID[]);
  v_padrillo_id UUID;
BEGIN
  SELECT sociedad_id INTO v_sociedad_id FROM caballo WHERE id = p_donante_id;
  IF v_sociedad_id IS NULL THEN
    RAISE EXCEPTION 'La donante no existe o no pertenece a un establecimiento.';
  END IF;

  v_es_vet := vet_tiene_acceso(p_donante_id);
  IF NOT (is_superadmin() OR es_admin(v_sociedad_id) OR v_es_vet) THEN
    RAISE EXCEPTION 'Sin permiso para configurar el ranking de esta donante.';
  END IF;

  IF array_length(v_ids, 1) > 10 THEN
    RAISE EXCEPTION 'El ranking admite como máximo 10 padrillos.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM UNNEST(v_ids) AS t(id) GROUP BY t.id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'El ranking no puede repetir el mismo padrillo.';
  END IF;

  IF v_es_vet AND NOT (is_superadmin() OR es_admin(v_sociedad_id)) THEN
    FOREACH v_padrillo_id IN ARRAY v_ids LOOP
      IF NOT vet_tiene_acceso(v_padrillo_id) THEN
        RAISE EXCEPTION 'No tenés acceso a alguno de los padrillos seleccionados.';
      END IF;
    END LOOP;
  END IF;

  DELETE FROM cria_padrillo_preferido WHERE donante_id = p_donante_id;

  INSERT INTO cria_padrillo_preferido (sociedad_id, donante_id, padrillo_id, prioridad, creado_por)
  SELECT v_sociedad_id, p_donante_id, t.id, t.orden, auth.uid()
  FROM UNNEST(v_ids) WITH ORDINALITY AS t(id, orden);

  RETURN COALESCE(array_length(v_ids, 1), 0);
END;
$$;


ALTER FUNCTION "public"."guardar_ranking_padrillos"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rol_solicitado text := NEW.raw_user_meta_data->>'rol_solicitado';
  v_dni            text := NULLIF(TRIM(NEW.raw_user_meta_data->>'dni'), '');
  v_matricula      text := NULLIF(TRIM(NEW.raw_user_meta_data->>'matricula'), '');
BEGIN
  IF v_rol_solicitado = 'veterinario' AND v_dni IS NULL THEN
    RAISE EXCEPTION 'El DNI es obligatorio para registrarse como veterinario.'
      USING ERRCODE = 'HM003';
  END IF;

  INSERT INTO public.usuario (id, nombre, apellido, email, rol, dni, matricula)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre',   'Sin nombre'),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.email,
    CASE WHEN v_rol_solicitado = 'veterinario' THEN 'veterinario' ELSE 'admin' END,
    v_dni,
    v_matricula
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_rol_solicitado = 'veterinario' THEN
    INSERT INTO public.suscripcion_veterinario (usuario_id, estado)
    VALUES (NEW.id, 'inactiva')
    ON CONFLICT (usuario_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
       SELECT EXISTS (
         SELECT 1 FROM usuario
         WHERE id = auth.uid() AND rol = 'superadmin'
       );
     $$;


ALTER FUNCTION "public"."is_superadmin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mp_registrar_pago"("p_preapproval_id" "text", "p_payment_id" "text", "p_estado" "text", "p_monto" numeric, "p_moneda" "text", "p_fecha" timestamp with time zone, "p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_suscripcion suscripcion_veterinario%ROWTYPE;
BEGIN
  SELECT * INTO v_suscripcion
    FROM suscripcion_veterinario
   WHERE external_subscription_id = p_preapproval_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay suscripción con preapproval %', p_preapproval_id;
  END IF;

  INSERT INTO pago_veterinario (
    usuario_id, suscripcion_id, proveedor, external_payment_id,
    external_preapproval_id, estado, monto, moneda, fecha_pago, payload
  )
  VALUES (
    v_suscripcion.usuario_id, v_suscripcion.id, 'mercadopago', p_payment_id,
    p_preapproval_id, p_estado, p_monto, p_moneda, p_fecha, p_payload
  )
  ON CONFLICT (proveedor, external_payment_id) DO UPDATE SET
    estado     = EXCLUDED.estado,
    monto      = EXCLUDED.monto,
    moneda     = EXCLUDED.moneda,
    fecha_pago = EXCLUDED.fecha_pago,
    payload    = EXCLUDED.payload;
END;
$$;


ALTER FUNCTION "public"."mp_registrar_pago"("p_preapproval_id" "text", "p_payment_id" "text", "p_estado" "text", "p_monto" numeric, "p_moneda" "text", "p_fecha" timestamp with time zone, "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mp_registrar_preapproval"("p_usuario_id" "uuid", "p_preapproval_id" "text", "p_plan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO suscripcion_veterinario (
    usuario_id, estado, proveedor_pago, external_subscription_id, plan_id
  )
  VALUES (
    p_usuario_id, 'pendiente', 'mercadopago', p_preapproval_id, p_plan_id
  )
  ON CONFLICT (usuario_id) DO UPDATE SET
    estado = CASE
      WHEN suscripcion_veterinario.estado = 'activa' THEN suscripcion_veterinario.estado
      ELSE 'pendiente'
    END,
    proveedor_pago           = 'mercadopago',
    external_subscription_id = p_preapproval_id,
    plan_id                  = p_plan_id,
    fecha_cancelacion        = NULL;
END;
$$;


ALTER FUNCTION "public"."mp_registrar_preapproval"("p_usuario_id" "uuid", "p_preapproval_id" "text", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mp_sincronizar_suscripcion"("p_preapproval_id" "text", "p_status" "text", "p_next_payment_date" timestamp with time zone, "p_payload" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_estado TEXT;
BEGIN
  v_estado := CASE p_status
    WHEN 'pending'    THEN 'pendiente'
    WHEN 'authorized' THEN 'activa'
    WHEN 'paused'     THEN 'inactiva'
    WHEN 'cancelled'  THEN 'cancelada'
    WHEN 'canceled'   THEN 'cancelada'
    ELSE NULL
  END;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Estado de MercadoPago desconocido: %', p_status;
  END IF;

  UPDATE suscripcion_veterinario SET
    estado = v_estado,
    fecha_activacion = CASE
      WHEN v_estado = 'activa' THEN COALESCE(fecha_activacion, NOW())
      ELSE fecha_activacion
    END,
    fecha_vencimiento = CASE
      WHEN v_estado = 'activa'
        THEN COALESCE(p_next_payment_date + INTERVAL '3 days', NOW() + INTERVAL '1 month')
      ELSE fecha_vencimiento
    END,
    fecha_cancelacion = CASE
      WHEN v_estado = 'cancelada' THEN COALESCE(fecha_cancelacion, NOW())
      ELSE NULL
    END,
    proveedor_pago = 'mercadopago',
    notas = COALESCE(p_payload ->> 'reason', notas)
  WHERE external_subscription_id = p_preapproval_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay suscripción con preapproval %', p_preapproval_id;
  END IF;

  RETURN v_estado;
END;
$$;


ALTER FUNCTION "public"."mp_sincronizar_suscripcion"("p_preapproval_id" "text", "p_status" "text", "p_next_payment_date" timestamp with time zone, "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."puede_gestionar_campo"("p_sociedad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
      SELECT 1
      FROM membresia m
      JOIN cat_rol r ON r.id = m.rol_id
      WHERE m.usuario_id  = auth.uid()
        AND m.sociedad_id = p_sociedad_id
        AND m.activa      = TRUE
        AND r.nombre IN ('admin', 'jugador', 'piloto', 'peticero')
    );
  $$;


ALTER FUNCTION "public"."puede_gestionar_campo"("p_sociedad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."puede_gestionar_ficha_caballo"("p_sociedad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membresia m
    JOIN cat_rol r ON r.id = m.rol_id
    WHERE m.usuario_id = (SELECT auth.uid())
      AND m.sociedad_id = p_sociedad_id
      AND m.activa = TRUE
      AND r.nombre IN ('admin', 'piloto')
  );
$$;


ALTER FUNCTION "public"."puede_gestionar_ficha_caballo"("p_sociedad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."puede_gestionar_polo"("p_sociedad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membresia m
    JOIN cat_rol r ON r.id = m.rol_id
    WHERE m.usuario_id = (SELECT auth.uid())
      AND m.sociedad_id = p_sociedad_id
      AND m.activa = TRUE
      AND r.nombre IN ('admin', 'piloto')
  );
$$;


ALTER FUNCTION "public"."puede_gestionar_polo"("p_sociedad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reactivar_caballos_veterinario"("p_caballo_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE
    v_afectados       INTEGER;
    v_cupo            INTEGER;
    v_pedidos_propios INTEGER;
    v_limite          INTEGER;
  BEGIN
    IF p_caballo_ids IS NULL OR array_length(p_caballo_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No seleccionaste ningún caballo para reactivar.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('vet_limite_caballos'), hashtext(auth.uid()::text));

    PERFORM _vet_valida_propios(p_caballo_ids, FALSE);

    -- El cupo solo rige sobre los caballos PROPIOS incluidos en el lote; uno
    -- de una sociedad a la que el vet tiene acceso no lo consume.
    SELECT COUNT(DISTINCT c.id)::INTEGER INTO v_pedidos_propios
    FROM unnest(p_caballo_ids) AS t(id)
    JOIN caballo c ON c.id = t.id
    WHERE c.vet_owner_id = auth.uid() AND c.sociedad_id IS NULL;

    v_limite := vet_limite_aplicable(auth.uid());
    v_cupo   := GREATEST(v_limite - vet_caballos_propios(auth.uid()), 0);

    IF v_pedidos_propios > v_cupo THEN
      IF vet_suscripcion_activa(auth.uid()) THEN
        RAISE EXCEPTION
          'Tu membresía permite hasta % caballos propios, así que de los tuyos en esta selección solo podés reactivar % más. Elegiste % propios.',
          v_limite, v_cupo, v_pedidos_propios;
      ELSE
        RAISE EXCEPTION
          'Sin una membresía activa, de los tuyos en esta selección solo podés reactivar % más. Elegiste % propios.',
          v_cupo, v_pedidos_propios;
      END IF;
    END IF;

    UPDATE caballo
       SET activo = TRUE
     WHERE id = ANY(p_caballo_ids)
       AND (
         (vet_owner_id = auth.uid() AND sociedad_id IS NULL)
         OR vet_tiene_acceso(id)
       );

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RETURN v_afectados;
  END;
$$;


ALTER FUNCTION "public"."reactivar_caballos_veterinario"("p_caballo_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_acto_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_fecha" "date", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_utero" "text"[], "p_obs_chips" "text"[], "p_observaciones" "text", "p_veterinario_id" "uuid", "p_rol_reproductivo" "text", "p_padrillo_id" "uuid" DEFAULT NULL::"uuid", "p_ov_dias" smallint DEFAULT NULL::smallint, "p_review_dias" smallint DEFAULT NULL::smallint, "p_review_desc" "text" DEFAULT NULL::"text", "p_fecha_flushing_programada" "date" DEFAULT NULL::"date", "p_motivo" "text" DEFAULT NULL::"text", "p_diagnostico" "text" DEFAULT NULL::"text", "p_tratamiento" "text" DEFAULT NULL::"text", "p_origen_recordatorio_id" "uuid" DEFAULT NULL::"uuid", "p_ajustes_fin_semana" "jsonb" DEFAULT '{}'::"jsonb", "p_dias_revision_1pg" smallint DEFAULT NULL::smallint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_registro_id uuid;
  v_cfg jsonb;
  v_caballo public.caballo%ROWTYPE;
  v_tiene_ov boolean;
  v_inseminada boolean;
  v_fecha_vto date;
  v_tipo_existente boolean;
  v_regla record;
  v_ajuste record;
  v_afectados uuid[] := ARRAY[]::uuid[];
  v_ids uuid[];
  v_recordatorio_id uuid;
  v_registro jsonb;
  v_recordatorios jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesion no autenticada';
  END IF;

  IF v_uid IS DISTINCT FROM p_veterinario_id
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'No autorizado para registrar por otro veterinario';
  END IF;

  IF p_rol_reproductivo NOT IN ('Donante', 'Receptora') THEN
    RAISE EXCEPTION 'Rol reproductivo invalido';
  END IF;

  IF p_review_dias IS NOT NULL AND p_review_dias NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Los dias de revision deben estar entre 1 y 60';
  END IF;

  IF p_dias_revision_1pg IS NOT NULL AND p_dias_revision_1pg NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Los dias de revision de la 1PG deben estar entre 1 y 60';
  END IF;

  IF '1PG' = ANY(COALESCE(p_obs_chips, '{}')) AND p_dias_revision_1pg IS NULL THEN
    RAISE EXCEPTION 'Indica en cuantos dias revisar la 1PG';
  END IF;

  FOR v_ajuste IN SELECT key, value FROM jsonb_each_text(COALESCE(p_ajustes_fin_semana, '{}'::jsonb))
  LOOP
    IF v_ajuste.value::integer NOT BETWEEN -1 AND 1 THEN
      RAISE EXCEPTION 'Ajuste de fin de semana invalido para %', v_ajuste.key;
    END IF;
  END LOOP;

  SELECT * INTO v_caballo
  FROM public.caballo
  WHERE id = p_caballo_id
  FOR SHARE;

  IF NOT FOUND OR v_caballo.sociedad_id IS DISTINCT FROM p_sociedad_id THEN
    RAISE EXCEPTION 'Caballo inexistente o no pertenece a la sociedad';
  END IF;

  IF NOT public.is_superadmin() AND NOT public.vet_tiene_acceso(p_caballo_id) THEN
    RAISE EXCEPTION 'Sin acceso veterinario al caballo';
  END IF;

  IF v_caballo.rol_reproductivo IS NOT NULL
     AND v_caballo.rol_reproductivo IS DISTINCT FROM p_rol_reproductivo THEN
    RAISE EXCEPTION 'El rol reproductivo no coincide con el caballo';
  END IF;

  v_cfg := public.get_configuracion_cria_efectiva(p_veterinario_id);

  INSERT INTO public.cria_registro_clinico (
    caballo_id, sociedad_id, fecha, veterinario_id,
    ovario_izq, ovario_der, utero, obs_chips, padrillo_id, ov_dias,
    review_dias, review_desc, fecha_flushing_programada,
    motivo, diagnostico, tratamiento, observaciones,
    origen_recordatorio_id
  ) VALUES (
    p_caballo_id, p_sociedad_id, p_fecha, p_veterinario_id,
    COALESCE(p_ovario_izq, '{}'), COALESCE(p_ovario_der, '{}'),
    COALESCE(p_utero, '{}'), COALESCE(p_obs_chips, '{}'), p_padrillo_id, p_ov_dias,
    p_review_dias, p_review_desc, p_fecha_flushing_programada,
    p_motivo, p_diagnostico, p_tratamiento, p_observaciones,
    p_origen_recordatorio_id
  )
  RETURNING id INTO v_registro_id;

  WITH actualizados AS (
    UPDATE public.cria_recordatorio
    SET estado = 'hecho', updated_at = now()
    WHERE caballo_id = p_caballo_id
      AND fecha_vto = p_fecha
      AND estado IN ('pendiente', 'vencido')
      AND (
        tipo = 'Revisión'
        OR (tipo LIKE 'Revisión %' AND tipo <> 'Revisión Eco')
        OR (tipo = 'Dar PG' AND (ARRAY['PG', '1PG']::text[] && COALESCE(p_obs_chips, '{}')))
        OR tipo = ANY(COALESCE(p_obs_chips, '{}'))
      )
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM actualizados;
  v_afectados := v_afectados || v_ids;

  v_tiene_ov := 'OV' = ANY(COALESCE(p_ovario_izq, '{}'))
             OR 'OV' = ANY(COALESCE(p_ovario_der, '{}'));
  v_inseminada := 'IN' = ANY(COALESCE(p_obs_chips, '{}'));

  IF NOT v_inseminada AND p_rol_reproductivo = 'Donante' AND v_tiene_ov THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.cria_registro_clinico
      WHERE caballo_id = p_caballo_id
        AND id <> v_registro_id
        AND fecha BETWEEN
          (p_fecha - ((v_cfg->'ventana_inseminacion_dias'->>'valor')::integer))
          AND p_fecha
        AND 'IN' = ANY(obs_chips)
    ) INTO v_inseminada;
  END IF;

  IF p_review_dias IS NOT NULL THEN
    WITH cancelados AS (
      UPDATE public.cria_recordatorio
      SET estado = 'cancelado',
          cancel_motivo = 'Reemplazada por la revisión programada en un registro más nuevo',
          updated_at = now()
      WHERE caballo_id = p_caballo_id
        AND tipo = 'Revisión'
        AND estado IN ('pendiente', 'vencido')
      RETURNING id
    )
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM cancelados;
    v_afectados := v_afectados || v_ids;
  END IF;

  IF p_rol_reproductivo = 'Donante' THEN
    IF 'Strelin' = ANY(COALESCE(p_obs_chips, '{}'))
       AND NOT ('IN' = ANY(COALESCE(p_obs_chips, '{}'))) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_strelin_a_in'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'IN')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'IN', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF 'IN' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_in_a_oxi'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'OXI')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'OXI', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF 'OXI' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_oxi_a_revision'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Revisión')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF v_tiene_ov THEN
      IF v_inseminada THEN
        v_fecha_vto := COALESCE(
          p_fecha_flushing_programada,
          p_fecha + ((v_cfg->'donante_ov_a_flushing'->>'valor')::integer)
        ) + COALESCE((p_ajustes_fin_semana->>'Flushing')::integer, 0);
        INSERT INTO public.cria_recordatorio
          (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
        VALUES (p_caballo_id, p_sociedad_id, 'Flushing', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
        RETURNING id INTO v_recordatorio_id;
        v_afectados := array_append(v_afectados, v_recordatorio_id);
      ELSE
        v_fecha_vto := p_fecha + ((v_cfg->'donante_ov_sin_in_a_dar_pg'->>'valor')::integer)
          + COALESCE((p_ajustes_fin_semana->>'Dar PG')::integer, 0);
        INSERT INTO public.cria_recordatorio
          (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
        VALUES (p_caballo_id, p_sociedad_id, 'Dar PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
        RETURNING id INTO v_recordatorio_id;
        v_afectados := array_append(v_afectados, v_recordatorio_id);
      END IF;
    END IF;

    IF 'PG' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_pg_a_revision_pg'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Revisión PG')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF '1PG' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + p_dias_revision_1pg
        + COALESCE((p_ajustes_fin_semana->>'Revisión 1PG')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión 1PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF 'Flushing' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'donante_flushing_a_revision'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Revisión Flushing')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión Flushing', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;
  END IF;

  IF p_rol_reproductivo = 'Receptora' THEN
    IF 'Strelin' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + 1;
      WHILE EXTRACT(ISODOW FROM v_fecha_vto)::integer NOT IN (1, 3, 5) LOOP
        v_fecha_vto := v_fecha_vto + 1;
      END LOOP;
      v_fecha_vto := v_fecha_vto + COALESCE((p_ajustes_fin_semana->>'Revisión Strelin')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión Strelin', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF 'PG' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'receptora_pg_a_revision_pg'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Revisión PG')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF '1PG' = ANY(COALESCE(p_obs_chips, '{}')) THEN
      v_fecha_vto := p_fecha + p_dias_revision_1pg
        + COALESCE((p_ajustes_fin_semana->>'Revisión 1PG')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Revisión 1PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;

    IF v_tiene_ov AND NOT ('Transferida' = ANY(COALESCE(p_obs_chips, '{}'))) THEN
      v_fecha_vto := p_fecha + ((v_cfg->'receptora_ov_a_dar_pg'->>'valor')::integer)
        + COALESCE((p_ajustes_fin_semana->>'Dar PG')::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, 'Dar PG', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;
  END IF;

  FOR v_regla IN
    SELECT accion_recordatorio, dias
    FROM public.cria_regla_recordatorio
    WHERE veterinario_id = p_veterinario_id
      AND (rol = 'Ambas' OR rol = p_rol_reproductivo)
      AND accion_disparadora = ANY(COALESCE(p_obs_chips, '{}'))
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.cria_recordatorio
      WHERE origen_registro_id = v_registro_id
        AND tipo = v_regla.accion_recordatorio
    ) INTO v_tipo_existente;

    IF NOT v_tipo_existente THEN
      v_fecha_vto := p_fecha + v_regla.dias
        + COALESCE((p_ajustes_fin_semana->>v_regla.accion_recordatorio)::integer, 0);
      INSERT INTO public.cria_recordatorio
        (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
      VALUES (p_caballo_id, p_sociedad_id, v_regla.accion_recordatorio, v_fecha_vto,
              'pendiente', p_veterinario_id, true, v_registro_id)
      RETURNING id INTO v_recordatorio_id;
      v_afectados := array_append(v_afectados, v_recordatorio_id);
    END IF;
  END LOOP;

  IF p_review_dias IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cria_recordatorio
    WHERE origen_registro_id = v_registro_id AND tipo = 'Revisión'
  ) THEN
    v_fecha_vto := p_fecha + p_review_dias
      + COALESCE((p_ajustes_fin_semana->>'Revisión')::integer, 0);
    INSERT INTO public.cria_recordatorio
      (caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id, auto_generado, origen_registro_id)
    VALUES (p_caballo_id, p_sociedad_id, 'Revisión', v_fecha_vto, 'pendiente', p_veterinario_id, true, v_registro_id)
    RETURNING id INTO v_recordatorio_id;
    v_afectados := array_append(v_afectados, v_recordatorio_id);
  END IF;

  SELECT to_jsonb(r)
         || jsonb_build_object(
              'caballo', jsonb_build_object('nombre', c.nombre, 'rol_reproductivo', c.rol_reproductivo),
              'veterinario', jsonb_build_object('nombre', u.nombre, 'apellido', u.apellido),
              'padrillo', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('nombre', p.nombre) END
            )
    INTO v_registro
  FROM public.cria_registro_clinico r
  JOIN public.caballo c ON c.id = r.caballo_id
  LEFT JOIN public.usuario u ON u.id = r.veterinario_id
  LEFT JOIN public.caballo p ON p.id = r.padrillo_id
  WHERE r.id = v_registro_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(rec) ORDER BY rec.created_at), '[]'::jsonb)
    INTO v_recordatorios
  FROM public.cria_recordatorio rec
  WHERE rec.id = ANY(v_afectados);

  RETURN jsonb_build_object(
    'registro', v_registro,
    'recordatorios', v_recordatorios
  );
END;
$$;


ALTER FUNCTION "public"."registrar_acto_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_fecha" "date", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_utero" "text"[], "p_obs_chips" "text"[], "p_observaciones" "text", "p_veterinario_id" "uuid", "p_rol_reproductivo" "text", "p_padrillo_id" "uuid", "p_ov_dias" smallint, "p_review_dias" smallint, "p_review_desc" "text", "p_fecha_flushing_programada" "date", "p_motivo" "text", "p_diagnostico" "text", "p_tratamiento" "text", "p_origen_recordatorio_id" "uuid", "p_ajustes_fin_semana" "jsonb", "p_dias_revision_1pg" smallint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."registrar_acto_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_fecha" "date", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_utero" "text"[], "p_obs_chips" "text"[], "p_observaciones" "text", "p_veterinario_id" "uuid", "p_rol_reproductivo" "text", "p_padrillo_id" "uuid", "p_ov_dias" smallint, "p_review_dias" smallint, "p_review_desc" "text", "p_fecha_flushing_programada" "date", "p_motivo" "text", "p_diagnostico" "text", "p_tratamiento" "text", "p_origen_recordatorio_id" "uuid", "p_ajustes_fin_semana" "jsonb", "p_dias_revision_1pg" smallint) IS 'Registra un acto reproductivo y actualiza/genera sus recordatorios atomicamente. PG genera Revision PG con el plazo del veterinario; 1PG genera Revision 1PG a los dias indicados.';



CREATE OR REPLACE FUNCTION "public"."registrar_resultado_ecografia"("p_transferencia_id" "uuid", "p_numero" smallint, "p_fecha" "date", "p_resultado" "text", "p_ovario_izq" "text"[] DEFAULT '{}'::"text"[], "p_ovario_der" "text"[] DEFAULT '{}'::"text"[], "p_notas" "text" DEFAULT NULL::"text", "p_origen_recordatorio_id" "uuid" DEFAULT NULL::"uuid", "p_revision_dias" smallint DEFAULT NULL::smallint) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_uid uuid:=auth.uid(); v_t cria_transferencia%ROWTYPE; v_id uuid;
  v_revision smallint; v_eco2 smallint; v_eco3 smallint;
  v_dias_pg smallint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no autenticada'; END IF;
  IF p_numero NOT BETWEEN 1 AND 3 OR p_resultado NOT IN ('prenada','volver_a_ver','vacia','vacia_resincronizar')
    THEN RAISE EXCEPTION 'Resultado de ECO inválido'; END IF;
  IF p_resultado='volver_a_ver' AND (p_revision_dias IS NULL OR p_revision_dias NOT BETWEEN 1 AND 120)
    THEN RAISE EXCEPTION 'Indicá entre 1 y 120 días para volver a ver'; END IF;
  SELECT * INTO v_t FROM cria_transferencia WHERE id=p_transferencia_id FOR UPDATE;
  IF NOT FOUND OR NOT vet_tiene_acceso(v_t.caballo_receptora_id) THEN
    RAISE EXCEPTION 'Transferencia inexistente o sin acceso'; END IF;
  IF NOT _cria_transferencia_vigente(v_t.id) THEN RAISE EXCEPTION 'La transferencia ya no está vigente'; END IF;
  SELECT COALESCE(max(revision),0)+1 INTO v_revision FROM cria_ecografia
    WHERE transferencia_id=v_t.id AND numero=p_numero;
  INSERT INTO cria_ecografia(sociedad_id,transferencia_id,caballo_receptora_id,veterinario_id,
    numero,revision,fecha,resultado,ovario_izq,ovario_der,notas,origen_recordatorio_id)
  VALUES(v_t.sociedad_id,v_t.id,v_t.caballo_receptora_id,v_uid,p_numero,v_revision,p_fecha,p_resultado,
    p_ovario_izq,p_ovario_der,p_notas,p_origen_recordatorio_id) RETURNING id INTO v_id;
  UPDATE cria_recordatorio SET estado='hecho',updated_at=now()
    WHERE id=p_origen_recordatorio_id AND estado IN ('pendiente','vencido');
  INSERT INTO cria_evento_reproductivo(sociedad_id,caballo_id,transferencia_id,tipo,datos,creado_por)
  VALUES(v_t.sociedad_id,v_t.caballo_receptora_id,v_t.id,'ecografia',
    jsonb_build_object('eco',p_numero,'revision',v_revision,'fecha',p_fecha,'resultado',p_resultado),v_uid);
  IF p_resultado='prenada' THEN
    UPDATE cria_seguimiento_gestacion SET estado='prenada',eco_actual=LEAST(p_numero+1,3),updated_at=now()
      WHERE transferencia_id=v_t.id;
    SELECT receptora_transf_a_eco2,receptora_transf_a_eco3 INTO v_eco2,v_eco3 FROM cria_plazo_vet WHERE veterinario_id=v_uid;
    INSERT INTO cria_recordatorio(caballo_id,sociedad_id,tipo,fecha_vto,estado,veterinario_id,auto_generado,
      origen_registro_id,transferencia_id,eco_numero) VALUES
      (v_t.caballo_receptora_id,v_t.sociedad_id,'Eco 2',v_t.fecha+COALESCE(v_eco2,60),'pendiente',v_uid,true,v_t.registro_id,v_t.id,2),
      (v_t.caballo_receptora_id,v_t.sociedad_id,'Eco 3',v_t.fecha+COALESCE(v_eco3,90),'pendiente',v_uid,true,v_t.registro_id,v_t.id,3)
    ON CONFLICT DO NOTHING;
  ELSIF p_resultado='volver_a_ver' THEN
    UPDATE cria_seguimiento_gestacion SET estado='volver_a_ver',eco_actual=p_numero,updated_at=now() WHERE transferencia_id=v_t.id;
    INSERT INTO cria_recordatorio(caballo_id,sociedad_id,tipo,fecha_vto,estado,veterinario_id,auto_generado,
      origen_registro_id,transferencia_id,eco_numero,notas)
    VALUES(v_t.caballo_receptora_id,v_t.sociedad_id,'Revisión Eco',p_fecha+p_revision_dias,'pendiente',v_uid,true,
      v_t.registro_id,v_t.id,p_numero,format('Volver a ver ECO %s en %s días',p_numero,p_revision_dias));
    PERFORM _cria_cambiar_estado_reproductivo(v_t.caballo_receptora_id,v_t.sociedad_id,'pendiente_eco',
      format('ECO %s: volver a ver',p_numero),v_uid);
  ELSE
    -- vacía o vacía_resincronizar
    UPDATE cria_seguimiento_gestacion SET estado=p_resultado,finalizado_at=now(),updated_at=now() WHERE transferencia_id=v_t.id;
    UPDATE caballo SET prenada=false,fecha_prenez=NULL,updated_at=now() WHERE id=v_t.caballo_receptora_id;
    UPDATE cria_recordatorio SET estado='cancelado',cancel_motivo='Seguimiento finalizado',updated_at=now()
      WHERE transferencia_id=v_t.id AND estado IN ('pendiente','vencido');
    PERFORM _cria_cambiar_estado_reproductivo(v_t.caballo_receptora_id,v_t.sociedad_id,
      CASE WHEN p_resultado='vacia_resincronizar' THEN 'volviendo_sincronizar' ELSE 'vacia' END,
      format('ECO %s: %s',p_numero,p_resultado),v_uid);

    -- Resincronizar → agendar "Dar PG" para reiniciar ciclo de la receptora
    IF p_resultado = 'vacia_resincronizar' THEN
      -- Cancelar "Dar PG" pendientes previos de esta receptora (evitar duplicados)
      UPDATE cria_recordatorio SET estado='cancelado',cancel_motivo='Reemplazado por nueva resincronización',updated_at=now()
        WHERE caballo_id=v_t.caballo_receptora_id AND tipo='Dar PG' AND estado IN ('pendiente','vencido');

      SELECT receptora_ov_a_dar_pg INTO v_dias_pg FROM cria_plazo_vet WHERE veterinario_id=v_uid;
      INSERT INTO cria_recordatorio(caballo_id,sociedad_id,tipo,fecha_vto,estado,veterinario_id,
        notas,auto_generado)
      VALUES(v_t.caballo_receptora_id,v_t.sociedad_id,'Dar PG',
        p_fecha+COALESCE(v_dias_pg,3),'pendiente',v_uid,
        format('Resincronización tras ECO %s vacía',p_numero),true);
    END IF;
  END IF;
  RETURN v_id;
END $$;


ALTER FUNCTION "public"."registrar_resultado_ecografia"("p_transferencia_id" "uuid", "p_numero" smallint, "p_fecha" "date", "p_resultado" "text", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_notas" "text", "p_origen_recordatorio_id" "uuid", "p_revision_dias" smallint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_transferencia_embrionaria"("p_sociedad_id" "uuid", "p_fecha" "date", "p_caballo_receptora_id" "uuid", "p_caballo_donante_id" "uuid", "p_embrion_id" "uuid", "p_padrillo_id" "uuid" DEFAULT NULL::"uuid", "p_flushing_id" "uuid" DEFAULT NULL::"uuid", "p_ovario_izq" "text"[] DEFAULT '{}'::"text"[], "p_ovario_der" "text"[] DEFAULT '{}'::"text"[], "p_cl_calidad" "text" DEFAULT NULL::"text", "p_tono_uterino" "text" DEFAULT NULL::"text", "p_tono_cervical" "text" DEFAULT NULL::"text", "p_clasificacion" "text" DEFAULT NULL::"text", "p_notas" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_vet      uuid := auth.uid();
  v_estado   text;
  v_clasif   text;
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

  SELECT estado INTO v_estado
  FROM embrion
  WHERE id                 = p_embrion_id
    AND sociedad_id        = p_sociedad_id
    AND caballo_donante_id = p_caballo_donante_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El embrion no existe o no pertenece a esa donante';
  END IF;

  IF v_estado NOT IN ('disponible', 'congelado', 'en_nube') THEN
    RAISE EXCEPTION 'El embrion ya no esta disponible (estado actual: %)', v_estado;
  END IF;

  -- Auto-clasificar: si el frontend no mandó clasificacion, deducirla del estado previo
  v_clasif := COALESCE(
    NULLIF(p_clasificacion, ''),
    CASE WHEN v_estado IN ('congelado', 'en_nube') THEN 'Congelado' ELSE 'Fresco' END
  );

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
    p_cl_calidad, p_tono_uterino, p_tono_cervical, v_clasif, p_notas
  )
  RETURNING id INTO v_transf;

  UPDATE embrion
  SET estado = 'transferido', updated_at = now()
  WHERE id = p_embrion_id;

  UPDATE cria_recordatorio
  SET estado        = 'cancelado',
      cancel_motivo = 'Receptora transferida',
      updated_at    = now()
  WHERE caballo_id  = p_caballo_receptora_id
    AND sociedad_id = p_sociedad_id
    AND tipo        = 'Dar PG'
    AND estado      IN ('pendiente', 'vencido');

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


ALTER FUNCTION "public"."registrar_transferencia_embrionaria"("p_sociedad_id" "uuid", "p_fecha" "date", "p_caballo_receptora_id" "uuid", "p_caballo_donante_id" "uuid", "p_embrion_id" "uuid", "p_padrillo_id" "uuid", "p_flushing_id" "uuid", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_cl_calidad" "text", "p_tono_uterino" "text", "p_tono_cervical" "text", "p_clasificacion" "text", "p_notas" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_membresia_modulo"("p_membresia_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_modulo_id INTEGER;
BEGIN
  SELECT id INTO v_modulo_id FROM cat_modulo WHERE codigo = p_modulo_codigo;
  IF v_modulo_id IS NULL THEN
    RAISE EXCEPTION 'Módulo "%" no existe', p_modulo_codigo;
  END IF;

  INSERT INTO membresia_modulo (membresia_id, modulo_id, habilitado)
  VALUES (p_membresia_id, v_modulo_id, p_habilitado)
  ON CONFLICT (membresia_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado;
END;
$$;


ALTER FUNCTION "public"."set_membresia_modulo"("p_membresia_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_sociedad_modulo"("p_sociedad_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_modulo_id INTEGER;
BEGIN
  SELECT id INTO v_modulo_id FROM cat_modulo WHERE codigo = p_modulo_codigo;
  IF v_modulo_id IS NULL THEN
    RAISE EXCEPTION 'Módulo "%" no existe', p_modulo_codigo;
  END IF;

  INSERT INTO sociedad_modulo (sociedad_id, modulo_id, habilitado)
  VALUES (p_sociedad_id, v_modulo_id, p_habilitado)
  ON CONFLICT (sociedad_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado;
END;
$$;


ALTER FUNCTION "public"."set_sociedad_modulo"("p_sociedad_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_usuario_modulo"("p_usuario_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_modulo_id INTEGER;
BEGIN
  SELECT id INTO v_modulo_id FROM cat_modulo WHERE codigo = p_modulo_codigo;
  IF v_modulo_id IS NULL THEN
    RAISE EXCEPTION 'Módulo "%" no existe', p_modulo_codigo;
  END IF;

  INSERT INTO usuario_modulo (usuario_id, modulo_id, habilitado)
  VALUES (p_usuario_id, v_modulo_id, p_habilitado)
  ON CONFLICT (usuario_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado;
END;
$$;


ALTER FUNCTION "public"."set_usuario_modulo"("p_usuario_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sincronizar_prenez_ecografia"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_fecha_transf date;
  v_autor        uuid := COALESCE(auth.uid(), NEW.veterinario_id);
  v_motivo       text := format('Ecografía %s: %s', NEW.numero, NEW.resultado);
BEGIN
  -- La receptora está en el ciclo de su última transferencia: una eco de una
  -- transferencia anterior (cargada o corregida) no le cambia nada.
  IF NOT _cria_transferencia_vigente(NEW.transferencia_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.resultado = 'abortada' THEN
    UPDATE caballo
       SET prenada = false, fecha_prenez = NULL, updated_at = now()
     WHERE id = NEW.caballo_receptora_id;
    PERFORM _cria_cambiar_estado_reproductivo(
      NEW.caballo_receptora_id, NEW.sociedad_id, 'vacia', v_motivo, v_autor);

  ELSIF NEW.resultado = 'prenada' THEN
    SELECT fecha INTO v_fecha_transf
      FROM cria_transferencia WHERE id = NEW.transferencia_id;
    UPDATE caballo
       SET prenada      = true,
           fecha_prenez = COALESCE(fecha_prenez, v_fecha_transf, NEW.fecha),
           updated_at   = now()
     WHERE id = NEW.caballo_receptora_id;
    PERFORM _cria_cambiar_estado_reproductivo(
      NEW.caballo_receptora_id, NEW.sociedad_id, 'prenada', v_motivo, v_autor);

  ELSIF TG_OP = 'UPDATE' AND OLD.resultado = 'abortada' THEN
    -- Se corrigió un aborto cargado por error.
    PERFORM _cria_revertir_aborto(
      NEW.caballo_receptora_id, NEW.sociedad_id, NEW.transferencia_id, NEW.numero,
      format('Ecografía %s: corregida de abortada a %s', NEW.numero, NEW.resultado), v_autor);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sincronizar_prenez_ecografia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."superadmin_caballos_propios_por_vet"("p_vet_ids" "uuid"[]) RETURNS TABLE("vet_owner_id" "uuid", "cantidad" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    IF NOT is_superadmin() THEN
      RAISE EXCEPTION 'No autorizado.';
    END IF;

    RETURN QUERY
    SELECT c.vet_owner_id, COUNT(*)::INTEGER
    FROM caballo c
    WHERE c.vet_owner_id = ANY(p_vet_ids)
      AND c.sociedad_id IS NULL
      AND c.activo = TRUE
    GROUP BY c.vet_owner_id;
  END;
  $$;


ALTER FUNCTION "public"."superadmin_caballos_propios_por_vet"("p_vet_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."superadmin_eliminar_usuario"("p_usuario_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

    DELETE FROM trabajo_sanitario_caballo
    WHERE trabajo_id IN (SELECT id FROM trabajo_sanitario WHERE vet_owner_id = p_usuario_id);
    DELETE FROM trabajo_sanitario WHERE vet_owner_id = p_usuario_id;

    DELETE FROM campo WHERE vet_owner_id = p_usuario_id;

    DELETE FROM acceso_vet WHERE vet_id = p_usuario_id;
    UPDATE acceso_vet SET otorgado_por = NULL WHERE otorgado_por = p_usuario_id;

    DELETE FROM acceso_vet_sociedad WHERE vet_id = p_usuario_id;
    UPDATE acceso_vet_sociedad SET otorgado_por = NULL WHERE otorgado_por = p_usuario_id;

    DELETE FROM suscripcion_veterinario WHERE usuario_id = p_usuario_id;
    UPDATE suscripcion_veterinario SET activado_por = NULL WHERE activado_por = p_usuario_id;

    UPDATE caballo_tag SET creado_por = NULL WHERE creado_por = p_usuario_id;

    DELETE FROM usuario WHERE id = p_usuario_id;

    RETURN v_borrados;
  END;
$$;


ALTER FUNCTION "public"."superadmin_eliminar_usuario"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tiene_membresia"("p_sociedad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM membresia
    WHERE usuario_id  = auth.uid()
      AND sociedad_id = p_sociedad_id
      AND activa      = TRUE
  );
$$;


ALTER FUNCTION "public"."tiene_membresia"("p_sociedad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_prenada_veterinario"("p_caballo_id" "uuid", "p_prenada" boolean, "p_fecha_prenez" "date" DEFAULT NULL::"date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo
      WHERE id = p_caballo_id AND vet_owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sin acceso a este caballo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM caballo WHERE id = p_caballo_id AND categoria = 'Yegua'
  ) THEN
    RAISE EXCEPTION 'Solo se puede marcar prenada a una Yegua';
  END IF;

  UPDATE caballo
  SET
    prenada      = p_prenada,
    fecha_prenez = CASE WHEN p_prenada THEN p_fecha_prenez ELSE NULL END,
    updated_at   = NOW()
  WHERE id = p_caballo_id;
END;
$$;


ALTER FUNCTION "public"."toggle_prenada_veterinario"("p_caballo_id" "uuid", "p_prenada" boolean, "p_fecha_prenez" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transferir_caballos_vet"("p_caballo_ids" "uuid"[], "p_sociedad_destino_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    UPDATE caballo
    SET sociedad_id = p_sociedad_destino_id,
        vet_owner_id = NULL
    WHERE id = ANY(p_caballo_ids)
      AND vet_owner_id = auth.uid();
  END;
  $$;


ALTER FUNCTION "public"."transferir_caballos_vet"("p_caballo_ids" "uuid"[], "p_sociedad_destino_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_trabajo_sanitario_compartir"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.compartido_con IS DISTINCT FROM OLD.compartido_con
     AND NOT (tiene_membresia(NEW.sociedad_id)
              OR is_superadmin()
              OR OLD.creado_por   = auth.uid()
              OR OLD.vet_owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Solo la empresa o el autor del plan pueden cambiar con quién está compartido';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_trabajo_sanitario_compartir"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_campo_caballo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_campo_sociedad UUID;
  v_campo_vet      UUID;
  v_coincide       BOOLEAN;
  v_cambio_duenio  BOOLEAN := FALSE;
BEGIN
  IF NEW.campo_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_cambio_duenio := (OLD.sociedad_id  IS DISTINCT FROM NEW.sociedad_id)
                    OR (OLD.vet_owner_id IS DISTINCT FROM NEW.vet_owner_id);
  END IF;

  SELECT sociedad_id, vet_owner_id
    INTO v_campo_sociedad, v_campo_vet
    FROM campo WHERE id = NEW.campo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El campo indicado no existe.';
  END IF;

  IF NEW.sociedad_id IS NOT NULL THEN
    v_coincide := (v_campo_sociedad IS NOT DISTINCT FROM NEW.sociedad_id);
  ELSIF NEW.vet_owner_id IS NOT NULL THEN
    v_coincide := (v_campo_vet IS NOT DISTINCT FROM NEW.vet_owner_id);
  ELSE
    v_coincide := FALSE;
  END IF;

  IF v_coincide THEN
    RETURN NEW;
  END IF;

  -- El caballo se mudó de dueño: el campo anterior ya no tiene sentido.
  IF v_cambio_duenio THEN
    NEW.campo_id := NULL;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'El campo asignado no pertenece al dueño del caballo.';
END;
$$;


ALTER FUNCTION "public"."validar_campo_caballo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vet_caballos_propios"("p_usuario_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER FROM caballo
   WHERE vet_owner_id = p_usuario_id
     AND sociedad_id IS NULL
     AND activo = TRUE;
$$;


ALTER FUNCTION "public"."vet_caballos_propios"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vet_estado_limite"() RETURNS TABLE("caballos_propios" integer, "limite" integer, "limite_gratuito" integer, "limite_con_membresia" integer, "suscripcion_activa" boolean, "excedente" integer, "debe_regularizar" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    d.propios,
    d.limite,
    vet_limite_gratuito(),
    vet_limite_pago(),
    d.susc,
    GREATEST(d.propios - d.limite, 0),
    d.propios > d.limite
  FROM (
    SELECT
      vet_caballos_propios(auth.uid())   AS propios,
      vet_limite_aplicable(auth.uid())   AS limite,
      vet_suscripcion_activa(auth.uid()) AS susc
  ) d;
$$;


ALTER FUNCTION "public"."vet_estado_limite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vet_limite_aplicable"("p_usuario_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN vet_suscripcion_activa(p_usuario_id) THEN vet_limite_pago()
    ELSE vet_limite_gratuito()
  END;
$$;


ALTER FUNCTION "public"."vet_limite_aplicable"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vet_limite_gratuito"() RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT 5;
$$;


ALTER FUNCTION "public"."vet_limite_gratuito"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vet_limite_pago"() RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$ SELECT 25; $$;


ALTER FUNCTION "public"."vet_limite_pago"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vet_puede_agregar_caballo"("p_usuario_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT vet_caballos_propios(p_usuario_id) < vet_limite_aplicable(p_usuario_id);
$$;


ALTER FUNCTION "public"."vet_puede_agregar_caballo"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vet_suscripcion_activa"("p_usuario_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM suscripcion_veterinario
     WHERE usuario_id = p_usuario_id
       AND (
         (estado = 'activa'
           AND (fecha_vencimiento IS NULL OR fecha_vencimiento > NOW()))
         OR
         (estado = 'cancelada'
           AND fecha_vencimiento IS NOT NULL
           AND fecha_vencimiento > NOW())
       )
  );
$$;


ALTER FUNCTION "public"."vet_suscripcion_activa"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vet_tiene_acceso"("p_caballo_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario u
    WHERE u.id = auth.uid() AND u.rol = 'veterinario' AND u.activo = TRUE
      AND (
        EXISTS (
          SELECT 1 FROM acceso_vet av
          WHERE av.vet_id = auth.uid() AND av.caballo_id = p_caballo_id AND av.activo = TRUE
        )
        OR
        EXISTS (
          SELECT 1 FROM acceso_vet_sociedad avs
          JOIN caballo c ON c.sociedad_id = avs.sociedad_id
          WHERE avs.vet_id = auth.uid() AND avs.activo = TRUE AND c.id = p_caballo_id
        )
      )
  );
$$;


ALTER FUNCTION "public"."vet_tiene_acceso"("p_caballo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vet_tiene_acceso_caballo"("p_caballo_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
      SELECT 1 FROM acceso_vet
      WHERE caballo_id = p_caballo_id
        AND vet_id = auth.uid()
        AND activo = true
    );
  $$;


ALTER FUNCTION "public"."vet_tiene_acceso_caballo"("p_caballo_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."acceso_vet" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vet_id" "uuid" NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "otorgado_por" "uuid",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."acceso_vet" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."acceso_vet_sociedad" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vet_id" "uuid" NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "otorgado_por" "uuid",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."acceso_vet_sociedad" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alerta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid",
    "motivo" "text" NOT NULL,
    "fecha_alerta" "date" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alerta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alerta_caballo" (
    "alerta_id" "uuid" NOT NULL,
    "caballo_id" "uuid" NOT NULL
);


ALTER TABLE "public"."alerta_caballo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auditoria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tabla" "text" NOT NULL,
    "registro_id" "text",
    "operacion" "text" NOT NULL,
    "usuario_id" "uuid",
    "sociedad_id" "uuid",
    "campos" "text"[],
    "datos_antes" "jsonb",
    "datos_despues" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auditoria_operacion_check" CHECK (("operacion" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."auditoria" OWNER TO "postgres";


COMMENT ON TABLE "public"."auditoria" IS 'Registro append-only de cambios en las tablas sensibles. Lo escribe el trigger fn_auditar(); nadie lo edita.';



CREATE TABLE IF NOT EXISTS "public"."caballo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(150) NOT NULL,
    "fecha_nacimiento" "date",
    "categoria" character varying(20),
    "raza_id" integer,
    "pelaje_id" integer,
    "numero_chip" character varying(50),
    "numero_registro" character varying(50),
    "sociedad_id" "uuid",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campo_id" "uuid",
    "rol_reproductivo" "text",
    "padre_nombre" "text",
    "madre_nombre" "text",
    "en_venta_pendiente" boolean DEFAULT false,
    "padre_id" "uuid",
    "madre_id" "uuid",
    "vet_owner_id" "uuid",
    "subcategoria" "text",
    "prenada" boolean DEFAULT false,
    "fecha_prenez" "date",
    "estado_reproductivo" "text",
    "sexo" "text",
    "observaciones" "text",
    "domador" "text",
    CONSTRAINT "caballo_categoria_check" CHECK ((("categoria")::"text" = ANY ((ARRAY['Yegua'::character varying, 'Padrillo'::character varying, 'Caballo'::character varying, 'Potrillo'::character varying])::"text"[]))),
    CONSTRAINT "caballo_estado_reproductivo_check" CHECK ((("estado_reproductivo" IS NULL) OR ("estado_reproductivo" = ANY (ARRAY['revision'::"text", 'strelling'::"text", 'inseminacion'::"text", 'oxy'::"text", 'ov'::"text", 'flushing'::"text", 'pg'::"text", 'espera'::"text", 'sincronizando'::"text", 'disponible'::"text", 'lista_transferencia'::"text", 'transferida'::"text", 'pendiente_eco'::"text", 'eco1'::"text", 'eco2'::"text", 'eco3'::"text", 'prenada'::"text", 'vacia'::"text", 'volviendo_sincronizar'::"text"])))),
    CONSTRAINT "caballo_numero_chip_formato_check" CHECK ((("numero_chip" IS NULL) OR (("numero_chip")::"text" ~ '^\d{15}$'::"text"))),
    CONSTRAINT "caballo_rol_reproductivo_check" CHECK (("rol_reproductivo" = ANY (ARRAY['Donante'::"text", 'Receptora'::"text"]))),
    CONSTRAINT "caballo_sexo_check" CHECK ((("sexo" IS NULL) OR ("sexo" = ANY (ARRAY['H'::"text", 'M'::"text"]))))
);


ALTER TABLE "public"."caballo" OWNER TO "postgres";


COMMENT ON COLUMN "public"."caballo"."numero_chip" IS 'Chip ISO 11784/11785: 15 dígitos, único por animal. NULL si el caballo todavía no fue chipeado.';



COMMENT ON COLUMN "public"."caballo"."rol_reproductivo" IS 'Rol dentro del programa reproductivo. NULL = sin rol asignado.';



COMMENT ON COLUMN "public"."caballo"."sexo" IS 'H (hembra) o M (macho). NULL si no se conoce.';



COMMENT ON COLUMN "public"."caballo"."observaciones" IS 'Notas libres: lesiones, marcas, condición de nacimiento.';



COMMENT ON COLUMN "public"."caballo"."domador" IS 'Domador a cargo del animal. Texto libre — no es un usuario del sistema.';



CREATE TABLE IF NOT EXISTS "public"."caballo_tag" (
    "caballo_id" "uuid" NOT NULL,
    "tag_id" integer NOT NULL,
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."caballo_tag" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid",
    "nombre" character varying(150) NOT NULL,
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vet_owner_id" "uuid",
    CONSTRAINT "campo_duenio_check" CHECK (((("sociedad_id" IS NOT NULL) AND ("vet_owner_id" IS NULL)) OR (("sociedad_id" IS NULL) AND ("vet_owner_id" IS NOT NULL))))
);


ALTER TABLE "public"."campo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cat_chip_obs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "veterinario_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cat_chip_obs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cat_modulo" (
    "id" integer NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cat_modulo" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_modulo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_modulo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_modulo_id_seq" OWNED BY "public"."cat_modulo"."id";



CREATE TABLE IF NOT EXISTS "public"."cat_parte_cuerpo" (
    "id" integer NOT NULL,
    "nombre" character varying(100) NOT NULL
);


ALTER TABLE "public"."cat_parte_cuerpo" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_parte_cuerpo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_parte_cuerpo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_parte_cuerpo_id_seq" OWNED BY "public"."cat_parte_cuerpo"."id";



CREATE TABLE IF NOT EXISTS "public"."cat_pelaje" (
    "id" integer NOT NULL,
    "nombre" character varying(100) NOT NULL
);


ALTER TABLE "public"."cat_pelaje" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_pelaje_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_pelaje_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_pelaje_id_seq" OWNED BY "public"."cat_pelaje"."id";



CREATE TABLE IF NOT EXISTS "public"."cat_raza" (
    "id" integer NOT NULL,
    "nombre" character varying(100) NOT NULL
);


ALTER TABLE "public"."cat_raza" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_raza_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_raza_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_raza_id_seq" OWNED BY "public"."cat_raza"."id";



CREATE TABLE IF NOT EXISTS "public"."cat_rol" (
    "id" integer NOT NULL,
    "nombre" character varying(50) NOT NULL
);


ALTER TABLE "public"."cat_rol" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_rol_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_rol_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_rol_id_seq" OWNED BY "public"."cat_rol"."id";



CREATE TABLE IF NOT EXISTS "public"."cat_tag" (
    "id" integer NOT NULL,
    "nombre" "text" NOT NULL,
    "color" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cat_tag" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_tag_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_tag_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_tag_id_seq" OWNED BY "public"."cat_tag"."id";



CREATE TABLE IF NOT EXISTS "public"."cat_tipo_consulta" (
    "id" integer NOT NULL,
    "nombre" character varying(100) NOT NULL
);


ALTER TABLE "public"."cat_tipo_consulta" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_tipo_consulta_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_tipo_consulta_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_tipo_consulta_id_seq" OWNED BY "public"."cat_tipo_consulta"."id";



CREATE TABLE IF NOT EXISTS "public"."cat_trabajo_sanitario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid",
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cat_trabajo_sanitario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cria_ecografia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "transferencia_id" "uuid" NOT NULL,
    "caballo_receptora_id" "uuid" NOT NULL,
    "veterinario_id" "uuid",
    "numero" smallint NOT NULL,
    "fecha" "date" NOT NULL,
    "resultado" "text" NOT NULL,
    "ovario_izq" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "ovario_der" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "origen_recordatorio_id" "uuid",
    "revision" smallint DEFAULT 1 NOT NULL,
    CONSTRAINT "cria_ecografia_numero_check" CHECK (("numero" >= 1)),
    CONSTRAINT "cria_ecografia_resultado_check" CHECK (("resultado" = ANY (ARRAY['prenada'::"text", 'abortada'::"text", 'pendiente'::"text", 'volver_a_ver'::"text", 'vacia'::"text", 'vacia_resincronizar'::"text"]))),
    CONSTRAINT "cria_ecografia_revision_check" CHECK (("revision" >= 1))
);


ALTER TABLE "public"."cria_ecografia" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cria_ecografia"."origen_recordatorio_id" IS 'Recordatorio Eco 1/2/3 que esta ecografía resolvió, si se cargó desde él. NULL si se cargó a mano desde Transferencias.';



CREATE TABLE IF NOT EXISTS "public"."cria_estado_transicion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "estado_anterior" "text",
    "estado_nuevo" "text" NOT NULL,
    "motivo" "text",
    "registro_origen_id" "uuid",
    "flushing_origen_id" "uuid",
    "transferencia_origen_id" "uuid",
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cria_estado_transicion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cria_evento_reproductivo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "transferencia_id" "uuid",
    "registro_id" "uuid",
    "tipo" "text" NOT NULL,
    "datos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cria_evento_reproductivo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cria_flushing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "fecha" "date" NOT NULL,
    "veterinario_id" "uuid",
    "es_negativo" boolean DEFAULT false NOT NULL,
    "cantidad" smallint,
    "padrillo_id" "uuid",
    "origen_recordatorio_id" "uuid",
    "pg_given" boolean DEFAULT false NOT NULL,
    "cancelado" boolean DEFAULT false NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cria_flushing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cria_padrillo_preferido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "donante_id" "uuid" NOT NULL,
    "padrillo_id" "uuid" NOT NULL,
    "prioridad" smallint NOT NULL,
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cria_padrillo_preferido_no_autoref" CHECK (("donante_id" <> "padrillo_id")),
    CONSTRAINT "cria_padrillo_preferido_prioridad_check" CHECK ((("prioridad" >= 1) AND ("prioridad" <= 10)))
);


ALTER TABLE "public"."cria_padrillo_preferido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cria_parametro" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid",
    "clave" "text" NOT NULL,
    "descripcion" "text",
    "valor_dias" smallint,
    "valor_horas" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cria_parametro" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cria_plazo_vet" (
    "veterinario_id" "uuid" NOT NULL,
    "donante_strelin_a_in" smallint DEFAULT 1 NOT NULL,
    "donante_in_a_oxi" smallint DEFAULT 1 NOT NULL,
    "donante_ov_a_flushing" smallint DEFAULT 6 NOT NULL,
    "donante_pg_a_revision_pg" smallint DEFAULT 3 NOT NULL,
    "donante_flushing_a_revision" smallint DEFAULT 4 NOT NULL,
    "receptora_pg_a_revision_pg" smallint DEFAULT 4 NOT NULL,
    "receptora_ov_a_dar_pg" smallint DEFAULT 3 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "receptora_transf_a_eco1" smallint DEFAULT 30 NOT NULL,
    "receptora_transf_a_eco2" smallint DEFAULT 60 NOT NULL,
    "receptora_transf_a_eco3" smallint DEFAULT 90 NOT NULL,
    "donante_ov_sin_in_a_dar_pg" smallint DEFAULT 4 NOT NULL,
    "donante_flushing_aplica_pg" boolean DEFAULT true NOT NULL,
    CONSTRAINT "cria_plazo_vet_rango_ov_sin_in" CHECK ((("donante_ov_sin_in_a_dar_pg" >= 1) AND ("donante_ov_sin_in_a_dar_pg" <= 30))),
    CONSTRAINT "cria_plazo_vet_rangos" CHECK (((("donante_strelin_a_in" >= 1) AND ("donante_strelin_a_in" <= 30)) AND (("donante_in_a_oxi" >= 1) AND ("donante_in_a_oxi" <= 30)) AND (("donante_ov_a_flushing" >= 1) AND ("donante_ov_a_flushing" <= 30)) AND (("donante_pg_a_revision_pg" >= 1) AND ("donante_pg_a_revision_pg" <= 30)) AND (("donante_flushing_a_revision" >= 1) AND ("donante_flushing_a_revision" <= 30)) AND (("receptora_pg_a_revision_pg" >= 1) AND ("receptora_pg_a_revision_pg" <= 30)) AND (("receptora_ov_a_dar_pg" >= 1) AND ("receptora_ov_a_dar_pg" <= 30)))),
    CONSTRAINT "cria_plazo_vet_rangos_eco" CHECK (((("receptora_transf_a_eco1" >= 1) AND ("receptora_transf_a_eco1" <= 365)) AND (("receptora_transf_a_eco2" >= 1) AND ("receptora_transf_a_eco2" <= 365)) AND (("receptora_transf_a_eco3" >= 1) AND ("receptora_transf_a_eco3" <= 365))))
);


ALTER TABLE "public"."cria_plazo_vet" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cria_plazo_vet"."donante_flushing_aplica_pg" IS 'Si está activo, todo flushing registra PG automáticamente y agenda Revisión PG.';



CREATE TABLE IF NOT EXISTS "public"."cria_recordatorio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "fecha_vto" "date" NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "veterinario_id" "uuid",
    "notas" "text",
    "auto_generado" boolean DEFAULT false NOT NULL,
    "origen_registro_id" "uuid",
    "cancel_motivo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "transferencia_id" "uuid",
    "eco_numero" smallint,
    "flushing_id" "uuid",
    "fecha_original" "date",
    CONSTRAINT "cria_recordatorio_eco_numero_check" CHECK ((("eco_numero" IS NULL) OR (("eco_numero" >= 1) AND ("eco_numero" <= 3)))),
    CONSTRAINT "cria_recordatorio_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'vencido'::"text", 'hecho'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."cria_recordatorio" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cria_recordatorio"."flushing_id" IS 'Flushing que originó el recordatorio automático; evita duplicar Revisión PG.';



CREATE TABLE IF NOT EXISTS "public"."cria_registro_clinico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "fecha" "date" NOT NULL,
    "veterinario_id" "uuid",
    "ovario_izq" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "ovario_der" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "utero" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "obs_chips" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "padrillo_id" "uuid",
    "ov_dias" smallint,
    "review_desc" "text",
    "motivo" "text",
    "diagnostico" "text",
    "tratamiento" "text",
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "origen_recordatorio_id" "uuid",
    "review_dias" smallint,
    "fecha_flushing_programada" "date",
    CONSTRAINT "cria_registro_review_dias_rango" CHECK ((("review_dias" IS NULL) OR (("review_dias" >= 1) AND ("review_dias" <= 60))))
);


ALTER TABLE "public"."cria_registro_clinico" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cria_registro_clinico"."origen_recordatorio_id" IS 'Recordatorio que este registro resolvió, si se cargó tocándolo desde el calendario o la lista de recordatorios. NULL en un registro suelto.';



COMMENT ON COLUMN "public"."cria_registro_clinico"."review_dias" IS 'Cantidad de días desde `fecha` para agendar la revisión de seguimiento (1..60). NULL = no se pidió revisión. Dispara la creación de un cria_recordatorio tipo ''Revisión'' con fecha_vto = fecha + review_dias (reglasParaRegistro en crianzaStore.ts).';



CREATE TABLE IF NOT EXISTS "public"."cria_regla_recordatorio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "veterinario_id" "uuid" NOT NULL,
    "rol" "text" NOT NULL,
    "accion_disparadora" "text" NOT NULL,
    "accion_recordatorio" "text" NOT NULL,
    "dias" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cria_regla_recordatorio_accion_disparadora_check" CHECK (("btrim"("accion_disparadora") <> ''::"text")),
    CONSTRAINT "cria_regla_recordatorio_accion_recordatorio_check" CHECK (("btrim"("accion_recordatorio") <> ''::"text")),
    CONSTRAINT "cria_regla_recordatorio_dias_check" CHECK ((("dias" >= 1) AND ("dias" <= 365))),
    CONSTRAINT "cria_regla_recordatorio_rol_check" CHECK (("rol" = ANY (ARRAY['Donante'::"text", 'Receptora'::"text", 'Ambas'::"text"])))
);


ALTER TABLE "public"."cria_regla_recordatorio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cria_reprogramacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recordatorio_id" "uuid" NOT NULL,
    "fecha_anterior" "date" NOT NULL,
    "fecha_nueva" "date" NOT NULL,
    "motivo" "text",
    "creado_por" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cria_reprogramacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cria_seguimiento_gestacion" (
    "transferencia_id" "uuid" NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "caballo_receptora_id" "uuid" NOT NULL,
    "estado" "text" DEFAULT 'pendiente_eco1'::"text" NOT NULL,
    "eco_actual" smallint DEFAULT 1 NOT NULL,
    "finalizado_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cria_seguimiento_gestacion_eco_actual_check" CHECK ((("eco_actual" >= 1) AND ("eco_actual" <= 3))),
    CONSTRAINT "cria_seguimiento_gestacion_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente_eco1'::"text", 'volver_a_ver'::"text", 'prenada'::"text", 'vacia'::"text", 'vacia_resincronizar'::"text", 'finalizado'::"text"])))
);


ALTER TABLE "public"."cria_seguimiento_gestacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cria_transferencia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "fecha" "date" NOT NULL,
    "veterinario_id" "uuid",
    "registro_id" "uuid" NOT NULL,
    "caballo_receptora_id" "uuid" NOT NULL,
    "caballo_donante_id" "uuid" NOT NULL,
    "padrillo_id" "uuid",
    "flushing_id" "uuid",
    "cl_calidad" "text",
    "tono_uterino" "text",
    "tono_cervical" "text",
    "clasificacion" "text",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "embrion_id" "uuid",
    "sexo_embrion" "text",
    "fecha_sexado" "date",
    "fecha_probable_parto" "date" GENERATED ALWAYS AS ((("fecha" + '335 days 12:00:00'::interval))::"date") STORED,
    CONSTRAINT "cria_transferencia_sexo_embrion_check" CHECK ((("sexo_embrion" IS NULL) OR ("sexo_embrion" = ANY (ARRAY['macho'::"text", 'hembra'::"text", 'no_determinado'::"text"]))))
);


ALTER TABLE "public"."cria_transferencia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."embrion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "flushing_id" "uuid",
    "padrillo_id" "uuid",
    "caballo_donante_id" "uuid" NOT NULL,
    "estadio" "text",
    "grado" smallint,
    "tamanio" "text",
    "zona_pelucida" "text",
    "estado" "text" DEFAULT 'disponible'::"text" NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creado_por" "uuid",
    "fecha_extraccion" "date",
    "lugar_almacenamiento" "text",
    CONSTRAINT "embrion_estadio_check" CHECK ((("estadio" IS NULL) OR ("estadio" = ANY (ARRAY['Mórula'::"text", 'Blastocisto temprano'::"text", 'Blastocisto'::"text", 'Blastocisto expandido'::"text"])))),
    CONSTRAINT "embrion_estado_check" CHECK (("estado" = ANY (ARRAY['disponible'::"text", 'transferido'::"text", 'descartado'::"text", 'congelado'::"text", 'en_nube'::"text"]))),
    CONSTRAINT "embrion_grado_check" CHECK ((("grado" IS NULL) OR (("grado" >= 1) AND ("grado" <= 4)))),
    CONSTRAINT "embrion_origen_chk" CHECK ((("flushing_id" IS NOT NULL) OR ("creado_por" IS NOT NULL)))
);


ALTER TABLE "public"."embrion" OWNER TO "postgres";


COMMENT ON COLUMN "public"."embrion"."fecha_extraccion" IS 'Fecha exacta en que se extrajo el embrión; coincide con la fecha del flushing cuando existe.';



COMMENT ON COLUMN "public"."embrion"."lugar_almacenamiento" IS 'Texto libre que identifica dónde se conserva o a dónde se envió el embrión.';



CREATE TABLE IF NOT EXISTS "public"."historial_clinico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "tipo_consulta_id" integer NOT NULL,
    "fecha_consulta" timestamp with time zone NOT NULL,
    "diagnostico" "text",
    "tratamiento" "text",
    "observaciones" "text",
    "proxima_consulta" "date",
    "creado_por" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "imagen_url" "text",
    "estado" "text" DEFAULT 'realizada'::"text" NOT NULL,
    "trabajo_externo" boolean DEFAULT false NOT NULL,
    "anulada_at" timestamp with time zone,
    "anulada_por" "uuid",
    CONSTRAINT "historial_clinico_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'realizada'::"text"])))
);


ALTER TABLE "public"."historial_clinico" OWNER TO "postgres";


COMMENT ON COLUMN "public"."historial_clinico"."trabajo_externo" IS 'TRUE = lo hizo un profesional ajeno al establecimiento; se registra solo para dejar constancia.';



CREATE TABLE IF NOT EXISTS "public"."historial_medicamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "historial_id" "uuid" NOT NULL,
    "medicamento" character varying(200) NOT NULL,
    "dosis" character varying(100),
    "via_administracion" character varying(100),
    "duracion_dias" integer,
    CONSTRAINT "historial_medicamento_duracion_dias_check" CHECK (("duracion_dias" > 0))
);


ALTER TABLE "public"."historial_medicamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historial_parte_afectada" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "historial_id" "uuid" NOT NULL,
    "parte_cuerpo_id" integer NOT NULL,
    "lado" character varying(20),
    "descripcion" "text",
    CONSTRAINT "historial_parte_afectada_lado_check" CHECK ((("lado")::"text" = ANY ((ARRAY['izquierdo'::character varying, 'derecho'::character varying, 'bilateral'::character varying, 'no aplica'::character varying])::"text"[])))
);


ALTER TABLE "public"."historial_parte_afectada" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "email" "text" NOT NULL,
    "nombre_establecimiento" "text" NOT NULL,
    "cantidad_animales" "text",
    "modulos_interes" "text"[],
    "mensaje" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "telefono" "text",
    "estado" "text" DEFAULT 'nuevo'::"text" NOT NULL,
    "notas" "text",
    "origen" "text" DEFAULT 'landing'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "responsable" "text"
);


ALTER TABLE "public"."lead" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membresia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "rol_id" integer NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."membresia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membresia_modulo" (
    "membresia_id" "uuid" NOT NULL,
    "modulo_id" integer NOT NULL,
    "habilitado" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."membresia_modulo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "sociedad_id" "uuid",
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "cuerpo" "text",
    "link" "text",
    "leida" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notificacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pago_veterinario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "suscripcion_id" "uuid",
    "proveedor" "text" DEFAULT 'mercadopago'::"text" NOT NULL,
    "external_payment_id" "text" NOT NULL,
    "external_preapproval_id" "text",
    "estado" "text" NOT NULL,
    "monto" numeric(12,2),
    "moneda" "text",
    "fecha_pago" timestamp with time zone,
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pago_veterinario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_suscripcion_vet" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "precio" numeric(12,2) NOT NULL,
    "moneda" "text" DEFAULT 'ARS'::"text" NOT NULL,
    "frecuencia" integer DEFAULT 1 NOT NULL,
    "frecuencia_tipo" "text" DEFAULT 'months'::"text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plan_suscripcion_vet_frecuencia_check" CHECK (("frecuencia" > 0)),
    CONSTRAINT "plan_suscripcion_vet_frecuencia_tipo_check" CHECK (("frecuencia_tipo" = ANY (ARRAY['days'::"text", 'months'::"text"]))),
    CONSTRAINT "plan_suscripcion_vet_precio_check" CHECK (("precio" > (0)::numeric))
);


ALTER TABLE "public"."plan_suscripcion_vet" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."propiedad" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "propietario_id" "uuid" NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date",
    "registrado_por" "uuid" NOT NULL,
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."propiedad" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."propietario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(200) NOT NULL,
    "documento" character varying(50),
    "telefono" character varying(30),
    "email" character varying(255),
    "sociedad_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."propietario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sociedad" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(200) NOT NULL,
    "cuit" character varying(20),
    "direccion" "text",
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sociedad" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sociedad_modulo" (
    "sociedad_id" "uuid" NOT NULL,
    "modulo_id" integer NOT NULL,
    "habilitado" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sociedad_modulo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suscripcion_veterinario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "estado" "text" DEFAULT 'inactiva'::"text" NOT NULL,
    "activado_por" "uuid",
    "fecha_activacion" timestamp with time zone,
    "fecha_vencimiento" timestamp with time zone,
    "proveedor_pago" "text",
    "external_subscription_id" "text",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_id" "uuid",
    "fecha_cancelacion" timestamp with time zone,
    CONSTRAINT "suscripcion_veterinario_estado_check" CHECK (("estado" = ANY (ARRAY['activa'::"text", 'inactiva'::"text", 'pendiente'::"text", 'cancelada'::"text"])))
);


ALTER TABLE "public"."suscripcion_veterinario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."terminos_aceptacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "version_id" "uuid" NOT NULL,
    "aceptado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."terminos_aceptacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."terminos_condiciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version" integer NOT NULL,
    "titulo" "text" DEFAULT 'Términos y Condiciones'::"text" NOT NULL,
    "contenido" "text" NOT NULL,
    "activo" boolean DEFAULT false NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."terminos_condiciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."torneo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "temporada" "text",
    "fecha_inicio" "date",
    "fecha_fin" "date",
    "estado" "text" DEFAULT 'activo'::"text" NOT NULL,
    "notas" "text",
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "torneo_estado_check" CHECK (("estado" = ANY (ARRAY['activo'::"text", 'finalizado'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "torneo_fechas_coherentes" CHECK ((("fecha_fin" IS NULL) OR ("fecha_inicio" IS NULL) OR ("fecha_fin" >= "fecha_inicio")))
);


ALTER TABLE "public"."torneo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."torneo_asignacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "torneo_id" "uuid" NOT NULL,
    "jugador_id" "uuid" NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "orden" smallint DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."torneo_asignacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."torneo_jugador" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "torneo_id" "uuid" NOT NULL,
    "usuario_id" "uuid",
    "nombre" "text" NOT NULL,
    "orden" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."torneo_jugador" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trabajo_sanitario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad_id" "uuid",
    "nombre" "text" NOT NULL,
    "fecha_programada" "date" NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "tratamiento" "text",
    "observaciones" "text",
    "fecha_realizado" "date",
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "plan_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "compartido_con" "uuid",
    "vet_owner_id" "uuid",
    CONSTRAINT "trabajo_sanitario_duenio_check" CHECK (("num_nonnulls"("sociedad_id", "vet_owner_id") = 1)),
    CONSTRAINT "trabajo_sanitario_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'realizado'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."trabajo_sanitario" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trabajo_sanitario"."compartido_con" IS 'Veterinario con el que se compartió el plan. Ve el trabajo y puede cerrarlo.';



COMMENT ON COLUMN "public"."trabajo_sanitario"."vet_owner_id" IS 'Veterinario dueño del plan, cuando es sobre sus caballos propios. Excluyente con sociedad_id.';



CREATE TABLE IF NOT EXISTS "public"."trabajo_sanitario_caballo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trabajo_id" "uuid" NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "excluido" boolean DEFAULT false NOT NULL,
    "historial_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "estado" "text",
    CONSTRAINT "trabajo_sanitario_caballo_estado_check" CHECK (("estado" = ANY (ARRAY['realizado'::"text", 'no_realizado'::"text", 'pendiente'::"text"])))
);


ALTER TABLE "public"."trabajo_sanitario_caballo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuario" (
    "id" "uuid" NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "apellido" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "telefono" character varying(30),
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rol" "text" DEFAULT 'admin'::"text",
    "onboarding_vet_visto_en" timestamp with time zone,
    "dni" character varying(20),
    "matricula" character varying(50)
);


ALTER TABLE "public"."usuario" OWNER TO "postgres";


COMMENT ON COLUMN "public"."usuario"."onboarding_vet_visto_en" IS 'Timestamp de cuándo el veterinario vio el modal de bienvenida inicial. NULL = no visto.';



COMMENT ON COLUMN "public"."usuario"."dni" IS 'DNI. Obligatorio al registrarse como veterinario; NULL en los usuarios previos.';



COMMENT ON COLUMN "public"."usuario"."matricula" IS 'Matrícula profesional del veterinario. Opcional.';



CREATE TABLE IF NOT EXISTS "public"."usuario_modulo" (
    "usuario_id" "uuid" NOT NULL,
    "modulo_id" integer NOT NULL,
    "habilitado" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."usuario_modulo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venta_caballo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caballo_id" "uuid" NOT NULL,
    "caballo_nombre" "text" NOT NULL,
    "caballo_categoria" "text",
    "padre_nombre" "text",
    "madre_nombre" "text",
    "sociedad_vendedora_id" "uuid" NOT NULL,
    "tipo_comprador" "text" NOT NULL,
    "sociedad_compradora_id" "uuid",
    "comprador_nombre" "text",
    "comprador_contacto" "text",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "fecha_operacion" "date" NOT NULL,
    "fecha_vencimiento" "date" NOT NULL,
    "precio_venta" numeric(14,2),
    "moneda" "text" DEFAULT 'USD'::"text",
    "notas" "text",
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "venta_caballo_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'aceptada'::"text", 'cancelada'::"text", 'expirada'::"text"]))),
    CONSTRAINT "venta_caballo_tipo_comprador_check" CHECK (("tipo_comprador" = ANY (ARRAY['registrado'::"text", 'no_registrado'::"text"])))
);


ALTER TABLE "public"."venta_caballo" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cat_modulo" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cat_modulo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cat_parte_cuerpo" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cat_parte_cuerpo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cat_pelaje" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cat_pelaje_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cat_raza" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cat_raza_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cat_rol" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cat_rol_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cat_tag" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cat_tag_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cat_tipo_consulta" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cat_tipo_consulta_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."acceso_vet"
    ADD CONSTRAINT "acceso_vet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."acceso_vet_sociedad"
    ADD CONSTRAINT "acceso_vet_sociedad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."acceso_vet_sociedad"
    ADD CONSTRAINT "acceso_vet_sociedad_vet_id_sociedad_id_key" UNIQUE ("vet_id", "sociedad_id");



ALTER TABLE ONLY "public"."acceso_vet"
    ADD CONSTRAINT "acceso_vet_vet_id_caballo_id_key" UNIQUE ("vet_id", "caballo_id");



ALTER TABLE ONLY "public"."alerta_caballo"
    ADD CONSTRAINT "alerta_caballo_pkey" PRIMARY KEY ("alerta_id", "caballo_id");



ALTER TABLE ONLY "public"."alerta"
    ADD CONSTRAINT "alerta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auditoria"
    ADD CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."caballo"
    ADD CONSTRAINT "caballo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."caballo_tag"
    ADD CONSTRAINT "caballo_tag_pkey" PRIMARY KEY ("caballo_id", "tag_id");



ALTER TABLE ONLY "public"."campo"
    ADD CONSTRAINT "campo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campo"
    ADD CONSTRAINT "campo_sociedad_id_nombre_key" UNIQUE ("sociedad_id", "nombre");



ALTER TABLE ONLY "public"."cat_chip_obs"
    ADD CONSTRAINT "cat_chip_obs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_chip_obs"
    ADD CONSTRAINT "cat_chip_obs_veterinario_id_nombre_key" UNIQUE ("veterinario_id", "nombre");



ALTER TABLE ONLY "public"."cat_modulo"
    ADD CONSTRAINT "cat_modulo_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."cat_modulo"
    ADD CONSTRAINT "cat_modulo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_parte_cuerpo"
    ADD CONSTRAINT "cat_parte_cuerpo_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."cat_parte_cuerpo"
    ADD CONSTRAINT "cat_parte_cuerpo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_pelaje"
    ADD CONSTRAINT "cat_pelaje_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."cat_pelaje"
    ADD CONSTRAINT "cat_pelaje_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_raza"
    ADD CONSTRAINT "cat_raza_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."cat_raza"
    ADD CONSTRAINT "cat_raza_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_rol"
    ADD CONSTRAINT "cat_rol_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."cat_rol"
    ADD CONSTRAINT "cat_rol_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_tag"
    ADD CONSTRAINT "cat_tag_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."cat_tag"
    ADD CONSTRAINT "cat_tag_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_tipo_consulta"
    ADD CONSTRAINT "cat_tipo_consulta_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."cat_tipo_consulta"
    ADD CONSTRAINT "cat_tipo_consulta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_trabajo_sanitario"
    ADD CONSTRAINT "cat_trabajo_sanitario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_trabajo_sanitario"
    ADD CONSTRAINT "cat_trabajo_sanitario_sociedad_id_nombre_key" UNIQUE NULLS NOT DISTINCT ("sociedad_id", "nombre");



ALTER TABLE ONLY "public"."cria_ecografia"
    ADD CONSTRAINT "cria_ecografia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_ecografia"
    ADD CONSTRAINT "cria_ecografia_transferencia_numero_revision_uq" UNIQUE ("transferencia_id", "numero", "revision");



ALTER TABLE ONLY "public"."cria_estado_transicion"
    ADD CONSTRAINT "cria_estado_transicion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_evento_reproductivo"
    ADD CONSTRAINT "cria_evento_reproductivo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_flushing"
    ADD CONSTRAINT "cria_flushing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_padrillo_preferido"
    ADD CONSTRAINT "cria_padrillo_preferido_donante_id_padrillo_id_key" UNIQUE ("donante_id", "padrillo_id");



ALTER TABLE ONLY "public"."cria_padrillo_preferido"
    ADD CONSTRAINT "cria_padrillo_preferido_donante_id_prioridad_key" UNIQUE ("donante_id", "prioridad");



ALTER TABLE ONLY "public"."cria_padrillo_preferido"
    ADD CONSTRAINT "cria_padrillo_preferido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_parametro"
    ADD CONSTRAINT "cria_parametro_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_parametro"
    ADD CONSTRAINT "cria_parametro_sociedad_clave_uq" UNIQUE NULLS NOT DISTINCT ("sociedad_id", "clave");



ALTER TABLE ONLY "public"."cria_plazo_vet"
    ADD CONSTRAINT "cria_plazo_vet_pkey" PRIMARY KEY ("veterinario_id");



ALTER TABLE ONLY "public"."cria_recordatorio"
    ADD CONSTRAINT "cria_recordatorio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_registro_clinico"
    ADD CONSTRAINT "cria_registro_clinico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_regla_recordatorio"
    ADD CONSTRAINT "cria_regla_recordatorio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_regla_recordatorio"
    ADD CONSTRAINT "cria_regla_recordatorio_veterinario_id_rol_accion_disparado_key" UNIQUE ("veterinario_id", "rol", "accion_disparadora", "accion_recordatorio");



ALTER TABLE ONLY "public"."cria_reprogramacion"
    ADD CONSTRAINT "cria_reprogramacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cria_seguimiento_gestacion"
    ADD CONSTRAINT "cria_seguimiento_gestacion_pkey" PRIMARY KEY ("transferencia_id");



ALTER TABLE ONLY "public"."cria_transferencia"
    ADD CONSTRAINT "cria_transferencia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."embrion"
    ADD CONSTRAINT "embrion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_clinico"
    ADD CONSTRAINT "historial_clinico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_medicamento"
    ADD CONSTRAINT "historial_medicamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_parte_afectada"
    ADD CONSTRAINT "historial_parte_afectada_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead"
    ADD CONSTRAINT "lead_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membresia_modulo"
    ADD CONSTRAINT "membresia_modulo_pkey" PRIMARY KEY ("membresia_id", "modulo_id");



ALTER TABLE ONLY "public"."membresia"
    ADD CONSTRAINT "membresia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membresia"
    ADD CONSTRAINT "membresia_usuario_id_sociedad_id_rol_id_key" UNIQUE ("usuario_id", "sociedad_id", "rol_id");



ALTER TABLE ONLY "public"."notificacion"
    ADD CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pago_veterinario"
    ADD CONSTRAINT "pago_veterinario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_suscripcion_vet"
    ADD CONSTRAINT "plan_suscripcion_vet_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."plan_suscripcion_vet"
    ADD CONSTRAINT "plan_suscripcion_vet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."propiedad"
    ADD CONSTRAINT "propiedad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."propietario"
    ADD CONSTRAINT "propietario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sociedad_modulo"
    ADD CONSTRAINT "sociedad_modulo_pkey" PRIMARY KEY ("sociedad_id", "modulo_id");



ALTER TABLE ONLY "public"."sociedad"
    ADD CONSTRAINT "sociedad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suscripcion_veterinario"
    ADD CONSTRAINT "suscripcion_veterinario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."terminos_aceptacion"
    ADD CONSTRAINT "terminos_aceptacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."terminos_aceptacion"
    ADD CONSTRAINT "terminos_aceptacion_usuario_id_version_id_key" UNIQUE ("usuario_id", "version_id");



ALTER TABLE ONLY "public"."terminos_condiciones"
    ADD CONSTRAINT "terminos_condiciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."terminos_condiciones"
    ADD CONSTRAINT "terminos_condiciones_version_key" UNIQUE ("version");



ALTER TABLE ONLY "public"."torneo_asignacion"
    ADD CONSTRAINT "torneo_asignacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."torneo_asignacion"
    ADD CONSTRAINT "torneo_asignacion_torneo_id_caballo_id_key" UNIQUE ("torneo_id", "caballo_id");



ALTER TABLE ONLY "public"."torneo_jugador"
    ADD CONSTRAINT "torneo_jugador_id_torneo_id_key" UNIQUE ("id", "torneo_id");



ALTER TABLE ONLY "public"."torneo_jugador"
    ADD CONSTRAINT "torneo_jugador_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."torneo_jugador"
    ADD CONSTRAINT "torneo_jugador_torneo_id_nombre_key" UNIQUE ("torneo_id", "nombre");



ALTER TABLE ONLY "public"."torneo"
    ADD CONSTRAINT "torneo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trabajo_sanitario_caballo"
    ADD CONSTRAINT "trabajo_sanitario_caballo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trabajo_sanitario_caballo"
    ADD CONSTRAINT "trabajo_sanitario_caballo_trabajo_id_caballo_id_key" UNIQUE ("trabajo_id", "caballo_id");



ALTER TABLE ONLY "public"."trabajo_sanitario"
    ADD CONSTRAINT "trabajo_sanitario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."usuario_modulo"
    ADD CONSTRAINT "usuario_modulo_pkey" PRIMARY KEY ("usuario_id", "modulo_id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venta_caballo"
    ADD CONSTRAINT "venta_caballo_pkey" PRIMARY KEY ("id");



CREATE INDEX "alerta_caballo_cab_idx" ON "public"."alerta_caballo" USING "btree" ("caballo_id");



CREATE INDEX "alerta_creado_por_idx" ON "public"."alerta" USING "btree" ("creado_por");



CREATE INDEX "alerta_fecha_idx" ON "public"."alerta" USING "btree" ("fecha_alerta");



CREATE INDEX "alerta_sociedad_idx" ON "public"."alerta" USING "btree" ("sociedad_id");



CREATE INDEX "auditoria_registro_idx" ON "public"."auditoria" USING "btree" ("tabla", "registro_id");



CREATE INDEX "auditoria_sociedad_idx" ON "public"."auditoria" USING "btree" ("sociedad_id", "created_at" DESC) WHERE ("sociedad_id" IS NOT NULL);



CREATE INDEX "auditoria_tabla_fecha_idx" ON "public"."auditoria" USING "btree" ("tabla", "created_at" DESC);



CREATE INDEX "auditoria_usuario_idx" ON "public"."auditoria" USING "btree" ("usuario_id", "created_at" DESC);



CREATE UNIQUE INDEX "caballo_numero_chip_uniq" ON "public"."caballo" USING "btree" ("numero_chip") WHERE ("numero_chip" IS NOT NULL);



CREATE INDEX "idx_avs_vet_activo" ON "public"."acceso_vet_sociedad" USING "btree" ("vet_id") WHERE ("activo" = true);



CREATE INDEX "idx_caballo_campo" ON "public"."caballo" USING "btree" ("campo_id");



CREATE INDEX "idx_caballo_sociedad_activo" ON "public"."caballo" USING "btree" ("sociedad_id", "activo");



CREATE INDEX "idx_caballo_tag_tag" ON "public"."caballo_tag" USING "btree" ("tag_id");



CREATE INDEX "idx_campo_sociedad" ON "public"."campo" USING "btree" ("sociedad_id");



CREATE INDEX "idx_campo_vet_owner" ON "public"."campo" USING "btree" ("vet_owner_id") WHERE ("vet_owner_id" IS NOT NULL);



CREATE INDEX "idx_cat_chip_obs_vet" ON "public"."cat_chip_obs" USING "btree" ("veterinario_id");



CREATE INDEX "idx_cria_ecografia_origen_recordatorio" ON "public"."cria_ecografia" USING "btree" ("origen_recordatorio_id") WHERE ("origen_recordatorio_id" IS NOT NULL);



CREATE INDEX "idx_cria_evento_caballo_fecha" ON "public"."cria_evento_reproductivo" USING "btree" ("caballo_id", "created_at" DESC);



CREATE INDEX "idx_cria_flushing_caballo_fecha" ON "public"."cria_flushing" USING "btree" ("caballo_id", "fecha" DESC);



CREATE INDEX "idx_cria_flushing_sociedad_fecha" ON "public"."cria_flushing" USING "btree" ("sociedad_id", "fecha" DESC);



CREATE INDEX "idx_cria_padrillo_preferido_donante" ON "public"."cria_padrillo_preferido" USING "btree" ("donante_id", "prioridad");



CREATE INDEX "idx_cria_rc_caballo_fecha" ON "public"."cria_registro_clinico" USING "btree" ("caballo_id", "fecha" DESC);



CREATE INDEX "idx_cria_rc_sociedad_fecha" ON "public"."cria_registro_clinico" USING "btree" ("sociedad_id", "fecha" DESC);



CREATE INDEX "idx_cria_rec_caballo_estado" ON "public"."cria_recordatorio" USING "btree" ("caballo_id", "estado", "fecha_vto");



CREATE INDEX "idx_cria_rec_sociedad_fecha" ON "public"."cria_recordatorio" USING "btree" ("sociedad_id", "fecha_vto");



CREATE INDEX "idx_cria_recordatorio_flushing_estado" ON "public"."cria_recordatorio" USING "btree" ("flushing_id", "estado") WHERE ("flushing_id" IS NOT NULL);



CREATE INDEX "idx_cria_recordatorio_transferencia" ON "public"."cria_recordatorio" USING "btree" ("transferencia_id", "eco_numero", "estado") WHERE ("transferencia_id" IS NOT NULL);



CREATE INDEX "idx_cria_registro_clinico_origen_recordatorio" ON "public"."cria_registro_clinico" USING "btree" ("origen_recordatorio_id") WHERE ("origen_recordatorio_id" IS NOT NULL);



CREATE INDEX "idx_cria_reprogramacion_rec_fecha" ON "public"."cria_reprogramacion" USING "btree" ("recordatorio_id", "created_at" DESC);



CREATE INDEX "idx_cria_seguimiento_receptora_activo" ON "public"."cria_seguimiento_gestacion" USING "btree" ("caballo_receptora_id", "updated_at" DESC) WHERE ("finalizado_at" IS NULL);



CREATE INDEX "idx_cria_transf_donante_fecha" ON "public"."cria_transferencia" USING "btree" ("caballo_donante_id", "fecha" DESC);



CREATE INDEX "idx_cria_transf_receptora_fecha" ON "public"."cria_transferencia" USING "btree" ("caballo_receptora_id", "fecha" DESC);



CREATE INDEX "idx_cria_transf_sociedad_fecha" ON "public"."cria_transferencia" USING "btree" ("sociedad_id", "fecha" DESC);



CREATE INDEX "idx_historial_clinico_caballo" ON "public"."historial_clinico" USING "btree" ("caballo_id", "fecha_consulta" DESC);



CREATE INDEX "idx_historial_clinico_creado_por" ON "public"."historial_clinico" USING "btree" ("creado_por");



CREATE INDEX "idx_historial_clinico_pendiente" ON "public"."historial_clinico" USING "btree" ("fecha_consulta") WHERE ("estado" = 'pendiente'::"text");



CREATE INDEX "idx_historial_medicamento_historial" ON "public"."historial_medicamento" USING "btree" ("historial_id");



CREATE INDEX "idx_historial_parte_afectada_historial" ON "public"."historial_parte_afectada" USING "btree" ("historial_id");



CREATE INDEX "idx_membresia_modulo_modulo" ON "public"."membresia_modulo" USING "btree" ("modulo_id");



CREATE INDEX "idx_membresia_sociedad_activa" ON "public"."membresia" USING "btree" ("sociedad_id", "activa");



CREATE INDEX "idx_membresia_usuario_activa" ON "public"."membresia" USING "btree" ("usuario_id", "activa");



CREATE INDEX "idx_notificacion_usuario_pendiente" ON "public"."notificacion" USING "btree" ("usuario_id", "created_at" DESC);



CREATE INDEX "idx_propiedad_caballo_fecha_fin" ON "public"."propiedad" USING "btree" ("caballo_id", "fecha_fin");



CREATE INDEX "idx_propietario_sociedad" ON "public"."propietario" USING "btree" ("sociedad_id");



CREATE INDEX "idx_sociedad_modulo_modulo" ON "public"."sociedad_modulo" USING "btree" ("modulo_id");



CREATE INDEX "idx_torneo_asignacion_jugador" ON "public"."torneo_asignacion" USING "btree" ("jugador_id", "orden");



CREATE INDEX "idx_torneo_asignacion_torneo" ON "public"."torneo_asignacion" USING "btree" ("torneo_id");



CREATE INDEX "idx_torneo_jugador_torneo" ON "public"."torneo_jugador" USING "btree" ("torneo_id", "orden");



CREATE INDEX "idx_torneo_sociedad" ON "public"."torneo" USING "btree" ("sociedad_id", "created_at" DESC);



CREATE INDEX "idx_trabajo_sanitario_caballo_caballo" ON "public"."trabajo_sanitario_caballo" USING "btree" ("caballo_id");



CREATE INDEX "idx_trabajo_sanitario_caballo_trabajo" ON "public"."trabajo_sanitario_caballo" USING "btree" ("trabajo_id");



CREATE INDEX "idx_trabajo_sanitario_compartido_con" ON "public"."trabajo_sanitario" USING "btree" ("compartido_con") WHERE ("compartido_con" IS NOT NULL);



CREATE INDEX "idx_trabajo_sanitario_fecha" ON "public"."trabajo_sanitario" USING "btree" ("fecha_programada");



CREATE INDEX "idx_trabajo_sanitario_plan" ON "public"."trabajo_sanitario" USING "btree" ("plan_id");



CREATE INDEX "idx_trabajo_sanitario_sociedad" ON "public"."trabajo_sanitario" USING "btree" ("sociedad_id");



CREATE INDEX "idx_trabajo_sanitario_vet_owner" ON "public"."trabajo_sanitario" USING "btree" ("vet_owner_id") WHERE ("vet_owner_id" IS NOT NULL);



CREATE INDEX "idx_usuario_modulo_modulo" ON "public"."usuario_modulo" USING "btree" ("modulo_id");



CREATE UNIQUE INDEX "pago_veterinario_externo_key" ON "public"."pago_veterinario" USING "btree" ("proveedor", "external_payment_id");



CREATE INDEX "pago_veterinario_usuario_idx" ON "public"."pago_veterinario" USING "btree" ("usuario_id", "fecha_pago" DESC);



CREATE UNIQUE INDEX "plan_suscripcion_vet_unico_activo" ON "public"."plan_suscripcion_vet" USING "btree" ((true)) WHERE "activo";



CREATE INDEX "suscripcion_veterinario_external_subscription_id_idx" ON "public"."suscripcion_veterinario" USING "btree" ("external_subscription_id") WHERE ("external_subscription_id" IS NOT NULL);



CREATE UNIQUE INDEX "suscripcion_veterinario_usuario_id_key" ON "public"."suscripcion_veterinario" USING "btree" ("usuario_id");



CREATE UNIQUE INDEX "terminos_condiciones_activo_unico" ON "public"."terminos_condiciones" USING "btree" ("activo") WHERE ("activo" = true);



CREATE UNIQUE INDEX "uq_cria_recordatorio_eco_abierta" ON "public"."cria_recordatorio" USING "btree" ("transferencia_id", "tipo") WHERE (("transferencia_id" IS NOT NULL) AND ("estado" = ANY (ARRAY['pendiente'::"text", 'vencido'::"text"])));



CREATE UNIQUE INDEX "uq_cria_recordatorio_flushing_tipo" ON "public"."cria_recordatorio" USING "btree" ("flushing_id", "tipo") WHERE ("flushing_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."acceso_vet" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER DELETE OR UPDATE OF "activo", "sociedad_id" ON "public"."caballo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER DELETE OR UPDATE ON "public"."historial_clinico" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."membresia" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."membresia_modulo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."pago_veterinario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."plan_suscripcion_vet" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."propiedad" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."propietario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."sociedad_modulo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."suscripcion_veterinario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE OF "rol", "activo" ON "public"."usuario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."usuario_modulo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "auditar" AFTER INSERT OR DELETE OR UPDATE ON "public"."venta_caballo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "bloquear_self_escalation" BEFORE UPDATE ON "public"."usuario" FOR EACH ROW EXECUTE FUNCTION "public"."bloquear_self_escalation"();



CREATE OR REPLACE TRIGGER "set_campo_updated_at" BEFORE UPDATE ON "public"."campo" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."cat_chip_obs" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."cat_trabajo_sanitario" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."cria_ecografia" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."cria_padrillo_preferido" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."cria_parametro" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."cria_plazo_vet" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."embrion" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."plan_suscripcion_vet" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."suscripcion_veterinario" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."torneo" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."torneo_asignacion" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."trabajo_sanitario" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_caballo" BEFORE UPDATE ON "public"."caballo" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_cria_flushing" BEFORE UPDATE ON "public"."cria_flushing" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_cria_recordatorio" BEFORE UPDATE ON "public"."cria_recordatorio" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_cria_registro_clinico" BEFORE UPDATE ON "public"."cria_registro_clinico" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_cria_transferencia" BEFORE UPDATE ON "public"."cria_transferencia" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_historial_clinico" BEFORE UPDATE ON "public"."historial_clinico" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_membresia_modulo" BEFORE UPDATE ON "public"."membresia_modulo" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_propietario" BEFORE UPDATE ON "public"."propietario" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_sociedad" BEFORE UPDATE ON "public"."sociedad" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_sociedad_modulo" BEFORE UPDATE ON "public"."sociedad_modulo" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_usuario" BEFORE UPDATE ON "public"."usuario" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_usuario_modulo" BEFORE UPDATE ON "public"."usuario_modulo" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "trabajo_sanitario_compartir_guard" BEFORE UPDATE ON "public"."trabajo_sanitario" FOR EACH ROW EXECUTE FUNCTION "public"."trg_trabajo_sanitario_compartir"();



CREATE OR REPLACE TRIGGER "trg_bloquear_padrillo_familiar" BEFORE INSERT OR UPDATE OF "padrillo_id", "caballo_id" ON "public"."cria_registro_clinico" FOR EACH ROW EXECUTE FUNCTION "public"."bloquear_padrillo_familiar"();



CREATE OR REPLACE TRIGGER "trg_cancelar_pendientes_baja" AFTER UPDATE OF "activo" ON "public"."caballo" FOR EACH ROW WHEN ((("old"."activo" IS DISTINCT FROM "new"."activo") AND ("new"."activo" = false))) EXECUTE FUNCTION "public"."cancelar_pendientes_por_baja"();



CREATE OR REPLACE TRIGGER "trg_cria_auditar_correccion_ecografia" BEFORE UPDATE ON "public"."cria_ecografia" FOR EACH ROW EXECUTE FUNCTION "public"."_cria_auditar_correccion_ecografia"();



CREATE OR REPLACE TRIGGER "trg_cria_filtrar_recordatorio_automatico" BEFORE INSERT ON "public"."cria_recordatorio" FOR EACH ROW EXECUTE FUNCTION "public"."_cria_filtrar_recordatorio_automatico"();



CREATE OR REPLACE TRIGGER "trg_cria_flushing_aplicar_config_pg" BEFORE INSERT OR UPDATE OF "pg_given", "veterinario_id" ON "public"."cria_flushing" FOR EACH ROW EXECUTE FUNCTION "public"."_cria_flushing_aplicar_config_pg"();



CREATE OR REPLACE TRIGGER "trg_cria_flushing_sincronizar_revision_pg" AFTER INSERT OR UPDATE OF "pg_given", "fecha", "veterinario_id", "caballo_id", "sociedad_id" ON "public"."cria_flushing" FOR EACH ROW EXECUTE FUNCTION "public"."_cria_flushing_sincronizar_revision_pg"();



CREATE OR REPLACE TRIGGER "trg_cria_iniciar_seguimiento_transferencia" AFTER INSERT ON "public"."cria_transferencia" FOR EACH ROW EXECUTE FUNCTION "public"."_cria_iniciar_seguimiento_transferencia"();



CREATE OR REPLACE TRIGGER "trg_cria_reprogramar_revisiones_pg_por_config" AFTER UPDATE OF "donante_pg_a_revision_pg" ON "public"."cria_plazo_vet" FOR EACH ROW EXECUTE FUNCTION "public"."_cria_reprogramar_revisiones_pg_por_config"();



CREATE OR REPLACE TRIGGER "trg_sincronizar_prenez_ecografia" AFTER INSERT OR UPDATE OF "resultado" ON "public"."cria_ecografia" FOR EACH ROW EXECUTE FUNCTION "public"."sincronizar_prenez_ecografia"();



CREATE OR REPLACE TRIGGER "trg_validar_campo_caballo" BEFORE INSERT OR UPDATE OF "campo_id", "sociedad_id", "vet_owner_id" ON "public"."caballo" FOR EACH ROW EXECUTE FUNCTION "public"."validar_campo_caballo"();



ALTER TABLE ONLY "public"."acceso_vet"
    ADD CONSTRAINT "acceso_vet_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."acceso_vet"
    ADD CONSTRAINT "acceso_vet_otorgado_por_fkey" FOREIGN KEY ("otorgado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."acceso_vet_sociedad"
    ADD CONSTRAINT "acceso_vet_sociedad_otorgado_por_fkey" FOREIGN KEY ("otorgado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."acceso_vet_sociedad"
    ADD CONSTRAINT "acceso_vet_sociedad_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."acceso_vet_sociedad"
    ADD CONSTRAINT "acceso_vet_sociedad_vet_id_fkey" FOREIGN KEY ("vet_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."acceso_vet"
    ADD CONSTRAINT "acceso_vet_vet_id_fkey" FOREIGN KEY ("vet_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."alerta_caballo"
    ADD CONSTRAINT "alerta_caballo_alerta_id_fkey" FOREIGN KEY ("alerta_id") REFERENCES "public"."alerta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alerta_caballo"
    ADD CONSTRAINT "alerta_caballo_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alerta"
    ADD CONSTRAINT "alerta_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alerta"
    ADD CONSTRAINT "alerta_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caballo"
    ADD CONSTRAINT "caballo_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "public"."campo"("id");



ALTER TABLE ONLY "public"."caballo"
    ADD CONSTRAINT "caballo_madre_id_fkey" FOREIGN KEY ("madre_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."caballo"
    ADD CONSTRAINT "caballo_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."caballo"
    ADD CONSTRAINT "caballo_pelaje_id_fkey" FOREIGN KEY ("pelaje_id") REFERENCES "public"."cat_pelaje"("id");



ALTER TABLE ONLY "public"."caballo"
    ADD CONSTRAINT "caballo_raza_id_fkey" FOREIGN KEY ("raza_id") REFERENCES "public"."cat_raza"("id");



ALTER TABLE ONLY "public"."caballo"
    ADD CONSTRAINT "caballo_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."caballo_tag"
    ADD CONSTRAINT "caballo_tag_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caballo_tag"
    ADD CONSTRAINT "caballo_tag_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."caballo_tag"
    ADD CONSTRAINT "caballo_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."cat_tag"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caballo"
    ADD CONSTRAINT "caballo_vet_owner_id_fkey" FOREIGN KEY ("vet_owner_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."campo"
    ADD CONSTRAINT "campo_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."campo"
    ADD CONSTRAINT "campo_vet_owner_id_fkey" FOREIGN KEY ("vet_owner_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."cat_chip_obs"
    ADD CONSTRAINT "cat_chip_obs_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cat_trabajo_sanitario"
    ADD CONSTRAINT "cat_trabajo_sanitario_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."cria_ecografia"
    ADD CONSTRAINT "cria_ecografia_caballo_receptora_id_fkey" FOREIGN KEY ("caballo_receptora_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."cria_ecografia"
    ADD CONSTRAINT "cria_ecografia_origen_recordatorio_id_fkey" FOREIGN KEY ("origen_recordatorio_id") REFERENCES "public"."cria_recordatorio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cria_ecografia"
    ADD CONSTRAINT "cria_ecografia_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."cria_ecografia"
    ADD CONSTRAINT "cria_ecografia_transferencia_id_fkey" FOREIGN KEY ("transferencia_id") REFERENCES "public"."cria_transferencia"("id");



ALTER TABLE ONLY "public"."cria_ecografia"
    ADD CONSTRAINT "cria_ecografia_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."cria_estado_transicion"
    ADD CONSTRAINT "cria_estado_transicion_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."cria_estado_transicion"
    ADD CONSTRAINT "cria_estado_transicion_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."cria_estado_transicion"
    ADD CONSTRAINT "cria_estado_transicion_flushing_origen_id_fkey" FOREIGN KEY ("flushing_origen_id") REFERENCES "public"."cria_flushing"("id");



ALTER TABLE ONLY "public"."cria_estado_transicion"
    ADD CONSTRAINT "cria_estado_transicion_registro_origen_id_fkey" FOREIGN KEY ("registro_origen_id") REFERENCES "public"."cria_registro_clinico"("id");



ALTER TABLE ONLY "public"."cria_estado_transicion"
    ADD CONSTRAINT "cria_estado_transicion_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."cria_estado_transicion"
    ADD CONSTRAINT "cria_estado_transicion_transferencia_origen_id_fkey" FOREIGN KEY ("transferencia_origen_id") REFERENCES "public"."cria_transferencia"("id");



ALTER TABLE ONLY "public"."cria_evento_reproductivo"
    ADD CONSTRAINT "cria_evento_reproductivo_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."cria_evento_reproductivo"
    ADD CONSTRAINT "cria_evento_reproductivo_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."cria_evento_reproductivo"
    ADD CONSTRAINT "cria_evento_reproductivo_registro_id_fkey" FOREIGN KEY ("registro_id") REFERENCES "public"."cria_registro_clinico"("id");



ALTER TABLE ONLY "public"."cria_evento_reproductivo"
    ADD CONSTRAINT "cria_evento_reproductivo_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."cria_evento_reproductivo"
    ADD CONSTRAINT "cria_evento_reproductivo_transferencia_id_fkey" FOREIGN KEY ("transferencia_id") REFERENCES "public"."cria_transferencia"("id");



ALTER TABLE ONLY "public"."cria_flushing"
    ADD CONSTRAINT "cria_flushing_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cria_flushing"
    ADD CONSTRAINT "cria_flushing_origen_recordatorio_id_fkey" FOREIGN KEY ("origen_recordatorio_id") REFERENCES "public"."cria_recordatorio"("id");



ALTER TABLE ONLY "public"."cria_flushing"
    ADD CONSTRAINT "cria_flushing_padrillo_id_fkey" FOREIGN KEY ("padrillo_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."cria_flushing"
    ADD CONSTRAINT "cria_flushing_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cria_flushing"
    ADD CONSTRAINT "cria_flushing_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."cria_padrillo_preferido"
    ADD CONSTRAINT "cria_padrillo_preferido_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."cria_padrillo_preferido"
    ADD CONSTRAINT "cria_padrillo_preferido_donante_id_fkey" FOREIGN KEY ("donante_id") REFERENCES "public"."caballo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cria_padrillo_preferido"
    ADD CONSTRAINT "cria_padrillo_preferido_padrillo_id_fkey" FOREIGN KEY ("padrillo_id") REFERENCES "public"."caballo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cria_padrillo_preferido"
    ADD CONSTRAINT "cria_padrillo_preferido_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."cria_parametro"
    ADD CONSTRAINT "cria_parametro_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."cria_plazo_vet"
    ADD CONSTRAINT "cria_plazo_vet_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cria_recordatorio"
    ADD CONSTRAINT "cria_recordatorio_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cria_recordatorio"
    ADD CONSTRAINT "cria_recordatorio_flushing_id_fkey" FOREIGN KEY ("flushing_id") REFERENCES "public"."cria_flushing"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cria_recordatorio"
    ADD CONSTRAINT "cria_recordatorio_origen_registro_id_fkey" FOREIGN KEY ("origen_registro_id") REFERENCES "public"."cria_registro_clinico"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cria_recordatorio"
    ADD CONSTRAINT "cria_recordatorio_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cria_recordatorio"
    ADD CONSTRAINT "cria_recordatorio_transferencia_id_fkey" FOREIGN KEY ("transferencia_id") REFERENCES "public"."cria_transferencia"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cria_recordatorio"
    ADD CONSTRAINT "cria_recordatorio_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."cria_registro_clinico"
    ADD CONSTRAINT "cria_registro_clinico_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cria_registro_clinico"
    ADD CONSTRAINT "cria_registro_clinico_origen_recordatorio_id_fkey" FOREIGN KEY ("origen_recordatorio_id") REFERENCES "public"."cria_recordatorio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cria_registro_clinico"
    ADD CONSTRAINT "cria_registro_clinico_padrillo_id_fkey" FOREIGN KEY ("padrillo_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."cria_registro_clinico"
    ADD CONSTRAINT "cria_registro_clinico_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cria_registro_clinico"
    ADD CONSTRAINT "cria_registro_clinico_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."cria_regla_recordatorio"
    ADD CONSTRAINT "cria_regla_recordatorio_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cria_reprogramacion"
    ADD CONSTRAINT "cria_reprogramacion_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cria_reprogramacion"
    ADD CONSTRAINT "cria_reprogramacion_recordatorio_id_fkey" FOREIGN KEY ("recordatorio_id") REFERENCES "public"."cria_recordatorio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cria_seguimiento_gestacion"
    ADD CONSTRAINT "cria_seguimiento_gestacion_caballo_receptora_id_fkey" FOREIGN KEY ("caballo_receptora_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."cria_seguimiento_gestacion"
    ADD CONSTRAINT "cria_seguimiento_gestacion_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."cria_seguimiento_gestacion"
    ADD CONSTRAINT "cria_seguimiento_gestacion_transferencia_id_fkey" FOREIGN KEY ("transferencia_id") REFERENCES "public"."cria_transferencia"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cria_transferencia"
    ADD CONSTRAINT "cria_transferencia_caballo_donante_id_fkey" FOREIGN KEY ("caballo_donante_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."cria_transferencia"
    ADD CONSTRAINT "cria_transferencia_caballo_receptora_id_fkey" FOREIGN KEY ("caballo_receptora_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."cria_transferencia"
    ADD CONSTRAINT "cria_transferencia_embrion_id_fkey" FOREIGN KEY ("embrion_id") REFERENCES "public"."embrion"("id");



ALTER TABLE ONLY "public"."cria_transferencia"
    ADD CONSTRAINT "cria_transferencia_flushing_id_fkey" FOREIGN KEY ("flushing_id") REFERENCES "public"."cria_flushing"("id");



ALTER TABLE ONLY "public"."cria_transferencia"
    ADD CONSTRAINT "cria_transferencia_padrillo_id_fkey" FOREIGN KEY ("padrillo_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."cria_transferencia"
    ADD CONSTRAINT "cria_transferencia_registro_id_fkey" FOREIGN KEY ("registro_id") REFERENCES "public"."cria_registro_clinico"("id");



ALTER TABLE ONLY "public"."cria_transferencia"
    ADD CONSTRAINT "cria_transferencia_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cria_transferencia"
    ADD CONSTRAINT "cria_transferencia_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."embrion"
    ADD CONSTRAINT "embrion_caballo_donante_id_fkey" FOREIGN KEY ("caballo_donante_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."embrion"
    ADD CONSTRAINT "embrion_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."embrion"
    ADD CONSTRAINT "embrion_flushing_id_fkey" FOREIGN KEY ("flushing_id") REFERENCES "public"."cria_flushing"("id");



ALTER TABLE ONLY "public"."embrion"
    ADD CONSTRAINT "embrion_padrillo_id_fkey" FOREIGN KEY ("padrillo_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."embrion"
    ADD CONSTRAINT "embrion_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."historial_clinico"
    ADD CONSTRAINT "historial_clinico_anulada_por_fkey" FOREIGN KEY ("anulada_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."historial_clinico"
    ADD CONSTRAINT "historial_clinico_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."historial_clinico"
    ADD CONSTRAINT "historial_clinico_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."historial_clinico"
    ADD CONSTRAINT "historial_clinico_tipo_consulta_id_fkey" FOREIGN KEY ("tipo_consulta_id") REFERENCES "public"."cat_tipo_consulta"("id");



ALTER TABLE ONLY "public"."historial_medicamento"
    ADD CONSTRAINT "historial_medicamento_historial_id_fkey" FOREIGN KEY ("historial_id") REFERENCES "public"."historial_clinico"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_parte_afectada"
    ADD CONSTRAINT "historial_parte_afectada_historial_id_fkey" FOREIGN KEY ("historial_id") REFERENCES "public"."historial_clinico"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_parte_afectada"
    ADD CONSTRAINT "historial_parte_afectada_parte_cuerpo_id_fkey" FOREIGN KEY ("parte_cuerpo_id") REFERENCES "public"."cat_parte_cuerpo"("id");



ALTER TABLE ONLY "public"."membresia_modulo"
    ADD CONSTRAINT "membresia_modulo_membresia_id_fkey" FOREIGN KEY ("membresia_id") REFERENCES "public"."membresia"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membresia_modulo"
    ADD CONSTRAINT "membresia_modulo_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "public"."cat_modulo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membresia"
    ADD CONSTRAINT "membresia_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."cat_rol"("id");



ALTER TABLE ONLY "public"."membresia"
    ADD CONSTRAINT "membresia_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membresia"
    ADD CONSTRAINT "membresia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificacion"
    ADD CONSTRAINT "notificacion_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notificacion"
    ADD CONSTRAINT "notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pago_veterinario"
    ADD CONSTRAINT "pago_veterinario_suscripcion_id_fkey" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripcion_veterinario"("id");



ALTER TABLE ONLY "public"."pago_veterinario"
    ADD CONSTRAINT "pago_veterinario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."propiedad"
    ADD CONSTRAINT "propiedad_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."propiedad"
    ADD CONSTRAINT "propiedad_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "public"."propietario"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."propiedad"
    ADD CONSTRAINT "propiedad_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."propietario"
    ADD CONSTRAINT "propietario_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sociedad_modulo"
    ADD CONSTRAINT "sociedad_modulo_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "public"."cat_modulo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sociedad_modulo"
    ADD CONSTRAINT "sociedad_modulo_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suscripcion_veterinario"
    ADD CONSTRAINT "suscripcion_veterinario_activado_por_fkey" FOREIGN KEY ("activado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."suscripcion_veterinario"
    ADD CONSTRAINT "suscripcion_veterinario_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plan_suscripcion_vet"("id");



ALTER TABLE ONLY "public"."suscripcion_veterinario"
    ADD CONSTRAINT "suscripcion_veterinario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."terminos_aceptacion"
    ADD CONSTRAINT "terminos_aceptacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."terminos_aceptacion"
    ADD CONSTRAINT "terminos_aceptacion_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."terminos_condiciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."torneo_asignacion"
    ADD CONSTRAINT "torneo_asignacion_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."torneo_asignacion"
    ADD CONSTRAINT "torneo_asignacion_jugador_id_torneo_id_fkey" FOREIGN KEY ("jugador_id", "torneo_id") REFERENCES "public"."torneo_jugador"("id", "torneo_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."torneo_asignacion"
    ADD CONSTRAINT "torneo_asignacion_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "public"."torneo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."torneo"
    ADD CONSTRAINT "torneo_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."torneo_jugador"
    ADD CONSTRAINT "torneo_jugador_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "public"."torneo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."torneo_jugador"
    ADD CONSTRAINT "torneo_jugador_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."torneo"
    ADD CONSTRAINT "torneo_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."trabajo_sanitario_caballo"
    ADD CONSTRAINT "trabajo_sanitario_caballo_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."trabajo_sanitario_caballo"
    ADD CONSTRAINT "trabajo_sanitario_caballo_historial_id_fkey" FOREIGN KEY ("historial_id") REFERENCES "public"."historial_clinico"("id");



ALTER TABLE ONLY "public"."trabajo_sanitario_caballo"
    ADD CONSTRAINT "trabajo_sanitario_caballo_trabajo_id_fkey" FOREIGN KEY ("trabajo_id") REFERENCES "public"."trabajo_sanitario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trabajo_sanitario"
    ADD CONSTRAINT "trabajo_sanitario_compartido_con_fkey" FOREIGN KEY ("compartido_con") REFERENCES "public"."usuario"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trabajo_sanitario"
    ADD CONSTRAINT "trabajo_sanitario_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."trabajo_sanitario"
    ADD CONSTRAINT "trabajo_sanitario_sociedad_id_fkey" FOREIGN KEY ("sociedad_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."trabajo_sanitario"
    ADD CONSTRAINT "trabajo_sanitario_vet_owner_id_fkey" FOREIGN KEY ("vet_owner_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuario_modulo"
    ADD CONSTRAINT "usuario_modulo_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "public"."cat_modulo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuario_modulo"
    ADD CONSTRAINT "usuario_modulo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venta_caballo"
    ADD CONSTRAINT "venta_caballo_caballo_id_fkey" FOREIGN KEY ("caballo_id") REFERENCES "public"."caballo"("id");



ALTER TABLE ONLY "public"."venta_caballo"
    ADD CONSTRAINT "venta_caballo_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."venta_caballo"
    ADD CONSTRAINT "venta_caballo_sociedad_compradora_id_fkey" FOREIGN KEY ("sociedad_compradora_id") REFERENCES "public"."sociedad"("id");



ALTER TABLE ONLY "public"."venta_caballo"
    ADD CONSTRAINT "venta_caballo_sociedad_vendedora_id_fkey" FOREIGN KEY ("sociedad_vendedora_id") REFERENCES "public"."sociedad"("id");



CREATE POLICY "Elimina alerta_caballo si puede ver la alerta" ON "public"."alerta_caballo" FOR DELETE TO "authenticated" USING (("alerta_id" IN ( SELECT "alerta"."id"
   FROM "public"."alerta"
  WHERE (("alerta"."sociedad_id" IN ( SELECT "membresia"."sociedad_id"
           FROM "public"."membresia"
          WHERE (("membresia"."usuario_id" = "auth"."uid"()) AND ("membresia"."activa" = true)))) OR (("alerta"."sociedad_id" IS NULL) AND ("alerta"."creado_por" = "auth"."uid"()))))));



CREATE POLICY "Inserta alerta_caballo si puede ver la alerta" ON "public"."alerta_caballo" FOR INSERT TO "authenticated" WITH CHECK (("alerta_id" IN ( SELECT "alerta"."id"
   FROM "public"."alerta"
  WHERE (("alerta"."sociedad_id" IN ( SELECT "membresia"."sociedad_id"
           FROM "public"."membresia"
          WHERE (("membresia"."usuario_id" = "auth"."uid"()) AND ("membresia"."activa" = true)))) OR (("alerta"."sociedad_id" IS NULL) AND ("alerta"."creado_por" = "auth"."uid"()))))));



CREATE POLICY "Lee alerta_caballo si puede ver la alerta" ON "public"."alerta_caballo" FOR SELECT TO "authenticated" USING (("alerta_id" IN ( SELECT "alerta"."id"
   FROM "public"."alerta"
  WHERE (("alerta"."sociedad_id" IN ( SELECT "membresia"."sociedad_id"
           FROM "public"."membresia"
          WHERE (("membresia"."usuario_id" = "auth"."uid"()) AND ("membresia"."activa" = true)))) OR (("alerta"."sociedad_id" IS NULL) AND ("alerta"."creado_por" = "auth"."uid"()))))));



CREATE POLICY "Miembro actualiza alertas de su sociedad" ON "public"."alerta" FOR UPDATE TO "authenticated" USING ((("sociedad_id" IS NOT NULL) AND ("sociedad_id" IN ( SELECT "membresia"."sociedad_id"
   FROM "public"."membresia"
  WHERE (("membresia"."usuario_id" = "auth"."uid"()) AND ("membresia"."activa" = true))))));



CREATE POLICY "Miembro elimina alertas de su sociedad" ON "public"."alerta" FOR DELETE TO "authenticated" USING ((("sociedad_id" IS NOT NULL) AND ("sociedad_id" IN ( SELECT "membresia"."sociedad_id"
   FROM "public"."membresia"
  WHERE (("membresia"."usuario_id" = "auth"."uid"()) AND ("membresia"."activa" = true))))));



CREATE POLICY "Miembro inserta alertas en su sociedad" ON "public"."alerta" FOR INSERT TO "authenticated" WITH CHECK ((("sociedad_id" IS NOT NULL) AND ("sociedad_id" IN ( SELECT "membresia"."sociedad_id"
   FROM "public"."membresia"
  WHERE (("membresia"."usuario_id" = "auth"."uid"()) AND ("membresia"."activa" = true))))));



CREATE POLICY "Miembro lee alertas de su sociedad" ON "public"."alerta" FOR SELECT TO "authenticated" USING ((("sociedad_id" IS NOT NULL) AND ("sociedad_id" IN ( SELECT "membresia"."sociedad_id"
   FROM "public"."membresia"
  WHERE (("membresia"."usuario_id" = "auth"."uid"()) AND ("membresia"."activa" = true))))));



CREATE POLICY "Reprogramaciones visibles si el recordatorio lo es" ON "public"."cria_reprogramacion" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cria_recordatorio" "r"
  WHERE ("r"."id" = "cria_reprogramacion"."recordatorio_id"))));



CREATE POLICY "Todos leen términos vigentes" ON "public"."terminos_condiciones" FOR SELECT TO "authenticated" USING (("activo" = true));



CREATE POLICY "Usuario inserta su propia aceptación" ON "public"."terminos_aceptacion" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Usuario lee sus propias aceptaciones" ON "public"."terminos_aceptacion" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Vet actualiza sus propias alertas" ON "public"."alerta" FOR UPDATE TO "authenticated" USING ((("sociedad_id" IS NULL) AND ("creado_por" = "auth"."uid"())));



CREATE POLICY "Vet elimina sus propias alertas" ON "public"."alerta" FOR DELETE TO "authenticated" USING ((("sociedad_id" IS NULL) AND ("creado_por" = "auth"."uid"())));



CREATE POLICY "Vet inserta reprogramaciones de sus recordatorios" ON "public"."cria_reprogramacion" FOR INSERT WITH CHECK ((("creado_por" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."cria_recordatorio" "r"
  WHERE ("r"."id" = "cria_reprogramacion"."recordatorio_id")))));



CREATE POLICY "Vet inserta sus propias alertas" ON "public"."alerta" FOR INSERT TO "authenticated" WITH CHECK ((("sociedad_id" IS NULL) AND ("creado_por" = "auth"."uid"())));



CREATE POLICY "Vet lee sus propias alertas" ON "public"."alerta" FOR SELECT TO "authenticated" USING ((("sociedad_id" IS NULL) AND ("creado_por" = "auth"."uid"())));



ALTER TABLE "public"."acceso_vet" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."acceso_vet_sociedad" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_insert_acceso_vet" ON "public"."acceso_vet" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."caballo" "c"
     JOIN "public"."membresia" "m" ON (("m"."sociedad_id" = "c"."sociedad_id")))
  WHERE (("c"."id" = "acceso_vet"."caballo_id") AND ("m"."usuario_id" = "auth"."uid"()) AND ("m"."activa" = true)))));



CREATE POLICY "admin_read_acceso_vet" ON "public"."acceso_vet" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."caballo" "c"
     JOIN "public"."membresia" "m" ON (("m"."sociedad_id" = "c"."sociedad_id")))
  WHERE (("c"."id" = "acceso_vet"."caballo_id") AND ("m"."usuario_id" = "auth"."uid"()) AND ("m"."activa" = true)))));



CREATE POLICY "admin_update_acceso_vet" ON "public"."acceso_vet" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."caballo" "c"
     JOIN "public"."membresia" "m" ON (("m"."sociedad_id" = "c"."sociedad_id")))
  WHERE (("c"."id" = "acceso_vet"."caballo_id") AND ("m"."usuario_id" = "auth"."uid"()) AND ("m"."activa" = true)))));



ALTER TABLE "public"."alerta" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alerta_caballo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auditoria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auditoria_select" ON "public"."auditoria" FOR SELECT TO "authenticated" USING (("public"."is_superadmin"() OR (("sociedad_id" IS NOT NULL) AND "public"."es_admin"("sociedad_id"))));



CREATE POLICY "authenticated_read_veterinarios" ON "public"."usuario" FOR SELECT TO "authenticated" USING (("rol" = 'veterinario'::"text"));



CREATE POLICY "avs_insert" ON "public"."acceso_vet_sociedad" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_admin"("sociedad_id") OR "public"."is_superadmin"()));



CREATE POLICY "avs_select" ON "public"."acceso_vet_sociedad" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"("sociedad_id") OR ("vet_id" = "auth"."uid"()) OR "public"."is_superadmin"()));



CREATE POLICY "avs_update" ON "public"."acceso_vet_sociedad" FOR UPDATE TO "authenticated" USING (("public"."es_admin"("sociedad_id") OR "public"."is_superadmin"())) WITH CHECK (("public"."es_admin"("sociedad_id") OR "public"."is_superadmin"()));



ALTER TABLE "public"."caballo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "caballo_insert" ON "public"."caballo" FOR INSERT TO "authenticated" WITH CHECK ("public"."puede_gestionar_ficha_caballo"("sociedad_id"));



CREATE POLICY "caballo_select" ON "public"."caballo" FOR SELECT TO "authenticated" USING ("public"."tiene_membresia"("sociedad_id"));



CREATE POLICY "caballo_select_vet" ON "public"."caballo" FOR SELECT TO "authenticated" USING (("public"."vet_tiene_acceso"("id") OR ("vet_owner_id" = "auth"."uid"())));



ALTER TABLE "public"."caballo_tag" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "caballo_tag_select" ON "public"."caballo_tag" FOR SELECT TO "authenticated" USING (("public"."is_superadmin"() OR "public"."vet_tiene_acceso"("caballo_id") OR (EXISTS ( SELECT 1
   FROM "public"."caballo" "c"
  WHERE (("c"."id" = "caballo_tag"."caballo_id") AND ("c"."sociedad_id" IS NOT NULL) AND "public"."tiene_membresia"("c"."sociedad_id"))))));



CREATE POLICY "caballo_tag_write" ON "public"."caballo_tag" TO "authenticated" USING (("public"."is_superadmin"() OR "public"."vet_tiene_acceso"("caballo_id") OR (EXISTS ( SELECT 1
   FROM "public"."caballo" "c"
  WHERE (("c"."id" = "caballo_tag"."caballo_id") AND ("c"."sociedad_id" IS NOT NULL) AND "public"."puede_gestionar_ficha_caballo"("c"."sociedad_id")))))) WITH CHECK (("public"."is_superadmin"() OR "public"."vet_tiene_acceso"("caballo_id") OR (EXISTS ( SELECT 1
   FROM "public"."caballo" "c"
  WHERE (("c"."id" = "caballo_tag"."caballo_id") AND ("c"."sociedad_id" IS NOT NULL) AND "public"."puede_gestionar_ficha_caballo"("c"."sociedad_id"))))));



CREATE POLICY "caballo_update" ON "public"."caballo" FOR UPDATE TO "authenticated" USING ("public"."puede_gestionar_ficha_caballo"("sociedad_id")) WITH CHECK ("public"."puede_gestionar_ficha_caballo"("sociedad_id"));



ALTER TABLE "public"."campo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campo_delete" ON "public"."campo" FOR DELETE USING ("public"."puede_gestionar_campo"("sociedad_id"));



CREATE POLICY "campo_delete_vet" ON "public"."campo" FOR DELETE USING (("vet_owner_id" = "auth"."uid"()));



CREATE POLICY "campo_insert" ON "public"."campo" FOR INSERT TO "authenticated" WITH CHECK ("public"."puede_gestionar_campo"("sociedad_id"));



CREATE POLICY "campo_insert_vet" ON "public"."campo" FOR INSERT WITH CHECK ((("vet_owner_id" = "auth"."uid"()) AND ("sociedad_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."rol" = 'veterinario'::"text") AND ("u"."activo" = true))))));



CREATE POLICY "campo_select" ON "public"."campo" FOR SELECT TO "authenticated" USING ("public"."tiene_membresia"("sociedad_id"));



CREATE POLICY "campo_select_vet" ON "public"."campo" FOR SELECT USING ((("vet_owner_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."rol" = 'veterinario'::"text") AND ("u"."activo" = true))))));



CREATE POLICY "campo_select_vet_propio" ON "public"."campo" FOR SELECT USING (("vet_owner_id" = "auth"."uid"()));



CREATE POLICY "campo_update" ON "public"."campo" FOR UPDATE TO "authenticated" USING ("public"."puede_gestionar_campo"("sociedad_id")) WITH CHECK ("public"."puede_gestionar_campo"("sociedad_id"));



CREATE POLICY "campo_update_vet" ON "public"."campo" FOR UPDATE USING (("vet_owner_id" = "auth"."uid"())) WITH CHECK ((("vet_owner_id" = "auth"."uid"()) AND ("sociedad_id" IS NULL)));



ALTER TABLE "public"."cat_chip_obs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cat_chip_obs_delete" ON "public"."cat_chip_obs" FOR DELETE USING (("veterinario_id" = "auth"."uid"()));



CREATE POLICY "cat_chip_obs_insert" ON "public"."cat_chip_obs" FOR INSERT WITH CHECK (("veterinario_id" = "auth"."uid"()));



CREATE POLICY "cat_chip_obs_select" ON "public"."cat_chip_obs" FOR SELECT USING ((("veterinario_id" = "auth"."uid"()) OR "public"."is_superadmin"()));



CREATE POLICY "cat_chip_obs_update" ON "public"."cat_chip_obs" FOR UPDATE USING (("veterinario_id" = "auth"."uid"()));



ALTER TABLE "public"."cat_modulo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cat_modulo_admin" ON "public"."cat_modulo" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "cat_modulo_select" ON "public"."cat_modulo" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."cat_parte_cuerpo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cat_pelaje" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cat_raza" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cat_rol" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cat_tag" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cat_tag_admin" ON "public"."cat_tag" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "cat_tag_select" ON "public"."cat_tag" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."cat_tipo_consulta" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cat_trabajo_sanitario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cat_trabajo_sanitario_delete" ON "public"."cat_trabajo_sanitario" FOR DELETE USING (((("sociedad_id" IS NOT NULL) AND "public"."es_admin"("sociedad_id")) OR (("sociedad_id" IS NULL) AND "public"."is_superadmin"())));



CREATE POLICY "cat_trabajo_sanitario_insert" ON "public"."cat_trabajo_sanitario" FOR INSERT WITH CHECK (((("sociedad_id" IS NOT NULL) AND "public"."es_admin"("sociedad_id")) OR (("sociedad_id" IS NULL) AND "public"."is_superadmin"())));



CREATE POLICY "cat_trabajo_sanitario_select" ON "public"."cat_trabajo_sanitario" FOR SELECT USING ((("sociedad_id" IS NULL) OR "public"."tiene_membresia"("sociedad_id") OR "public"."is_superadmin"()));



CREATE POLICY "cat_trabajo_sanitario_update" ON "public"."cat_trabajo_sanitario" FOR UPDATE USING (((("sociedad_id" IS NOT NULL) AND "public"."es_admin"("sociedad_id")) OR (("sociedad_id" IS NULL) AND "public"."is_superadmin"())));



CREATE POLICY "catalogo_select" ON "public"."cat_parte_cuerpo" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "catalogo_select" ON "public"."cat_pelaje" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "catalogo_select" ON "public"."cat_raza" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "catalogo_select" ON "public"."cat_rol" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "catalogo_select" ON "public"."cat_tipo_consulta" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."cria_ecografia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cria_ecografia_insert" ON "public"."cria_ecografia" FOR INSERT WITH CHECK ("public"."vet_tiene_acceso"("caballo_receptora_id"));



CREATE POLICY "cria_ecografia_select" ON "public"."cria_ecografia" FOR SELECT USING (("public"."tiene_membresia"("sociedad_id") OR "public"."vet_tiene_acceso"("caballo_receptora_id") OR "public"."is_superadmin"()));



CREATE POLICY "cria_ecografia_update" ON "public"."cria_ecografia" FOR UPDATE USING ((("veterinario_id" = "auth"."uid"()) OR "public"."es_admin"("sociedad_id") OR "public"."is_superadmin"()));



ALTER TABLE "public"."cria_estado_transicion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cria_estado_transicion_insert" ON "public"."cria_estado_transicion" FOR INSERT WITH CHECK (("public"."vet_tiene_acceso"("caballo_id") OR "public"."es_admin"("sociedad_id") OR "public"."is_superadmin"()));



CREATE POLICY "cria_estado_transicion_select" ON "public"."cria_estado_transicion" FOR SELECT USING (("public"."tiene_membresia"("sociedad_id") OR "public"."is_superadmin"()));



ALTER TABLE "public"."cria_evento_reproductivo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cria_evento_select" ON "public"."cria_evento_reproductivo" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"("sociedad_id") OR "public"."vet_tiene_acceso"("caballo_id") OR "public"."is_superadmin"()));



ALTER TABLE "public"."cria_flushing" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cria_flushing_insert" ON "public"."cria_flushing" FOR INSERT TO "authenticated" WITH CHECK ("public"."vet_tiene_acceso"("caballo_id"));



CREATE POLICY "cria_flushing_select" ON "public"."cria_flushing" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"("sociedad_id") OR "public"."vet_tiene_acceso"("caballo_id")));



CREATE POLICY "cria_flushing_update" ON "public"."cria_flushing" FOR UPDATE TO "authenticated" USING (("veterinario_id" = "auth"."uid"())) WITH CHECK (("veterinario_id" = "auth"."uid"()));



ALTER TABLE "public"."cria_padrillo_preferido" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cria_padrillo_preferido_select" ON "public"."cria_padrillo_preferido" FOR SELECT TO "authenticated" USING (("public"."is_superadmin"() OR "public"."tiene_membresia"("sociedad_id") OR "public"."vet_tiene_acceso"("donante_id")));



CREATE POLICY "cria_padrillo_preferido_write" ON "public"."cria_padrillo_preferido" TO "authenticated" USING (("public"."is_superadmin"() OR "public"."es_admin"("sociedad_id") OR "public"."vet_tiene_acceso"("donante_id"))) WITH CHECK (("public"."is_superadmin"() OR "public"."es_admin"("sociedad_id") OR "public"."vet_tiene_acceso"("donante_id")));



ALTER TABLE "public"."cria_parametro" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cria_parametro_insert" ON "public"."cria_parametro" FOR INSERT WITH CHECK (((("sociedad_id" IS NULL) AND "public"."is_superadmin"()) OR (("sociedad_id" IS NOT NULL) AND "public"."es_admin"("sociedad_id"))));



CREATE POLICY "cria_parametro_select" ON "public"."cria_parametro" FOR SELECT USING ((("sociedad_id" IS NULL) OR "public"."tiene_membresia"("sociedad_id") OR "public"."is_superadmin"()));



CREATE POLICY "cria_parametro_update" ON "public"."cria_parametro" FOR UPDATE USING (((("sociedad_id" IS NULL) AND "public"."is_superadmin"()) OR (("sociedad_id" IS NOT NULL) AND "public"."es_admin"("sociedad_id"))));



ALTER TABLE "public"."cria_plazo_vet" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cria_plazo_vet_insert" ON "public"."cria_plazo_vet" FOR INSERT WITH CHECK (("veterinario_id" = "auth"."uid"()));



CREATE POLICY "cria_plazo_vet_select" ON "public"."cria_plazo_vet" FOR SELECT USING ((("veterinario_id" = "auth"."uid"()) OR "public"."is_superadmin"()));



CREATE POLICY "cria_plazo_vet_update" ON "public"."cria_plazo_vet" FOR UPDATE USING (("veterinario_id" = "auth"."uid"()));



CREATE POLICY "cria_rc_insert" ON "public"."cria_registro_clinico" FOR INSERT TO "authenticated" WITH CHECK (("public"."vet_tiene_acceso"("caballo_id") AND ("veterinario_id" = "auth"."uid"())));



CREATE POLICY "cria_rc_select" ON "public"."cria_registro_clinico" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"("sociedad_id") OR "public"."vet_tiene_acceso"("caballo_id")));



CREATE POLICY "cria_rc_update" ON "public"."cria_registro_clinico" FOR UPDATE TO "authenticated" USING (("veterinario_id" = "auth"."uid"())) WITH CHECK (("veterinario_id" = "auth"."uid"()));



CREATE POLICY "cria_rec_insert" ON "public"."cria_recordatorio" FOR INSERT TO "authenticated" WITH CHECK ("public"."vet_tiene_acceso"("caballo_id"));



CREATE POLICY "cria_rec_select" ON "public"."cria_recordatorio" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"("sociedad_id") OR "public"."vet_tiene_acceso"("caballo_id")));



CREATE POLICY "cria_rec_update" ON "public"."cria_recordatorio" FOR UPDATE TO "authenticated" USING ((("veterinario_id" = "auth"."uid"()) OR "public"."es_admin"("sociedad_id"))) WITH CHECK ((("veterinario_id" = "auth"."uid"()) OR "public"."es_admin"("sociedad_id")));



ALTER TABLE "public"."cria_recordatorio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cria_registro_clinico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cria_regla_recordatorio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cria_regla_recordatorio_delete" ON "public"."cria_regla_recordatorio" FOR DELETE USING (("veterinario_id" = "auth"."uid"()));



CREATE POLICY "cria_regla_recordatorio_insert" ON "public"."cria_regla_recordatorio" FOR INSERT WITH CHECK (("veterinario_id" = "auth"."uid"()));



CREATE POLICY "cria_regla_recordatorio_select" ON "public"."cria_regla_recordatorio" FOR SELECT USING ((("veterinario_id" = "auth"."uid"()) OR "public"."is_superadmin"()));



CREATE POLICY "cria_regla_recordatorio_update" ON "public"."cria_regla_recordatorio" FOR UPDATE USING (("veterinario_id" = "auth"."uid"())) WITH CHECK (("veterinario_id" = "auth"."uid"()));



ALTER TABLE "public"."cria_reprogramacion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cria_seguimiento_gestacion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cria_seguimiento_select" ON "public"."cria_seguimiento_gestacion" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"("sociedad_id") OR "public"."vet_tiene_acceso"("caballo_receptora_id") OR "public"."is_superadmin"()));



CREATE POLICY "cria_transf_delete" ON "public"."cria_transferencia" FOR DELETE USING (("veterinario_id" = "auth"."uid"()));



CREATE POLICY "cria_transf_insert" ON "public"."cria_transferencia" FOR INSERT TO "authenticated" WITH CHECK ("public"."vet_tiene_acceso"("caballo_receptora_id"));



CREATE POLICY "cria_transf_select" ON "public"."cria_transferencia" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"("sociedad_id") OR "public"."vet_tiene_acceso"("caballo_receptora_id") OR "public"."vet_tiene_acceso"("caballo_donante_id")));



CREATE POLICY "cria_transf_update" ON "public"."cria_transferencia" FOR UPDATE TO "authenticated" USING (("veterinario_id" = "auth"."uid"())) WITH CHECK (("veterinario_id" = "auth"."uid"()));



ALTER TABLE "public"."cria_transferencia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."embrion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "embrion_insert" ON "public"."embrion" FOR INSERT WITH CHECK (((("flushing_id" IS NOT NULL) AND "public"."vet_tiene_acceso"("caballo_donante_id")) OR (("flushing_id" IS NULL) AND ("estado" = 'congelado'::"text") AND ("creado_por" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."caballo" "c"
  WHERE (("c"."id" = "embrion"."caballo_donante_id") AND ("c"."sociedad_id" = "embrion"."sociedad_id")))) AND ("public"."vet_tiene_acceso"("caballo_donante_id") OR "public"."es_admin"("sociedad_id")))));



CREATE POLICY "embrion_select" ON "public"."embrion" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"("sociedad_id") OR "public"."vet_tiene_acceso"("caballo_donante_id") OR "public"."is_superadmin"()));



CREATE POLICY "embrion_update" ON "public"."embrion" FOR UPDATE USING (("public"."vet_tiene_acceso"("caballo_donante_id") OR "public"."es_admin"("sociedad_id") OR "public"."is_superadmin"()));



ALTER TABLE "public"."historial_clinico" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historial_clinico_delete" ON "public"."historial_clinico" FOR DELETE TO "authenticated" USING ((("creado_por" = "auth"."uid"()) AND ("estado" = 'pendiente'::"text")));



CREATE POLICY "historial_clinico_insert" ON "public"."historial_clinico" FOR INSERT WITH CHECK ((("creado_por" = "auth"."uid"()) AND ("public"."es_admin"(( SELECT "c"."sociedad_id"
   FROM "public"."caballo" "c"
  WHERE ("c"."id" = "historial_clinico"."caballo_id"))) OR (EXISTS ( SELECT 1
   FROM ("public"."membresia" "m"
     JOIN "public"."cat_rol" "r" ON (("r"."id" = "m"."rol_id")))
  WHERE (("m"."usuario_id" = "auth"."uid"()) AND ("m"."sociedad_id" = ( SELECT "c"."sociedad_id"
           FROM "public"."caballo" "c"
          WHERE ("c"."id" = "historial_clinico"."caballo_id"))) AND ("m"."activa" = true) AND (("r"."nombre")::"text" = 'veterinario'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."rol" = 'veterinario'::"text") AND ("u"."activo" = true)))))));



CREATE POLICY "historial_clinico_select" ON "public"."historial_clinico" FOR SELECT TO "authenticated" USING ((("anulada_at" IS NULL) AND ("public"."tiene_membresia"(( SELECT "c"."sociedad_id"
   FROM "public"."caballo" "c"
  WHERE ("c"."id" = "historial_clinico"."caballo_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."acceso_vet" "av"
  WHERE (("av"."vet_id" = "auth"."uid"()) AND ("av"."caballo_id" = "historial_clinico"."caballo_id") AND ("av"."activo" = true)))) OR (EXISTS ( SELECT 1
   FROM ("public"."acceso_vet_sociedad" "avs"
     JOIN "public"."caballo" "c" ON (("c"."sociedad_id" = "avs"."sociedad_id")))
  WHERE (("avs"."vet_id" = "auth"."uid"()) AND ("avs"."activo" = true) AND ("c"."id" = "historial_clinico"."caballo_id")))))));



CREATE POLICY "historial_clinico_update" ON "public"."historial_clinico" FOR UPDATE TO "authenticated" USING (("creado_por" = "auth"."uid"())) WITH CHECK (("creado_por" = "auth"."uid"()));



ALTER TABLE "public"."historial_medicamento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historial_medicamento_delete" ON "public"."historial_medicamento" FOR DELETE TO "authenticated" USING ((( SELECT "h"."creado_por"
   FROM "public"."historial_clinico" "h"
  WHERE ("h"."id" = "historial_medicamento"."historial_id")) = "auth"."uid"()));



CREATE POLICY "historial_medicamento_insert" ON "public"."historial_medicamento" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "historial_clinico"."creado_por"
   FROM "public"."historial_clinico"
  WHERE ("historial_clinico"."id" = "historial_medicamento"."historial_id")) = "auth"."uid"()));



CREATE POLICY "historial_medicamento_select" ON "public"."historial_medicamento" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"(( SELECT "c"."sociedad_id"
   FROM ("public"."caballo" "c"
     JOIN "public"."historial_clinico" "h" ON (("h"."caballo_id" = "c"."id")))
  WHERE ("h"."id" = "historial_medicamento"."historial_id"))) OR (EXISTS ( SELECT 1
   FROM ("public"."acceso_vet" "av"
     JOIN "public"."historial_clinico" "h" ON (("h"."id" = "historial_medicamento"."historial_id")))
  WHERE (("av"."vet_id" = "auth"."uid"()) AND ("av"."caballo_id" = "h"."caballo_id") AND ("av"."activo" = true)))) OR (EXISTS ( SELECT 1
   FROM (("public"."acceso_vet_sociedad" "avs"
     JOIN "public"."historial_clinico" "h" ON (("h"."id" = "historial_medicamento"."historial_id")))
     JOIN "public"."caballo" "c" ON ((("c"."id" = "h"."caballo_id") AND ("c"."sociedad_id" = "avs"."sociedad_id"))))
  WHERE (("avs"."vet_id" = "auth"."uid"()) AND ("avs"."activo" = true))))));



CREATE POLICY "historial_medicamento_update" ON "public"."historial_medicamento" FOR UPDATE TO "authenticated" USING ((( SELECT "historial_clinico"."creado_por"
   FROM "public"."historial_clinico"
  WHERE ("historial_clinico"."id" = "historial_medicamento"."historial_id")) = "auth"."uid"())) WITH CHECK ((( SELECT "historial_clinico"."creado_por"
   FROM "public"."historial_clinico"
  WHERE ("historial_clinico"."id" = "historial_medicamento"."historial_id")) = "auth"."uid"()));



ALTER TABLE "public"."historial_parte_afectada" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historial_parte_afectada_delete" ON "public"."historial_parte_afectada" FOR DELETE TO "authenticated" USING ((( SELECT "h"."creado_por"
   FROM "public"."historial_clinico" "h"
  WHERE ("h"."id" = "historial_parte_afectada"."historial_id")) = "auth"."uid"()));



CREATE POLICY "historial_parte_afectada_insert" ON "public"."historial_parte_afectada" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "historial_clinico"."creado_por"
   FROM "public"."historial_clinico"
  WHERE ("historial_clinico"."id" = "historial_parte_afectada"."historial_id")) = "auth"."uid"()));



CREATE POLICY "historial_parte_afectada_select" ON "public"."historial_parte_afectada" FOR SELECT TO "authenticated" USING (("public"."tiene_membresia"(( SELECT "c"."sociedad_id"
   FROM ("public"."caballo" "c"
     JOIN "public"."historial_clinico" "h" ON (("h"."caballo_id" = "c"."id")))
  WHERE ("h"."id" = "historial_parte_afectada"."historial_id"))) OR (EXISTS ( SELECT 1
   FROM ("public"."acceso_vet" "av"
     JOIN "public"."historial_clinico" "h" ON (("h"."id" = "historial_parte_afectada"."historial_id")))
  WHERE (("av"."vet_id" = "auth"."uid"()) AND ("av"."caballo_id" = "h"."caballo_id") AND ("av"."activo" = true)))) OR (EXISTS ( SELECT 1
   FROM (("public"."acceso_vet_sociedad" "avs"
     JOIN "public"."historial_clinico" "h" ON (("h"."id" = "historial_parte_afectada"."historial_id")))
     JOIN "public"."caballo" "c" ON ((("c"."id" = "h"."caballo_id") AND ("c"."sociedad_id" = "avs"."sociedad_id"))))
  WHERE (("avs"."vet_id" = "auth"."uid"()) AND ("avs"."activo" = true))))));



CREATE POLICY "historial_parte_afectada_update" ON "public"."historial_parte_afectada" FOR UPDATE TO "authenticated" USING ((( SELECT "historial_clinico"."creado_por"
   FROM "public"."historial_clinico"
  WHERE ("historial_clinico"."id" = "historial_parte_afectada"."historial_id")) = "auth"."uid"())) WITH CHECK ((( SELECT "historial_clinico"."creado_por"
   FROM "public"."historial_clinico"
  WHERE ("historial_clinico"."id" = "historial_parte_afectada"."historial_id")) = "auth"."uid"()));



ALTER TABLE "public"."lead" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_insert_anon" ON "public"."lead" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "lead_insert_authenticated" ON "public"."lead" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "lead_select_superadmin" ON "public"."lead" FOR SELECT TO "authenticated" USING ("public"."is_superadmin"());



CREATE POLICY "lead_update_superadmin" ON "public"."lead" FOR UPDATE TO "authenticated" USING ("public"."is_superadmin"());



ALTER TABLE "public"."membresia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membresia_insert_admin" ON "public"."membresia" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_admin"("sociedad_id"));



ALTER TABLE "public"."membresia_modulo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membresia_modulo_select" ON "public"."membresia_modulo" FOR SELECT TO "authenticated" USING (("public"."is_superadmin"() OR (EXISTS ( SELECT 1
   FROM "public"."membresia" "m"
  WHERE (("m"."id" = "membresia_modulo"."membresia_id") AND (("m"."usuario_id" = "auth"."uid"()) OR "public"."es_admin"("m"."sociedad_id")))))));



CREATE POLICY "membresia_modulo_write" ON "public"."membresia_modulo" TO "authenticated" USING (("public"."is_superadmin"() OR (EXISTS ( SELECT 1
   FROM "public"."membresia" "m"
  WHERE (("m"."id" = "membresia_modulo"."membresia_id") AND "public"."es_admin"("m"."sociedad_id")))))) WITH CHECK (("public"."is_superadmin"() OR (EXISTS ( SELECT 1
   FROM "public"."membresia" "m"
  WHERE (("m"."id" = "membresia_modulo"."membresia_id") AND "public"."es_admin"("m"."sociedad_id"))))));



CREATE POLICY "membresia_select_admin" ON "public"."membresia" FOR SELECT TO "authenticated" USING ("public"."es_admin"("sociedad_id"));



CREATE POLICY "membresia_select_propia" ON "public"."membresia" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "membresia_update_admin" ON "public"."membresia" FOR UPDATE TO "authenticated" USING ("public"."es_admin"("sociedad_id")) WITH CHECK ("public"."es_admin"("sociedad_id"));



ALTER TABLE "public"."notificacion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificacion_select" ON "public"."notificacion" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "notificacion_update" ON "public"."notificacion" FOR UPDATE USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."pago_veterinario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pago_veterinario_select" ON "public"."pago_veterinario" FOR SELECT TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) OR "public"."is_superadmin"()));



ALTER TABLE "public"."plan_suscripcion_vet" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_suscripcion_vet_insert" ON "public"."plan_suscripcion_vet" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "plan_suscripcion_vet_select" ON "public"."plan_suscripcion_vet" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "plan_suscripcion_vet_update" ON "public"."plan_suscripcion_vet" FOR UPDATE TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."propiedad" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "propiedad_insert" ON "public"."propiedad" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_admin"(( SELECT "caballo"."sociedad_id"
   FROM "public"."caballo"
  WHERE ("caballo"."id" = "propiedad"."caballo_id"))));



CREATE POLICY "propiedad_select" ON "public"."propiedad" FOR SELECT TO "authenticated" USING ("public"."tiene_membresia"(( SELECT "caballo"."sociedad_id"
   FROM "public"."caballo"
  WHERE ("caballo"."id" = "propiedad"."caballo_id"))));



ALTER TABLE "public"."propietario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "propietario_insert" ON "public"."propietario" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_admin"("sociedad_id"));



CREATE POLICY "propietario_select" ON "public"."propietario" FOR SELECT TO "authenticated" USING ("public"."tiene_membresia"("sociedad_id"));



CREATE POLICY "propietario_update" ON "public"."propietario" FOR UPDATE TO "authenticated" USING ("public"."es_admin"("sociedad_id")) WITH CHECK ("public"."es_admin"("sociedad_id"));



ALTER TABLE "public"."sociedad" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sociedad_modulo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sociedad_modulo_select" ON "public"."sociedad_modulo" FOR SELECT TO "authenticated" USING (("public"."is_superadmin"() OR "public"."tiene_membresia"("sociedad_id")));



CREATE POLICY "sociedad_modulo_write" ON "public"."sociedad_modulo" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "sociedad_select" ON "public"."sociedad" FOR SELECT TO "authenticated" USING ("public"."tiene_membresia"("id"));



CREATE POLICY "sociedad_update" ON "public"."sociedad" FOR UPDATE TO "authenticated" USING ("public"."es_admin"("id")) WITH CHECK ("public"."es_admin"("id"));



CREATE POLICY "superadmin_caballo_select" ON "public"."caballo" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_campo_select" ON "public"."campo" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_cat_rol_select" ON "public"."cat_rol" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_membresia_delete" ON "public"."membresia" FOR DELETE USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_membresia_select" ON "public"."membresia" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_membresia_update" ON "public"."membresia" FOR UPDATE USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_sociedad_insert" ON "public"."sociedad" FOR INSERT WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "superadmin_sociedad_select" ON "public"."sociedad" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_sociedad_update" ON "public"."sociedad" FOR UPDATE USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_usuario_select" ON "public"."usuario" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_usuario_update" ON "public"."usuario" FOR UPDATE USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."suscripcion_veterinario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suscripcion_veterinario_insert" ON "public"."suscripcion_veterinario" FOR INSERT WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "suscripcion_veterinario_select" ON "public"."suscripcion_veterinario" FOR SELECT USING ((("usuario_id" = "auth"."uid"()) OR "public"."is_superadmin"()));



CREATE POLICY "suscripcion_veterinario_update" ON "public"."suscripcion_veterinario" FOR UPDATE USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."terminos_aceptacion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."terminos_condiciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."torneo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."torneo_asignacion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "torneo_asignacion_select" ON "public"."torneo_asignacion" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."torneo" "t"
  WHERE (("t"."id" = "torneo_asignacion"."torneo_id") AND ("public"."is_superadmin"() OR "public"."tiene_membresia"("t"."sociedad_id"))))));



CREATE POLICY "torneo_asignacion_write" ON "public"."torneo_asignacion" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."torneo" "t"
  WHERE (("t"."id" = "torneo_asignacion"."torneo_id") AND ("public"."is_superadmin"() OR "public"."puede_gestionar_polo"("t"."sociedad_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."torneo" "t"
  WHERE (("t"."id" = "torneo_asignacion"."torneo_id") AND ("public"."is_superadmin"() OR "public"."puede_gestionar_polo"("t"."sociedad_id"))))));



ALTER TABLE "public"."torneo_jugador" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "torneo_jugador_select" ON "public"."torneo_jugador" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."torneo" "t"
  WHERE (("t"."id" = "torneo_jugador"."torneo_id") AND ("public"."is_superadmin"() OR "public"."tiene_membresia"("t"."sociedad_id"))))));



CREATE POLICY "torneo_jugador_write" ON "public"."torneo_jugador" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."torneo" "t"
  WHERE (("t"."id" = "torneo_jugador"."torneo_id") AND ("public"."is_superadmin"() OR "public"."puede_gestionar_polo"("t"."sociedad_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."torneo" "t"
  WHERE (("t"."id" = "torneo_jugador"."torneo_id") AND ("public"."is_superadmin"() OR "public"."puede_gestionar_polo"("t"."sociedad_id"))))));



CREATE POLICY "torneo_select" ON "public"."torneo" FOR SELECT TO "authenticated" USING (("public"."is_superadmin"() OR "public"."tiene_membresia"("sociedad_id")));



CREATE POLICY "torneo_write" ON "public"."torneo" TO "authenticated" USING (("public"."is_superadmin"() OR "public"."puede_gestionar_polo"("sociedad_id"))) WITH CHECK (("public"."is_superadmin"() OR "public"."puede_gestionar_polo"("sociedad_id")));



ALTER TABLE "public"."trabajo_sanitario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trabajo_sanitario_caballo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trabajo_sanitario_caballo_all" ON "public"."trabajo_sanitario_caballo" USING (("public"."vet_tiene_acceso"("caballo_id") OR (EXISTS ( SELECT 1
   FROM "public"."trabajo_sanitario" "t"
  WHERE (("t"."id" = "trabajo_sanitario_caballo"."trabajo_id") AND ("public"."tiene_membresia"("t"."sociedad_id") OR "public"."is_superadmin"() OR ("t"."creado_por" = "auth"."uid"()) OR ("t"."compartido_con" = "auth"."uid"()) OR ("t"."vet_owner_id" = "auth"."uid"()))))))) WITH CHECK (("public"."vet_tiene_acceso"("caballo_id") OR (EXISTS ( SELECT 1
   FROM "public"."trabajo_sanitario" "t"
  WHERE (("t"."id" = "trabajo_sanitario_caballo"."trabajo_id") AND ("public"."tiene_membresia"("t"."sociedad_id") OR "public"."is_superadmin"() OR ("t"."creado_por" = "auth"."uid"()) OR ("t"."compartido_con" = "auth"."uid"()) OR ("t"."vet_owner_id" = "auth"."uid"())))))));



CREATE POLICY "trabajo_sanitario_delete" ON "public"."trabajo_sanitario" FOR DELETE USING (("public"."es_admin"("sociedad_id") OR "public"."is_superadmin"() OR ("vet_owner_id" = "auth"."uid"()) OR ("creado_por" = "auth"."uid"())));



CREATE POLICY "trabajo_sanitario_insert" ON "public"."trabajo_sanitario" FOR INSERT WITH CHECK ((("creado_por" = "auth"."uid"()) AND ("public"."tiene_membresia"("sociedad_id") OR ("vet_owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."acceso_vet" "av"
     JOIN "public"."caballo" "c" ON (("c"."id" = "av"."caballo_id")))
  WHERE (("av"."vet_id" = "auth"."uid"()) AND "av"."activo" AND ("c"."sociedad_id" = "trabajo_sanitario"."sociedad_id")))))));



CREATE POLICY "trabajo_sanitario_select" ON "public"."trabajo_sanitario" FOR SELECT USING (("public"."tiene_membresia"("sociedad_id") OR "public"."is_superadmin"() OR ("creado_por" = "auth"."uid"()) OR ("compartido_con" = "auth"."uid"()) OR ("vet_owner_id" = "auth"."uid"())));



CREATE POLICY "trabajo_sanitario_update" ON "public"."trabajo_sanitario" FOR UPDATE USING (("public"."tiene_membresia"("sociedad_id") OR "public"."is_superadmin"() OR ("creado_por" = "auth"."uid"()) OR ("compartido_con" = "auth"."uid"()) OR ("vet_owner_id" = "auth"."uid"()))) WITH CHECK (("public"."tiene_membresia"("sociedad_id") OR "public"."is_superadmin"() OR ("creado_por" = "auth"."uid"()) OR ("compartido_con" = "auth"."uid"()) OR ("vet_owner_id" = "auth"."uid"())));



ALTER TABLE "public"."usuario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usuario_modulo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuario_modulo_select" ON "public"."usuario_modulo" FOR SELECT TO "authenticated" USING (("public"."is_superadmin"() OR ("usuario_id" = "auth"."uid"())));



CREATE POLICY "usuario_modulo_write" ON "public"."usuario_modulo" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "usuario_select_admin" ON "public"."usuario" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."membresia" "m"
  WHERE (("m"."usuario_id" = "usuario"."id") AND ("m"."activa" = true) AND "public"."es_admin"("m"."sociedad_id")))));



CREATE POLICY "usuario_select_propio" ON "public"."usuario" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "usuario_update_propio" ON "public"."usuario" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."venta_caballo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "venta_insert_admin" ON "public"."venta_caballo" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."membresia" "m"
     JOIN "public"."cat_rol" "r" ON (("r"."id" = "m"."rol_id")))
  WHERE (("m"."usuario_id" = "auth"."uid"()) AND ("m"."sociedad_id" = "venta_caballo"."sociedad_vendedora_id") AND (("r"."nombre")::"text" = 'admin'::"text") AND ("m"."activa" = true)))));



CREATE POLICY "venta_select_comprador" ON "public"."venta_caballo" FOR SELECT USING (("sociedad_compradora_id" IN ( SELECT "membresia"."sociedad_id"
   FROM "public"."membresia"
  WHERE (("membresia"."usuario_id" = "auth"."uid"()) AND ("membresia"."activa" = true)))));



CREATE POLICY "venta_select_vendedor" ON "public"."venta_caballo" FOR SELECT USING (("sociedad_vendedora_id" IN ( SELECT "membresia"."sociedad_id"
   FROM "public"."membresia"
  WHERE (("membresia"."usuario_id" = "auth"."uid"()) AND ("membresia"."activa" = true)))));



CREATE POLICY "vet_insert_own_acceso" ON "public"."acceso_vet" FOR INSERT WITH CHECK (("vet_id" = "auth"."uid"()));



CREATE POLICY "vet_insert_own_caballo" ON "public"."caballo" FOR INSERT WITH CHECK ((("vet_owner_id" = "auth"."uid"()) AND ("sociedad_id" IS NULL) AND "public"."vet_puede_agregar_caballo"("auth"."uid"())));



CREATE POLICY "vet_read_accessible_caballo" ON "public"."caballo" FOR SELECT USING ("public"."vet_tiene_acceso_caballo"("id"));



CREATE POLICY "vet_read_own_acceso" ON "public"."acceso_vet" FOR SELECT TO "authenticated" USING (("vet_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_cria_auditar_correccion_ecografia"() TO "anon";
GRANT ALL ON FUNCTION "public"."_cria_auditar_correccion_ecografia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cria_auditar_correccion_ecografia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."_cria_borrar_registro"("p_registro_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_cria_borrar_registro"("p_registro_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_cria_cambiar_estado_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_estado" "text", "p_motivo" "text", "p_creado_por" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_cria_cambiar_estado_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_estado" "text", "p_motivo" "text", "p_creado_por" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_cria_filtrar_recordatorio_automatico"() TO "anon";
GRANT ALL ON FUNCTION "public"."_cria_filtrar_recordatorio_automatico"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cria_filtrar_recordatorio_automatico"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."_cria_flushing_aplicar_config_pg"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_cria_flushing_aplicar_config_pg"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."_cria_flushing_sincronizar_revision_pg"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_cria_flushing_sincronizar_revision_pg"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_cria_iniciar_seguimiento_transferencia"() TO "anon";
GRANT ALL ON FUNCTION "public"."_cria_iniciar_seguimiento_transferencia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cria_iniciar_seguimiento_transferencia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."_cria_reabrir_recordatorio"("p_recordatorio_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_cria_reabrir_recordatorio"("p_recordatorio_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_cria_reprogramar_revisiones_pg_por_config"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_cria_reprogramar_revisiones_pg_por_config"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."_cria_revertir_aborto"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_transferencia_id" "uuid", "p_numero" integer, "p_motivo" "text", "p_creado_por" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_cria_revertir_aborto"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_transferencia_id" "uuid", "p_numero" integer, "p_motivo" "text", "p_creado_por" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_cria_transferencia_vigente"("p_transferencia_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_cria_transferencia_vigente"("p_transferencia_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_vet_valida_propios"("p_caballo_ids" "uuid"[], "p_activo_esperado" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_vet_valida_propios"("p_caballo_ids" "uuid"[], "p_activo_esperado" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text", "p_padre_id" "uuid", "p_padre_nombre" "text", "p_madre_id" "uuid", "p_madre_nombre" "text", "p_campo_id" "uuid", "p_sexo" "text", "p_observaciones" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text", "p_padre_id" "uuid", "p_padre_nombre" "text", "p_madre_id" "uuid", "p_madre_nombre" "text", "p_campo_id" "uuid", "p_sexo" "text", "p_observaciones" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text", "p_padre_id" "uuid", "p_padre_nombre" "text", "p_madre_id" "uuid", "p_madre_nombre" "text", "p_campo_id" "uuid", "p_sexo" "text", "p_observaciones" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text", "p_padre_id" "uuid", "p_padre_nombre" "text", "p_madre_id" "uuid", "p_madre_nombre" "text", "p_campo_id" "uuid", "p_sexo" "text", "p_observaciones" "text", "p_domador" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text", "p_padre_id" "uuid", "p_padre_nombre" "text", "p_madre_id" "uuid", "p_madre_nombre" "text", "p_campo_id" "uuid", "p_sexo" "text", "p_observaciones" "text", "p_domador" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_caballo_veterinario"("p_caballo_id" "uuid", "p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_subcategoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text", "p_padre_id" "uuid", "p_padre_nombre" "text", "p_madre_id" "uuid", "p_madre_nombre" "text", "p_campo_id" "uuid", "p_sexo" "text", "p_observaciones" "text", "p_domador" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_rol_reproductivo_vet"("p_caballo_id" "uuid", "p_rol" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_rol_reproductivo_vet"("p_caballo_id" "uuid", "p_rol" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ancestros_caballo"("p_caballo_id" "uuid", "p_gen" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ancestros_caballo"("p_caballo_id" "uuid", "p_gen" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ancestros_caballo"("p_caballo_id" "uuid", "p_gen" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."anular_consulta"("p_historial_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."anular_consulta"("p_historial_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."anular_consulta"("p_historial_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bloquear_padrillo_familiar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bloquear_padrillo_familiar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bloquear_self_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bloquear_self_escalation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."buscar_usuario_por_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."buscar_usuario_por_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."caballos_sin_acceso_vet"("p_vet_id" "uuid", "p_caballo_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."caballos_sin_acceso_vet"("p_vet_id" "uuid", "p_caballo_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."caballos_sin_acceso_vet"("p_vet_id" "uuid", "p_caballo_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cancelar_pendientes_por_baja"() TO "anon";
GRANT ALL ON FUNCTION "public"."cancelar_pendientes_por_baja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancelar_pendientes_por_baja"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cancelar_venta_caballo"("p_venta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancelar_venta_caballo"("p_venta_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cerrar_plan_sanitario"("p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cerrar_plan_sanitario"("p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cerrar_recordatorios_flushing"("p_caballo_id" "uuid", "p_flushing_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cerrar_recordatorios_flushing"("p_caballo_id" "uuid", "p_flushing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cerrar_recordatorios_flushing"("p_caballo_id" "uuid", "p_flushing_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."compartir_trabajos_con_vet"("p_trabajo_ids" "uuid"[], "p_vet_id" "uuid", "p_otorgar_acceso" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."compartir_trabajos_con_vet"("p_trabajo_ids" "uuid"[], "p_vet_id" "uuid", "p_otorgar_acceso" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."compartir_trabajos_con_vet"("p_trabajo_ids" "uuid"[], "p_vet_id" "uuid", "p_otorgar_acceso" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."completar_trabajo_sanitario"("p_trabajo_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."completar_trabajo_sanitario"("p_trabajo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."completar_trabajo_sanitario"("p_trabajo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_caballo_veterinario"("p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_caballo_veterinario"("p_nombre" "text", "p_fecha_nacimiento" "date", "p_categoria" "text", "p_raza_id" integer, "p_pelaje_id" integer, "p_numero_chip" "text", "p_numero_registro" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_plan_sanitario_compartido"("p_items" "jsonb", "p_vet_id" "uuid", "p_otorgar_acceso" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."crear_plan_sanitario_compartido"("p_items" "jsonb", "p_vet_id" "uuid", "p_otorgar_acceso" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_plan_sanitario_compartido"("p_items" "jsonb", "p_vet_id" "uuid", "p_otorgar_acceso" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."dar_de_baja_caballos_veterinario"("p_caballo_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dar_de_baja_caballos_veterinario"("p_caballo_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dar_de_baja_caballos_veterinario"("p_caballo_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."editar_masivo_veterinario"("p_caballo_ids" "uuid"[], "p_campo_id" "uuid", "p_categoria" "text", "p_subcategoria" "text", "p_prenada" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."editar_masivo_veterinario"("p_caballo_ids" "uuid"[], "p_campo_id" "uuid", "p_categoria" "text", "p_subcategoria" "text", "p_prenada" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."editar_masivo_veterinario"("p_caballo_ids" "uuid"[], "p_campo_id" "uuid", "p_categoria" "text", "p_subcategoria" "text", "p_prenada" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."editar_ovulacion"("p_registro_id" "uuid", "p_fecha" "date", "p_fecha_flushing" "date", "p_veterinario_id" "uuid", "p_caballo_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."editar_ovulacion"("p_registro_id" "uuid", "p_fecha" "date", "p_fecha_flushing" "date", "p_veterinario_id" "uuid", "p_caballo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."editar_ovulacion"("p_registro_id" "uuid", "p_fecha" "date", "p_fecha_flushing" "date", "p_veterinario_id" "uuid", "p_caballo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ejecutar_venta_caballo"("p_venta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ejecutar_venta_caballo"("p_venta_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."eliminar_ecografia_cria"("p_ecografia_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."eliminar_ecografia_cria"("p_ecografia_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."eliminar_ecografia_cria"("p_ecografia_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."eliminar_embrion_cria"("p_embrion_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."eliminar_embrion_cria"("p_embrion_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."eliminar_embrion_cria"("p_embrion_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."eliminar_flushing_cria"("p_flushing_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."eliminar_flushing_cria"("p_flushing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."eliminar_flushing_cria"("p_flushing_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."eliminar_recordatorio_cria"("p_recordatorio_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."eliminar_recordatorio_cria"("p_recordatorio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."eliminar_recordatorio_cria"("p_recordatorio_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."eliminar_registro_cria"("p_registro_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."eliminar_registro_cria"("p_registro_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."eliminar_registro_cria"("p_registro_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."eliminar_transferencia_cria"("p_transferencia_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."eliminar_transferencia_cria"("p_transferencia_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."eliminar_transferencia_cria"("p_transferencia_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."es_admin"("p_sociedad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."es_admin"("p_sociedad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_admin"("p_sociedad_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."es_familiar_directo"("p_a" "uuid", "p_b" "uuid", "p_gen" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."es_familiar_directo"("p_a" "uuid", "p_b" "uuid", "p_gen" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_familiar_directo"("p_a" "uuid", "p_b" "uuid", "p_gen" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."es_veterinario"("p_sociedad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."es_veterinario"("p_sociedad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_veterinario"("p_sociedad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_auditar"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_alertas_vet"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_alertas_vet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_alertas_vet"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_caballos_pedigree_vet"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_caballos_pedigree_vet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_caballos_pedigree_vet"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_caballos_propios_vet"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_caballos_propios_vet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_caballos_propios_vet"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_caballos_propios_vet_inactivos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_caballos_propios_vet_inactivos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_caballos_propios_vet_inactivos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_caballos_sociedad"("p_sociedad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_caballos_sociedad"("p_sociedad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_caballos_sociedad"("p_sociedad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_caballos_veterinario"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_caballos_veterinario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_caballos_veterinario"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_configuracion_cria_efectiva"("p_veterinario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_configuracion_cria_efectiva"("p_veterinario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_configuracion_cria_efectiva"("p_veterinario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_consultas_recientes_vet"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_consultas_recientes_vet"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_sociedad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_sociedad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_sociedad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_empresas_visibles"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_empresas_visibles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_empresas_visibles"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_mis_accesos_modulo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_mis_accesos_modulo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mis_accesos_modulo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_padrillos_familiares"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_padrillos_familiares"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_padrillos_familiares"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sociedades_activas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sociedades_activas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_veterinarios_plataforma"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_veterinarios_plataforma"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_asignaciones_torneo"("p_torneo_id" "uuid", "p_jugador_id" "uuid", "p_caballo_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_asignaciones_torneo"("p_torneo_id" "uuid", "p_jugador_id" "uuid", "p_caballo_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."guardar_asignaciones_torneo"("p_torneo_id" "uuid", "p_jugador_id" "uuid", "p_caballo_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_ranking_padrillos"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_ranking_padrillos"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."guardar_ranking_padrillos"("p_donante_id" "uuid", "p_padrillo_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mp_registrar_pago"("p_preapproval_id" "text", "p_payment_id" "text", "p_estado" "text", "p_monto" numeric, "p_moneda" "text", "p_fecha" timestamp with time zone, "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mp_registrar_pago"("p_preapproval_id" "text", "p_payment_id" "text", "p_estado" "text", "p_monto" numeric, "p_moneda" "text", "p_fecha" timestamp with time zone, "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mp_registrar_preapproval"("p_usuario_id" "uuid", "p_preapproval_id" "text", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mp_registrar_preapproval"("p_usuario_id" "uuid", "p_preapproval_id" "text", "p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mp_sincronizar_suscripcion"("p_preapproval_id" "text", "p_status" "text", "p_next_payment_date" timestamp with time zone, "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mp_sincronizar_suscripcion"("p_preapproval_id" "text", "p_status" "text", "p_next_payment_date" timestamp with time zone, "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."puede_gestionar_campo"("p_sociedad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."puede_gestionar_campo"("p_sociedad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."puede_gestionar_campo"("p_sociedad_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."puede_gestionar_ficha_caballo"("p_sociedad_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."puede_gestionar_ficha_caballo"("p_sociedad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."puede_gestionar_ficha_caballo"("p_sociedad_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."puede_gestionar_polo"("p_sociedad_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."puede_gestionar_polo"("p_sociedad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."puede_gestionar_polo"("p_sociedad_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reactivar_caballos_veterinario"("p_caballo_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reactivar_caballos_veterinario"("p_caballo_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivar_caballos_veterinario"("p_caballo_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_acto_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_fecha" "date", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_utero" "text"[], "p_obs_chips" "text"[], "p_observaciones" "text", "p_veterinario_id" "uuid", "p_rol_reproductivo" "text", "p_padrillo_id" "uuid", "p_ov_dias" smallint, "p_review_dias" smallint, "p_review_desc" "text", "p_fecha_flushing_programada" "date", "p_motivo" "text", "p_diagnostico" "text", "p_tratamiento" "text", "p_origen_recordatorio_id" "uuid", "p_ajustes_fin_semana" "jsonb", "p_dias_revision_1pg" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_acto_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_fecha" "date", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_utero" "text"[], "p_obs_chips" "text"[], "p_observaciones" "text", "p_veterinario_id" "uuid", "p_rol_reproductivo" "text", "p_padrillo_id" "uuid", "p_ov_dias" smallint, "p_review_dias" smallint, "p_review_desc" "text", "p_fecha_flushing_programada" "date", "p_motivo" "text", "p_diagnostico" "text", "p_tratamiento" "text", "p_origen_recordatorio_id" "uuid", "p_ajustes_fin_semana" "jsonb", "p_dias_revision_1pg" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_acto_reproductivo"("p_caballo_id" "uuid", "p_sociedad_id" "uuid", "p_fecha" "date", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_utero" "text"[], "p_obs_chips" "text"[], "p_observaciones" "text", "p_veterinario_id" "uuid", "p_rol_reproductivo" "text", "p_padrillo_id" "uuid", "p_ov_dias" smallint, "p_review_dias" smallint, "p_review_desc" "text", "p_fecha_flushing_programada" "date", "p_motivo" "text", "p_diagnostico" "text", "p_tratamiento" "text", "p_origen_recordatorio_id" "uuid", "p_ajustes_fin_semana" "jsonb", "p_dias_revision_1pg" smallint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_resultado_ecografia"("p_transferencia_id" "uuid", "p_numero" smallint, "p_fecha" "date", "p_resultado" "text", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_notas" "text", "p_origen_recordatorio_id" "uuid", "p_revision_dias" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_resultado_ecografia"("p_transferencia_id" "uuid", "p_numero" smallint, "p_fecha" "date", "p_resultado" "text", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_notas" "text", "p_origen_recordatorio_id" "uuid", "p_revision_dias" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_resultado_ecografia"("p_transferencia_id" "uuid", "p_numero" smallint, "p_fecha" "date", "p_resultado" "text", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_notas" "text", "p_origen_recordatorio_id" "uuid", "p_revision_dias" smallint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_transferencia_embrionaria"("p_sociedad_id" "uuid", "p_fecha" "date", "p_caballo_receptora_id" "uuid", "p_caballo_donante_id" "uuid", "p_embrion_id" "uuid", "p_padrillo_id" "uuid", "p_flushing_id" "uuid", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_cl_calidad" "text", "p_tono_uterino" "text", "p_tono_cervical" "text", "p_clasificacion" "text", "p_notas" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_transferencia_embrionaria"("p_sociedad_id" "uuid", "p_fecha" "date", "p_caballo_receptora_id" "uuid", "p_caballo_donante_id" "uuid", "p_embrion_id" "uuid", "p_padrillo_id" "uuid", "p_flushing_id" "uuid", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_cl_calidad" "text", "p_tono_uterino" "text", "p_tono_cervical" "text", "p_clasificacion" "text", "p_notas" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_transferencia_embrionaria"("p_sociedad_id" "uuid", "p_fecha" "date", "p_caballo_receptora_id" "uuid", "p_caballo_donante_id" "uuid", "p_embrion_id" "uuid", "p_padrillo_id" "uuid", "p_flushing_id" "uuid", "p_ovario_izq" "text"[], "p_ovario_der" "text"[], "p_cl_calidad" "text", "p_tono_uterino" "text", "p_tono_cervical" "text", "p_clasificacion" "text", "p_notas" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_membresia_modulo"("p_membresia_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_membresia_modulo"("p_membresia_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_membresia_modulo"("p_membresia_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_sociedad_modulo"("p_sociedad_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_sociedad_modulo"("p_sociedad_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_sociedad_modulo"("p_sociedad_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_usuario_modulo"("p_usuario_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_usuario_modulo"("p_usuario_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_usuario_modulo"("p_usuario_id" "uuid", "p_modulo_codigo" "text", "p_habilitado" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sincronizar_prenez_ecografia"() TO "anon";
GRANT ALL ON FUNCTION "public"."sincronizar_prenez_ecografia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sincronizar_prenez_ecografia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."superadmin_caballos_propios_por_vet"("p_vet_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."superadmin_caballos_propios_por_vet"("p_vet_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."superadmin_caballos_propios_por_vet"("p_vet_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."superadmin_eliminar_usuario"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."superadmin_eliminar_usuario"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."superadmin_eliminar_usuario"("p_usuario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."tiene_membresia"("p_sociedad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."tiene_membresia"("p_sociedad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tiene_membresia"("p_sociedad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_prenada_veterinario"("p_caballo_id" "uuid", "p_prenada" boolean, "p_fecha_prenez" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_prenada_veterinario"("p_caballo_id" "uuid", "p_prenada" boolean, "p_fecha_prenez" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."transferir_caballos_vet"("p_caballo_ids" "uuid"[], "p_sociedad_destino_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transferir_caballos_vet"("p_caballo_ids" "uuid"[], "p_sociedad_destino_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_trabajo_sanitario_compartir"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_trabajo_sanitario_compartir"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_trabajo_sanitario_compartir"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_campo_caballo"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_campo_caballo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_campo_caballo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."vet_caballos_propios"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vet_caballos_propios"("p_usuario_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vet_estado_limite"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vet_estado_limite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."vet_estado_limite"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."vet_limite_aplicable"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vet_limite_aplicable"("p_usuario_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vet_limite_gratuito"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vet_limite_gratuito"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."vet_limite_gratuito"() TO "service_role";
GRANT ALL ON FUNCTION "public"."vet_limite_gratuito"() TO "anon";



GRANT ALL ON FUNCTION "public"."vet_limite_pago"() TO "anon";
GRANT ALL ON FUNCTION "public"."vet_limite_pago"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."vet_limite_pago"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."vet_puede_agregar_caballo"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vet_puede_agregar_caballo"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vet_puede_agregar_caballo"("p_usuario_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vet_suscripcion_activa"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vet_suscripcion_activa"("p_usuario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."vet_tiene_acceso"("p_caballo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."vet_tiene_acceso"("p_caballo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vet_tiene_acceso"("p_caballo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."vet_tiene_acceso_caballo"("p_caballo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."vet_tiene_acceso_caballo"("p_caballo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vet_tiene_acceso_caballo"("p_caballo_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."acceso_vet" TO "anon";
GRANT ALL ON TABLE "public"."acceso_vet" TO "authenticated";
GRANT ALL ON TABLE "public"."acceso_vet" TO "service_role";



GRANT ALL ON TABLE "public"."acceso_vet_sociedad" TO "anon";
GRANT ALL ON TABLE "public"."acceso_vet_sociedad" TO "authenticated";
GRANT ALL ON TABLE "public"."acceso_vet_sociedad" TO "service_role";



GRANT ALL ON TABLE "public"."alerta" TO "anon";
GRANT ALL ON TABLE "public"."alerta" TO "authenticated";
GRANT ALL ON TABLE "public"."alerta" TO "service_role";



GRANT ALL ON TABLE "public"."alerta_caballo" TO "anon";
GRANT ALL ON TABLE "public"."alerta_caballo" TO "authenticated";
GRANT ALL ON TABLE "public"."alerta_caballo" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."auditoria" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."auditoria" TO "service_role";



GRANT ALL ON TABLE "public"."caballo" TO "anon";
GRANT ALL ON TABLE "public"."caballo" TO "authenticated";
GRANT ALL ON TABLE "public"."caballo" TO "service_role";



GRANT ALL ON TABLE "public"."caballo_tag" TO "anon";
GRANT ALL ON TABLE "public"."caballo_tag" TO "authenticated";
GRANT ALL ON TABLE "public"."caballo_tag" TO "service_role";



GRANT ALL ON TABLE "public"."campo" TO "anon";
GRANT ALL ON TABLE "public"."campo" TO "authenticated";
GRANT ALL ON TABLE "public"."campo" TO "service_role";



GRANT ALL ON TABLE "public"."cat_chip_obs" TO "anon";
GRANT ALL ON TABLE "public"."cat_chip_obs" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_chip_obs" TO "service_role";



GRANT ALL ON TABLE "public"."cat_modulo" TO "anon";
GRANT ALL ON TABLE "public"."cat_modulo" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_modulo" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_modulo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_modulo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_modulo_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_parte_cuerpo" TO "anon";
GRANT ALL ON TABLE "public"."cat_parte_cuerpo" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_parte_cuerpo" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_parte_cuerpo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_parte_cuerpo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_parte_cuerpo_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_pelaje" TO "anon";
GRANT ALL ON TABLE "public"."cat_pelaje" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_pelaje" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_pelaje_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_pelaje_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_pelaje_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_raza" TO "anon";
GRANT ALL ON TABLE "public"."cat_raza" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_raza" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_raza_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_raza_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_raza_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_rol" TO "anon";
GRANT ALL ON TABLE "public"."cat_rol" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_rol" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_rol_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_rol_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_rol_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_tag" TO "anon";
GRANT ALL ON TABLE "public"."cat_tag" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_tag" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_tag_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_tag_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_tag_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_tipo_consulta" TO "anon";
GRANT ALL ON TABLE "public"."cat_tipo_consulta" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_tipo_consulta" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_tipo_consulta_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_tipo_consulta_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_tipo_consulta_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_trabajo_sanitario" TO "anon";
GRANT ALL ON TABLE "public"."cat_trabajo_sanitario" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_trabajo_sanitario" TO "service_role";



GRANT ALL ON TABLE "public"."cria_ecografia" TO "anon";
GRANT ALL ON TABLE "public"."cria_ecografia" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_ecografia" TO "service_role";



GRANT ALL ON TABLE "public"."cria_estado_transicion" TO "anon";
GRANT ALL ON TABLE "public"."cria_estado_transicion" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_estado_transicion" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cria_evento_reproductivo" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cria_evento_reproductivo" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_evento_reproductivo" TO "service_role";



GRANT ALL ON TABLE "public"."cria_flushing" TO "anon";
GRANT ALL ON TABLE "public"."cria_flushing" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_flushing" TO "service_role";



GRANT ALL ON TABLE "public"."cria_padrillo_preferido" TO "anon";
GRANT ALL ON TABLE "public"."cria_padrillo_preferido" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_padrillo_preferido" TO "service_role";



GRANT ALL ON TABLE "public"."cria_parametro" TO "anon";
GRANT ALL ON TABLE "public"."cria_parametro" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_parametro" TO "service_role";



GRANT ALL ON TABLE "public"."cria_plazo_vet" TO "anon";
GRANT ALL ON TABLE "public"."cria_plazo_vet" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_plazo_vet" TO "service_role";



GRANT ALL ON TABLE "public"."cria_recordatorio" TO "anon";
GRANT ALL ON TABLE "public"."cria_recordatorio" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_recordatorio" TO "service_role";



GRANT ALL ON TABLE "public"."cria_registro_clinico" TO "anon";
GRANT ALL ON TABLE "public"."cria_registro_clinico" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_registro_clinico" TO "service_role";



GRANT ALL ON TABLE "public"."cria_regla_recordatorio" TO "anon";
GRANT ALL ON TABLE "public"."cria_regla_recordatorio" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_regla_recordatorio" TO "service_role";



GRANT ALL ON TABLE "public"."cria_reprogramacion" TO "anon";
GRANT ALL ON TABLE "public"."cria_reprogramacion" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_reprogramacion" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cria_seguimiento_gestacion" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cria_seguimiento_gestacion" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_seguimiento_gestacion" TO "service_role";



GRANT ALL ON TABLE "public"."cria_transferencia" TO "anon";
GRANT ALL ON TABLE "public"."cria_transferencia" TO "authenticated";
GRANT ALL ON TABLE "public"."cria_transferencia" TO "service_role";



GRANT ALL ON TABLE "public"."embrion" TO "anon";
GRANT ALL ON TABLE "public"."embrion" TO "authenticated";
GRANT ALL ON TABLE "public"."embrion" TO "service_role";



GRANT ALL ON TABLE "public"."historial_clinico" TO "anon";
GRANT ALL ON TABLE "public"."historial_clinico" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_clinico" TO "service_role";



GRANT ALL ON TABLE "public"."historial_medicamento" TO "anon";
GRANT ALL ON TABLE "public"."historial_medicamento" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_medicamento" TO "service_role";



GRANT ALL ON TABLE "public"."historial_parte_afectada" TO "anon";
GRANT ALL ON TABLE "public"."historial_parte_afectada" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_parte_afectada" TO "service_role";



GRANT ALL ON TABLE "public"."lead" TO "anon";
GRANT ALL ON TABLE "public"."lead" TO "authenticated";
GRANT ALL ON TABLE "public"."lead" TO "service_role";



GRANT ALL ON TABLE "public"."membresia" TO "anon";
GRANT ALL ON TABLE "public"."membresia" TO "authenticated";
GRANT ALL ON TABLE "public"."membresia" TO "service_role";



GRANT ALL ON TABLE "public"."membresia_modulo" TO "anon";
GRANT ALL ON TABLE "public"."membresia_modulo" TO "authenticated";
GRANT ALL ON TABLE "public"."membresia_modulo" TO "service_role";



GRANT ALL ON TABLE "public"."notificacion" TO "anon";
GRANT ALL ON TABLE "public"."notificacion" TO "authenticated";
GRANT ALL ON TABLE "public"."notificacion" TO "service_role";



GRANT ALL ON TABLE "public"."pago_veterinario" TO "anon";
GRANT ALL ON TABLE "public"."pago_veterinario" TO "authenticated";
GRANT ALL ON TABLE "public"."pago_veterinario" TO "service_role";



GRANT ALL ON TABLE "public"."plan_suscripcion_vet" TO "anon";
GRANT ALL ON TABLE "public"."plan_suscripcion_vet" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_suscripcion_vet" TO "service_role";



GRANT ALL ON TABLE "public"."propiedad" TO "anon";
GRANT ALL ON TABLE "public"."propiedad" TO "authenticated";
GRANT ALL ON TABLE "public"."propiedad" TO "service_role";



GRANT ALL ON TABLE "public"."propietario" TO "anon";
GRANT ALL ON TABLE "public"."propietario" TO "authenticated";
GRANT ALL ON TABLE "public"."propietario" TO "service_role";



GRANT ALL ON TABLE "public"."sociedad" TO "anon";
GRANT ALL ON TABLE "public"."sociedad" TO "authenticated";
GRANT ALL ON TABLE "public"."sociedad" TO "service_role";



GRANT ALL ON TABLE "public"."sociedad_modulo" TO "anon";
GRANT ALL ON TABLE "public"."sociedad_modulo" TO "authenticated";
GRANT ALL ON TABLE "public"."sociedad_modulo" TO "service_role";



GRANT ALL ON TABLE "public"."suscripcion_veterinario" TO "anon";
GRANT ALL ON TABLE "public"."suscripcion_veterinario" TO "authenticated";
GRANT ALL ON TABLE "public"."suscripcion_veterinario" TO "service_role";



GRANT ALL ON TABLE "public"."terminos_aceptacion" TO "anon";
GRANT ALL ON TABLE "public"."terminos_aceptacion" TO "authenticated";
GRANT ALL ON TABLE "public"."terminos_aceptacion" TO "service_role";



GRANT ALL ON TABLE "public"."terminos_condiciones" TO "anon";
GRANT ALL ON TABLE "public"."terminos_condiciones" TO "authenticated";
GRANT ALL ON TABLE "public"."terminos_condiciones" TO "service_role";



GRANT ALL ON TABLE "public"."torneo" TO "anon";
GRANT ALL ON TABLE "public"."torneo" TO "authenticated";
GRANT ALL ON TABLE "public"."torneo" TO "service_role";



GRANT ALL ON TABLE "public"."torneo_asignacion" TO "anon";
GRANT ALL ON TABLE "public"."torneo_asignacion" TO "authenticated";
GRANT ALL ON TABLE "public"."torneo_asignacion" TO "service_role";



GRANT ALL ON TABLE "public"."torneo_jugador" TO "anon";
GRANT ALL ON TABLE "public"."torneo_jugador" TO "authenticated";
GRANT ALL ON TABLE "public"."torneo_jugador" TO "service_role";



GRANT ALL ON TABLE "public"."trabajo_sanitario" TO "anon";
GRANT ALL ON TABLE "public"."trabajo_sanitario" TO "authenticated";
GRANT ALL ON TABLE "public"."trabajo_sanitario" TO "service_role";



GRANT ALL ON TABLE "public"."trabajo_sanitario_caballo" TO "anon";
GRANT ALL ON TABLE "public"."trabajo_sanitario_caballo" TO "authenticated";
GRANT ALL ON TABLE "public"."trabajo_sanitario_caballo" TO "service_role";



GRANT ALL ON TABLE "public"."usuario" TO "anon";
GRANT ALL ON TABLE "public"."usuario" TO "authenticated";
GRANT ALL ON TABLE "public"."usuario" TO "service_role";



GRANT ALL ON TABLE "public"."usuario_modulo" TO "anon";
GRANT ALL ON TABLE "public"."usuario_modulo" TO "authenticated";
GRANT ALL ON TABLE "public"."usuario_modulo" TO "service_role";



GRANT ALL ON TABLE "public"."venta_caballo" TO "anon";
GRANT ALL ON TABLE "public"."venta_caballo" TO "authenticated";
GRANT ALL ON TABLE "public"."venta_caballo" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








-- ---------------------------------------------------------------------------
-- Parte 2: trigger sobre auth.users (crea la fila de `usuario` al registrarse)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Parte 3: buckets de Storage (ambos privados)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('caballos', 'caballos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('fichas-historicas', 'fichas-historicas', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Parte 4: policies de storage.objects
-- ---------------------------------------------------------------------------
CREATE POLICY "Crear fichas historicas con aislamiento" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'fichas-historicas'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."membresia" "m"
  WHERE (("m"."sociedad_id" = (("storage"."foldername"("objects"."name"))[1])::"uuid") AND ("m"."usuario_id" = "auth"."uid"()) AND ("m"."activa" = true))))));

CREATE POLICY "Eliminar fichas historicas con aislamiento" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'fichas-historicas'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."membresia" "m"
  WHERE (("m"."sociedad_id" = (("storage"."foldername"("objects"."name"))[1])::"uuid") AND ("m"."usuario_id" = "auth"."uid"()) AND ("m"."activa" = true))))));

CREATE POLICY "Eliminar fotos de caballos con aislamiento" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'caballos'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."caballo" "c"
     JOIN "public"."membresia" "m" ON (("m"."sociedad_id" = "c"."sociedad_id")))
  WHERE (("c"."id" = ("storage"."filename"("objects"."name"))::"uuid") AND ("m"."usuario_id" = "auth"."uid"()) AND ("m"."activa" = true))))));

CREATE POLICY "Eliminar fotos de caballos de vet" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'caballos'::"text") AND ((EXISTS ( SELECT 1
   FROM ("public"."caballo" "c"
     JOIN "public"."acceso_vet" "av" ON (("av"."caballo_id" = "c"."id")))
  WHERE (("c"."id" = ("storage"."filename"("objects"."name"))::"uuid") AND ("av"."vet_id" = "auth"."uid"()) AND ("av"."activo" = true)))) OR (EXISTS ( SELECT 1
   FROM ("public"."caballo" "c"
     JOIN "public"."acceso_vet_sociedad" "avs" ON (("avs"."sociedad_id" = "c"."sociedad_id")))
  WHERE (("c"."id" = ("storage"."filename"("objects"."name"))::"uuid") AND ("avs"."vet_id" = "auth"."uid"()) AND ("avs"."activo" = true)))))));

CREATE POLICY "Reemplazar fotos de caballos" ON "storage"."objects" FOR UPDATE TO "authenticated" USING (("bucket_id" = 'caballos'::"text"));

CREATE POLICY "Subir fotos de caballos" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'caballos'::"text"));

CREATE POLICY "Ver fichas historicas con aislamiento" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'fichas-historicas'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."membresia" "m"
  WHERE (("m"."sociedad_id" = (("storage"."foldername"("objects"."name"))[1])::"uuid") AND ("m"."usuario_id" = "auth"."uid"()) AND ("m"."activa" = true))))));

CREATE POLICY "Ver fotos de caballos autenticado" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'caballos'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."caballo" "c"
     JOIN "public"."membresia" "m" ON (("m"."sociedad_id" = "c"."sociedad_id")))
  WHERE (("c"."id" = ("storage"."filename"("objects"."name"))::"uuid") AND ("m"."usuario_id" = "auth"."uid"()) AND ("m"."activa" = true))))));

CREATE POLICY "Ver fotos de caballos de vet" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'caballos'::"text") AND ((EXISTS ( SELECT 1
   FROM ("public"."caballo" "c"
     JOIN "public"."acceso_vet" "av" ON (("av"."caballo_id" = "c"."id")))
  WHERE (("c"."id" = ("storage"."filename"("objects"."name"))::"uuid") AND ("av"."vet_id" = "auth"."uid"()) AND ("av"."activo" = true)))) OR (EXISTS ( SELECT 1
   FROM ("public"."caballo" "c"
     JOIN "public"."acceso_vet_sociedad" "avs" ON (("avs"."sociedad_id" = "c"."sociedad_id")))
  WHERE (("c"."id" = ("storage"."filename"("objects"."name"))::"uuid") AND ("avs"."vet_id" = "auth"."uid"()) AND ("avs"."activo" = true)))))));

CREATE POLICY "Ver imágenes de consultas autenticado" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'caballos'::"text") AND (("storage"."foldername"("name"))[1] = 'consultas'::"text")));

CREATE POLICY "vets y admins pueden subir imágenes de consultas" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'caballos'::"text") AND (("storage"."foldername"("name"))[1] = 'consultas'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."rol" = 'veterinario'::"text") AND ("u"."activo" = true)))) OR (EXISTS ( SELECT 1
   FROM ("public"."membresia" "m"
     JOIN "public"."cat_rol" "r" ON (("r"."id" = "m"."rol_id")))
  WHERE (("m"."usuario_id" = "auth"."uid"()) AND ("m"."activa" = true) AND (("r"."nombre")::"text" = 'admin'::"text")))))));

