-- ─────────────────────────────────────────────────────────────────────────────
-- Plan comercial de la empresa (silver / gold / diamond)
--
-- El plan pasa a ser el interruptor maestro del Centro de Cría: en vez de un
-- toggle suelto que el superadmin prendía a mano, `sociedad.acceso_centro_cria`
-- se deriva del plan contratado. Así los dos no pueden quedar en desacuerdo.
--
-- El permiso por usuario (`membresia.acceso_centro_cria`) no cambia: lo sigue
-- otorgando el admin de la empresa o el superadmin, y sólo tiene efecto si la
-- empresa tiene el módulo habilitado por su plan.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE plan_sociedad AS ENUM ('silver', 'gold', 'diamond');

ALTER TABLE sociedad
  ADD COLUMN plan plan_sociedad NOT NULL DEFAULT 'silver';

-- Backfill: las empresas que hoy tienen el módulo pasan a gold, el resto silver.
UPDATE sociedad SET plan = 'gold' WHERE acceso_centro_cria IS TRUE;

-- `acceso_centro_cria` deja de escribirse a mano y pasa a derivarse del plan.
-- Al ser generada, ya no hay forma de que un admin se la auto-otorgue vía la
-- policy `sociedad_update` (que permite UPDATE a es_admin sobre toda la fila).
ALTER TABLE sociedad DROP COLUMN acceso_centro_cria;

ALTER TABLE sociedad
  ADD COLUMN acceso_centro_cria BOOLEAN
  GENERATED ALWAYS AS (plan <> 'silver'::plan_sociedad) STORED;

-- ── El plan sólo lo cambia el superadmin ─────────────────────────────────────
-- `sociedad_update` deja al admin de la empresa actualizar su propia fila, así
-- que sin esto podría subirse el plan solo y habilitarse el módulo.

CREATE OR REPLACE FUNCTION bloquear_cambio_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- auth.uid() NULL = conexión sin JWT (service role o SQL directo), ya confiable.
  -- Un admin de empresa siempre viaja con JWT, así que sigue bloqueado. El rol
  -- anon no llega acá: RLS lo frena antes.
  IF NEW.plan IS DISTINCT FROM OLD.plan
     AND auth.uid() IS NOT NULL
     AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Solo el superadmin puede cambiar el plan de la empresa';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION bloquear_cambio_plan() FROM anon;

CREATE TRIGGER trg_bloquear_cambio_plan
  BEFORE UPDATE ON sociedad
  FOR EACH ROW
  EXECUTE FUNCTION bloquear_cambio_plan();

-- ── Animales del Centro de Cría visibles para un veterinario ─────────────────
-- Los veterinarios son usuarios globales: acceden a caballos de varias empresas
-- vía `acceso_vet`. Para ellos "la empresa no tiene el módulo" se traduce en no
-- ver esos animales dentro del Centro de Cría. El RPC general
-- `get_caballos_veterinario` no se toca: lo usan Caballos, Sanidad y Alertas,
-- que no dependen del plan.

CREATE OR REPLACE FUNCTION get_caballos_veterinario_cria()
RETURNS TABLE(
  id uuid, nombre text, fecha_nacimiento date, categoria text,
  rol_reproductivo text, numero_chip text, numero_registro text,
  activo boolean, sociedad_id uuid, empresa_nombre text, campo_id uuid,
  raza_id integer, pelaje_id integer, padre_id uuid, padre_nombre text,
  madre_id uuid, madre_nombre text, raza_nombre text, pelaje_nombre text,
  campo_nombre text, propietario_nombre text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id, c.nombre, c.fecha_nacimiento,
    c.categoria, c.rol_reproductivo,
    c.numero_chip, c.numero_registro,
    c.activo, c.sociedad_id,
    s.nombre   AS empresa_nombre,
    c.campo_id, c.raza_id, c.pelaje_id,
    c.padre_id, c.padre_nombre, c.madre_id, c.madre_nombre,
    r.nombre   AS raza_nombre,
    pel.nombre AS pelaje_nombre,
    ca.nombre  AS campo_nombre,
    pr.nombre  AS propietario_nombre
  FROM acceso_vet av
  JOIN caballo  c ON c.id = av.caballo_id
  JOIN sociedad s ON s.id = c.sociedad_id AND s.acceso_centro_cria = TRUE
  LEFT JOIN cat_raza     r   ON r.id   = c.raza_id
  LEFT JOIN cat_pelaje   pel ON pel.id = c.pelaje_id
  LEFT JOIN campo        ca  ON ca.id  = c.campo_id
  LEFT JOIN propiedad    pp  ON pp.caballo_id = c.id AND pp.fecha_fin IS NULL
  LEFT JOIN propietario  pr  ON pr.id  = pp.propietario_id
  WHERE av.vet_id = auth.uid()
    AND av.activo = TRUE
    AND c.activo  = TRUE
  ORDER BY c.nombre;
$$;

REVOKE ALL ON FUNCTION get_caballos_veterinario_cria() FROM anon;
GRANT EXECUTE ON FUNCTION get_caballos_veterinario_cria() TO authenticated;
