-- Refina la validación de campo_id: cuando un caballo cambia de dueño
-- (transferencia a otra sociedad, o de un vet a una organización) el campo
-- viejo deja de aplicar, así que se desasigna en lugar de abortar la
-- transferencia. Asignar a mano un campo de otro dueño sigue siendo un error.
--
-- Sin esto, `transferEmpresaService.transferir()` (que hace UPDATE de
-- sociedad_id sin tocar campo_id) fallaba para todo caballo con campo asignado.

CREATE OR REPLACE FUNCTION public.validar_campo_caballo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
