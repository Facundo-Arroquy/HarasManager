-- Aplica el límite freemium al alta de caballos propios de un veterinario.
--
-- OJO: `crear_caballo_veterinario` es SECURITY DEFINER y su dueño (postgres)
-- tiene rolbypassrls = true, así que el INSERT que hace adentro de la función
-- NUNCA pasa por la policy RLS de `caballo` (confirmado contra el schema vivo).
-- El frontend siempre crea caballos de vet vía esta función, nunca con un
-- INSERT directo desde el cliente — por eso el gate real tiene que vivir acá
-- adentro. El ajuste de la policy `vet_insert_own_caballo` de abajo es
-- defensa en profundidad para un eventual INSERT directo futuro, no el
-- mecanismo de enforcement real.
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
    IF NOT vet_puede_agregar_caballo(auth.uid()) THEN
      RAISE EXCEPTION 'Alcanzaste el límite de 5 caballos propios sin una suscripción activa. Activá tu suscripción para seguir agregando.';
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

-- Defensa en profundidad (ver comentario arriba): no es el gate real.
ALTER POLICY vet_insert_own_caballo ON caballo
  WITH CHECK (
    vet_owner_id = auth.uid()
    AND sociedad_id IS NULL
    AND vet_puede_agregar_caballo(auth.uid())
  );
