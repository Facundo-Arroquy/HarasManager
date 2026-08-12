-- Estado del límite freemium de un veterinario independiente.
--
-- Contexto: hasta ahora el límite solo se evaluaba al CREAR un caballo
-- (`vet_puede_agregar_caballo`). Un vet que pagaba un mes, llegaba a 50
-- caballos propios y dejaba de pagar se quedaba con los 50 para siempre:
-- nada volvía a mirar el estado hacia atrás. Esta función es el chequeo
-- retroactivo que faltaba — el frontend la consulta al entrar y, si
-- `debe_regularizar` es true, muestra el modal bloqueante de regularización.
--
-- Ver docs/specs/roles-freemium-veterinarios.md §4.

-- El límite del plan gratuito, en un solo lugar. Antes estaba hardcodeado
-- dentro de `vet_puede_agregar_caballo`; ahora lo comparten esa función y
-- `vet_estado_limite`, así no pueden quedar desincronizadas.
CREATE OR REPLACE FUNCTION vet_limite_gratuito()
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT 5;
$$;

-- Suscripción vigente del vet. Mismo predicado que ya usaba
-- `vet_puede_agregar_caballo`, extraído para no repetirlo en tres lugares.
CREATE OR REPLACE FUNCTION vet_suscripcion_activa(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM suscripcion_veterinario
     WHERE usuario_id = p_usuario_id
       AND estado = 'activa'
       AND (fecha_vencimiento IS NULL OR fecha_vencimiento > NOW())
  );
$$;

-- Caballos propios activos: sin sociedad y con el vet como dueño directo.
-- Los dados de baja (activo = false) no cuentan — por eso la baja lógica
-- alcanza para regularizar y no hace falta borrado real.
CREATE OR REPLACE FUNCTION vet_caballos_propios(p_usuario_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER FROM caballo
   WHERE vet_owner_id = p_usuario_id
     AND sociedad_id IS NULL
     AND activo = TRUE;
$$;

CREATE OR REPLACE FUNCTION vet_puede_agregar_caballo(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT vet_caballos_propios(p_usuario_id) < vet_limite_gratuito()
      OR vet_suscripcion_activa(p_usuario_id);
$$;

-- Estado que consume el frontend. Siempre sobre auth.uid(): un vet solo
-- puede preguntar por sí mismo.
--
-- `debe_regularizar` es la condición del modal: excedió el plan gratuito Y
-- no tiene suscripción vigente. Un vet de haras (con membresía) tiene 0
-- caballos propios, así que nunca cae acá.
CREATE OR REPLACE FUNCTION vet_estado_limite()
RETURNS TABLE(
  caballos_propios   INTEGER,
  limite             INTEGER,
  suscripcion_activa BOOLEAN,
  excedente          INTEGER,
  debe_regularizar   BOOLEAN
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    d.propios,
    d.limite,
    d.susc,
    GREATEST(d.propios - d.limite, 0),
    d.propios > d.limite AND NOT d.susc
  FROM (
    SELECT
      vet_caballos_propios(auth.uid())  AS propios,
      vet_limite_gratuito()             AS limite,
      vet_suscripcion_activa(auth.uid()) AS susc
  ) d;
$$;

REVOKE ALL ON FUNCTION vet_limite_gratuito()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION vet_suscripcion_activa(UUID)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION vet_caballos_propios(UUID)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION vet_estado_limite()            FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION vet_limite_gratuito()        TO authenticated;
GRANT EXECUTE ON FUNCTION vet_suscripcion_activa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION vet_caballos_propios(UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION vet_estado_limite()          TO authenticated;
