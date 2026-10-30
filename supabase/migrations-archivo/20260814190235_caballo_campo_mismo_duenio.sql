-- Un caballo solo puede estar en un campo de su mismo dueño: los de una
-- sociedad en campos de esa sociedad, los propios de un vet en campos de ese
-- vet. Evita que la UI (o un import) cruce campos entre dueños distintos.
--
-- NOTA: esta versión aborta siempre que el campo no coincide. La migración
-- siguiente (`caballo_campo_limpiar_al_cambiar_duenio`) la refina para que un
-- cambio de dueño desasigne el campo en vez de romper la transferencia.

CREATE OR REPLACE FUNCTION public.validar_campo_caballo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campo_sociedad UUID;
  v_campo_vet      UUID;
BEGIN
  IF NEW.campo_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sociedad_id, vet_owner_id
    INTO v_campo_sociedad, v_campo_vet
    FROM campo WHERE id = NEW.campo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El campo indicado no existe.';
  END IF;

  IF NEW.sociedad_id IS NOT NULL THEN
    IF v_campo_sociedad IS DISTINCT FROM NEW.sociedad_id THEN
      RAISE EXCEPTION 'El campo no pertenece a la sociedad del caballo.';
    END IF;
  ELSIF NEW.vet_owner_id IS NOT NULL THEN
    IF v_campo_vet IS DISTINCT FROM NEW.vet_owner_id THEN
      RAISE EXCEPTION 'El campo no pertenece al veterinario dueño del caballo.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Un caballo sin sociedad ni veterinario dueño no puede tener campo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_campo_caballo ON caballo;
CREATE TRIGGER trg_validar_campo_caballo
  BEFORE INSERT OR UPDATE OF campo_id, sociedad_id, vet_owner_id ON caballo
  FOR EACH ROW EXECUTE FUNCTION public.validar_campo_caballo();
