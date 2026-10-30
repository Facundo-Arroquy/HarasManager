-- =============================================================================
-- Cleanup: aplicar SOLO después de un smoke test exitoso en prod con la
-- migración 20260810140000 + el frontend nuevo desplegados. Ver
-- docs/BACKEND-API-TASKS.md y el plan de despliegue del PR.
-- =============================================================================

-- 1) Reescribir bloquear_self_escalation() ANTES de tocar la columna que usa.
--    Si se dropea la columna antes de reescribir la función, cualquier UPDATE
--    de un usuario sobre su propia fila en `usuario` empieza a fallar en
--    runtime ("column does not exist"), no solo lo relacionado a módulos.
--    Se preserva SET search_path TO 'public' (presente en la definición real
--    de prod) para no regresionar el hardening existente.
CREATE OR REPLACE FUNCTION bloquear_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
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
  END IF;
  RETURN NEW;
END;
$$;
-- El trigger bloquear_self_escalation (BEFORE UPDATE ON usuario) no cambia:
-- solo se reemplaza el cuerpo de la función que ejecuta.

-- 2) Restos de la PR #47 (confirmado en prod: trigger único sobre `sociedad`,
--    ambas funciones SECURITY DEFINER de 0 argumentos, get_caballos_veterinario_cria
--    sin ninguna referencia en el frontend).
DROP TRIGGER IF EXISTS trg_bloquear_cambio_plan ON sociedad;
DROP FUNCTION IF EXISTS bloquear_cambio_plan();
DROP FUNCTION IF EXISTS get_caballos_veterinario_cria();

-- 3) Columnas viejas — acceso_centro_cria ANTES que plan (dependencia de
--    columna generada: sociedad.acceso_centro_cria = GENERATED ALWAYS AS
--    (plan <> 'silver') STORED depende de sociedad.plan).
ALTER TABLE sociedad  DROP COLUMN IF EXISTS acceso_centro_cria;
ALTER TABLE membresia DROP COLUMN IF EXISTS acceso_centro_cria;
ALTER TABLE usuario   DROP COLUMN IF EXISTS acceso_centro_cria;

-- 4) plan / plan_sociedad — recién ahora, sin dependientes.
ALTER TABLE sociedad DROP COLUMN IF EXISTS plan;
DROP TYPE IF EXISTS plan_sociedad;
