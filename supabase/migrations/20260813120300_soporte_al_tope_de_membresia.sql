-- Distingue los dos topes en el error del alta, para que el frontend pueda
-- ofrecer salidas distintas.
--
-- Los dos casos no se parecen en nada desde el lado del vet:
--
--   * Plan gratuito lleno (5)  → la salida es pagar. Se le ofrece el checkout.
--   * Membresía llena (25)     → ya paga. No hay nada que venderle: la salida
--                                es hablar con nosotros.
--
-- Hasta ahora los dos levantaban `HM001` y el frontend mostraba el mismo cartel
-- de "activá tu suscripción", que para el segundo caso es una pared: le pide
-- hacer algo que ya hizo.
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
        -- HM002: tope de la membresía. El frontend lo traduce en "escribinos".
        RAISE EXCEPTION 'Llegaste al límite de % caballos propios que incluye la membresía de veterinario. Escribinos y lo vemos.', vet_limite_pago()
          USING ERRCODE = 'HM002';
      ELSE
        -- HM001: tope del plan gratuito. El frontend ofrece el checkout.
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
