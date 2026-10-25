-- =============================================================================
-- Fix: bloquear auto-escalación de privilegios en tabla usuario.
-- Un usuario autenticado no puede cambiar rol/activo/acceso_centro_cria/email
-- aunque la policy usuario_update_propio permita UPDATE en su propia fila.
-- =============================================================================

CREATE OR REPLACE FUNCTION bloquear_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() = NEW.id THEN
    IF (NEW.rol                IS DISTINCT FROM OLD.rol)
    OR (NEW.activo             IS DISTINCT FROM OLD.activo)
    OR (NEW.acceso_centro_cria IS DISTINCT FROM OLD.acceso_centro_cria)
    OR (NEW.email              IS DISTINCT FROM OLD.email)
    THEN
      RAISE EXCEPTION
        'No se pueden modificar rol/activo/acceso_centro_cria/email desde la propia sesión';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bloquear_self_escalation
  BEFORE UPDATE ON public.usuario
  FOR EACH ROW EXECUTE FUNCTION bloquear_self_escalation();
