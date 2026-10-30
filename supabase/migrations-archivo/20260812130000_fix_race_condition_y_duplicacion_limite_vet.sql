-- Corrige hallazgos de code review sobre el freemium de veterinarios (PR #53):
--
-- 1) Race condition en `crear_caballo_veterinario` y `reactivar_caballos_veterinario`:
--    el check-then-act del cupo (SELECT COUNT sin lock, seguido de INSERT/UPDATE)
--    permitía que dos llamadas concurrentes del mismo vet (doble clic, dos
--    pestañas) leyeran el mismo conteo antes de que cualquiera de las dos
--    commiteara, evadiendo el límite del plan gratuito. Se serializa con un
--    advisory lock transaccional por vet — se libera solo al terminar la
--    transacción, no hace falta unlock manual.
--
-- 2) El bloque de validación de ownership (¿todos los ids son caballos propios
--    del vet, en el estado esperado?) estaba duplicado literal entre
--    `dar_de_baja_caballos_veterinario` y `reactivar_caballos_veterinario`.
--    Se extrae a `_vet_valida_propios`.
--
-- 3) `esLimiteCaballosVet` (frontend) detectaba el error de límite matcheando
--    el texto literal del RAISE EXCEPTION. Ahora usa un SQLSTATE propio
--    ('HM001'), estable ante cambios de redacción o de idioma.
--
-- 4) El superadmin listaba "caballos propios por vet" con una query ad hoc en
--    el cliente que duplicaba el predicado de `vet_caballos_propios` (que ya
--    no es invocable por `authenticated` desde `20260812120500`). Se agrega
--    `superadmin_caballos_propios_por_vet`, una RPC en lote restringida a
--    superadmin, como única fuente de verdad.

-- ── 1) Helper interno: validación de ownership compartida ──────────────────
-- No se otorga EXECUTE a nadie: solo la llaman `dar_de_baja_caballos_veterinario`
-- y `reactivar_caballos_veterinario`, ambas SECURITY DEFINER del mismo owner.
CREATE OR REPLACE FUNCTION _vet_valida_propios(p_caballo_ids UUID[], p_activo_esperado BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM unnest(p_caballo_ids) AS sel(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM caballo c
         WHERE c.id            = sel.id
           AND c.vet_owner_id  = auth.uid()
           AND c.sociedad_id   IS NULL
           AND c.activo        = p_activo_esperado
      )
    ) THEN
      IF p_activo_esperado THEN
        RAISE EXCEPTION 'Alguno de los caballos seleccionados no es tuyo o ya estaba dado de baja.';
      ELSE
        RAISE EXCEPTION 'Alguno de los caballos seleccionados no es tuyo o ya estaba activo.';
      END IF;
    END IF;
  END;
  $function$;

REVOKE ALL ON FUNCTION _vet_valida_propios(UUID[], BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ── 2) crear_caballo_veterinario: advisory lock + errcode estable ──────────
CREATE OR REPLACE FUNCTION crear_caballo_veterinario(
  p_nombre TEXT,
  p_fecha_nacimiento DATE,
  p_categoria TEXT,
  p_raza_id INTEGER,
  p_pelaje_id INTEGER,
  p_numero_chip TEXT DEFAULT NULL,
  p_numero_registro TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DECLARE
    v_caballo_id uuid;
  BEGIN
    -- Serializa altas concurrentes del mismo vet para que el check-then-insert
    -- de abajo no pueda evadirse con doble clic o dos pestañas.
    PERFORM pg_advisory_xact_lock(hashtext('vet_limite_caballos'), hashtext(auth.uid()::text));

    IF NOT vet_puede_agregar_caballo(auth.uid()) THEN
      RAISE EXCEPTION 'Alcanzaste el límite de % caballos propios sin una suscripción activa. Activá tu suscripción para seguir agregando.', vet_limite_gratuito()
        USING ERRCODE = 'HM001';
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
  $function$;

-- ── 3) dar_de_baja_caballos_veterinario: usa el helper compartido ──────────
CREATE OR REPLACE FUNCTION dar_de_baja_caballos_veterinario(p_caballo_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DECLARE
    v_afectados INTEGER;
  BEGIN
    IF p_caballo_ids IS NULL OR array_length(p_caballo_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No seleccionaste ningún caballo para dar de baja.';
    END IF;

    PERFORM _vet_valida_propios(p_caballo_ids, TRUE);

    UPDATE caballo
       SET activo = FALSE
     WHERE id           = ANY(p_caballo_ids)
       AND vet_owner_id = auth.uid()
       AND sociedad_id  IS NULL;

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RETURN v_afectados;
  END;
  $function$;

-- ── 4) reactivar_caballos_veterinario: advisory lock + helper compartido ───
CREATE OR REPLACE FUNCTION reactivar_caballos_veterinario(p_caballo_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DECLARE
    v_afectados INTEGER;
    v_cupo      INTEGER;
    v_pedidos   INTEGER;
  BEGIN
    IF p_caballo_ids IS NULL OR array_length(p_caballo_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No seleccionaste ningún caballo para reactivar.';
    END IF;

    -- Mismo lock que el alta: sin esto, dos pestañas reactivando en paralelo
    -- podían leer el mismo cupo antes de que cualquier UPDATE commiteara y
    -- juntas superar el límite del plan gratuito.
    PERFORM pg_advisory_xact_lock(hashtext('vet_limite_caballos'), hashtext(auth.uid()::text));

    SELECT COUNT(DISTINCT id)::INTEGER INTO v_pedidos
    FROM unnest(p_caballo_ids) AS t(id);

    PERFORM _vet_valida_propios(p_caballo_ids, FALSE);

    IF NOT vet_suscripcion_activa(auth.uid()) THEN
      v_cupo := GREATEST(vet_limite_gratuito() - vet_caballos_propios(auth.uid()), 0);
      IF v_pedidos > v_cupo THEN
        RAISE EXCEPTION
          'Sin una suscripción activa solo podés reactivar % caballo(s) más. Seleccionaste %.',
          v_cupo, v_pedidos;
      END IF;
    END IF;

    UPDATE caballo
       SET activo = TRUE
     WHERE id           = ANY(p_caballo_ids)
       AND vet_owner_id = auth.uid()
       AND sociedad_id  IS NULL;

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RETURN v_afectados;
  END;
  $function$;

-- ── 5) RPC en lote para el superadmin: única fuente de verdad del conteo ───
-- Antes `superAdminService.listarVeterinarios()` reimplementaba el predicado
-- de `vet_caballos_propios` con una query directa a `caballo`, porque esa
-- función solo acepta un usuario a la vez y ya no es invocable por
-- `authenticated`. Si el predicado cambia server-side, esta duplicación podía
-- desincronizarse en silencio.
CREATE OR REPLACE FUNCTION superadmin_caballos_propios_por_vet(p_vet_ids UUID[])
RETURNS TABLE(vet_owner_id UUID, cantidad INTEGER)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  $function$;

REVOKE ALL ON FUNCTION superadmin_caballos_propios_por_vet(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION superadmin_caballos_propios_por_vet(UUID[]) TO authenticated;

-- ── 6) vet_limite_gratuito() a anon: es una constante pública sin datos de
-- usuario (a diferencia de vet_caballos_propios/vet_suscripcion_activa, que sí
-- se revocaron de anon). La página pública de registro la necesita para no
-- hardcodear el número del plan gratuito en el marketing copy.
GRANT EXECUTE ON FUNCTION vet_limite_gratuito() TO anon;
