-- La membresía deja de ser ilimitada: pasa a permitir hasta 25 caballos propios.
--
-- Hasta ahora `vet_puede_agregar_caballo` devolvía true sin mirar el conteo
-- cuando había suscripción activa, así que un vet que pagaba podía cargar los
-- que quisiera. La tarjeta de membresía, en cambio, promete "hasta 25 caballos".
-- Se hace verdadera la promesa en vez de cambiar el texto: un tope conocido es
-- más fácil de sostener y de comunicar que uno abierto.
--
-- Nadie está cerca del nuevo tope al aplicar esto (el vet con más caballos
-- propios tiene 7), así que a ningún usuario existente le aparece de golpe el
-- modal de regularización.

CREATE OR REPLACE FUNCTION vet_limite_pago()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 25;
$$;

-- El límite que le corresponde a un vet según tenga o no membresía vigente.
-- Existe para que el número no quede repetido en cada lugar que lo necesita:
-- el alta, la reactivación y el chequeo retroactivo consultan todos acá.
CREATE OR REPLACE FUNCTION vet_limite_aplicable(p_usuario_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN vet_suscripcion_activa(p_usuario_id) THEN vet_limite_pago()
    ELSE vet_limite_gratuito()
  END;
$$;

CREATE OR REPLACE FUNCTION vet_puede_agregar_caballo(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vet_caballos_propios(p_usuario_id) < vet_limite_aplicable(p_usuario_id);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Estado del límite
-- ─────────────────────────────────────────────────────────────────────────────
-- Cambia la forma del retorno, así que hay que dropear antes de recrear.
--
-- `debe_regularizar` ya no exige que la suscripción esté inactiva: ahora
-- también se pasa del tope un vet que paga y cargó más de 25. Los dos límites
-- se devuelven por separado para que la UI pueda decir "hasta N" sin repetir
-- el número.
DROP FUNCTION IF EXISTS vet_estado_limite();

CREATE FUNCTION vet_estado_limite()
RETURNS TABLE(
  caballos_propios     INTEGER,
  limite               INTEGER,   -- el que aplica hoy a este vet
  limite_gratuito      INTEGER,
  limite_con_membresia INTEGER,
  suscripcion_activa   BOOLEAN,
  excedente            INTEGER,
  debe_regularizar     BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Alta: el mensaje tiene que decir qué tope se alcanzó
-- ─────────────────────────────────────────────────────────────────────────────
-- El texto anterior ("sin una suscripción activa") era falso para un vet que
-- paga y llegó a 25: le diría que active algo que ya tiene.
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
SET search_path = public
AS $$
  DECLARE
    v_caballo_id uuid;
  BEGIN
    -- Serializa altas concurrentes del mismo vet para que el check-then-insert
    -- de abajo no pueda evadirse con doble clic o dos pestañas.
    PERFORM pg_advisory_xact_lock(hashtext('vet_limite_caballos'), hashtext(auth.uid()::text));

    IF NOT vet_puede_agregar_caballo(auth.uid()) THEN
      IF vet_suscripcion_activa(auth.uid()) THEN
        RAISE EXCEPTION 'Alcanzaste el límite de % caballos propios de tu membresía.', vet_limite_pago()
          USING ERRCODE = 'HM001';
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Reactivación: el cupo ahora aplica siempre
-- ─────────────────────────────────────────────────────────────────────────────
-- Antes el chequeo se saltaba entero si había suscripción activa, porque el
-- plan pago no tenía tope. Con un tope de 25, reactivar tiene que respetarlo
-- igual que el alta — si no, dar de baja y reactivar sería la forma trivial de
-- pasarse.
CREATE OR REPLACE FUNCTION reactivar_caballos_veterinario(p_caballo_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
  DECLARE
    v_afectados INTEGER;
    v_cupo      INTEGER;
    v_pedidos   INTEGER;
    v_limite    INTEGER;
  BEGIN
    IF p_caballo_ids IS NULL OR array_length(p_caballo_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No seleccionaste ningún caballo para reactivar.';
    END IF;

    -- Mismo lock que el alta: sin esto, dos pestañas reactivando en paralelo
    -- podían leer el mismo cupo antes de que cualquier UPDATE commiteara y
    -- juntas superar el límite.
    PERFORM pg_advisory_xact_lock(hashtext('vet_limite_caballos'), hashtext(auth.uid()::text));

    SELECT COUNT(DISTINCT id)::INTEGER INTO v_pedidos
    FROM unnest(p_caballo_ids) AS t(id);

    PERFORM _vet_valida_propios(p_caballo_ids, FALSE);

    v_limite := vet_limite_aplicable(auth.uid());
    v_cupo   := GREATEST(v_limite - vet_caballos_propios(auth.uid()), 0);

    IF v_pedidos > v_cupo THEN
      IF vet_suscripcion_activa(auth.uid()) THEN
        RAISE EXCEPTION
          'Tu membresía permite hasta % caballos propios, así que solo podés reactivar % más. Seleccionaste %.',
          v_limite, v_cupo, v_pedidos;
      ELSE
        RAISE EXCEPTION
          'Sin una membresía activa solo podés reactivar % caballo(s) más. Seleccionaste %.',
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
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos
-- ─────────────────────────────────────────────────────────────────────────────
-- `vet_estado_limite` se recreó, así que perdió su ACL y hay que reponerla con
-- el mismo criterio de la migración 20260812120500.
REVOKE ALL ON FUNCTION vet_estado_limite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vet_estado_limite() TO authenticated, service_role;

-- `vet_limite_aplicable` toma el usuario por parámetro y es SECURITY DEFINER:
-- abierta a `authenticated`, cualquier logueado podría pasar el UUID de otro y
-- deducir si paga (25 vs 5). Mismo cierre que `vet_suscripcion_activa`.
REVOKE ALL ON FUNCTION vet_limite_aplicable(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION vet_limite_aplicable(UUID) TO service_role;

-- Sin parámetros, no filtra nada de nadie: mismo criterio que vet_limite_gratuito.
GRANT EXECUTE ON FUNCTION vet_limite_pago() TO authenticated, anon, service_role;
