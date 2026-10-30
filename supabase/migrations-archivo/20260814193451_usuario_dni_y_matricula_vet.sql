-- DNI y matrícula profesional del veterinario.
--
-- Las columnas son nullable a propósito: los 7 vets ya registrados no tienen
-- estos datos y no se los podemos inventar. La obligatoriedad del DNI se
-- aplica en el alta (trigger `handle_new_auth_user`), no con un NOT NULL ni un
-- CHECK que dejaría a esas filas en estado inválido.

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS dni       VARCHAR(20);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS matricula VARCHAR(50);

COMMENT ON COLUMN usuario.dni       IS 'DNI. Obligatorio al registrarse como veterinario; NULL en los usuarios previos.';
COMMENT ON COLUMN usuario.matricula IS 'Matrícula profesional del veterinario. Opcional.';

-- El alta de vet ahora exige DNI y guarda la matrícula si vino.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rol_solicitado text := NEW.raw_user_meta_data->>'rol_solicitado';
  v_dni            text := NULLIF(TRIM(NEW.raw_user_meta_data->>'dni'), '');
  v_matricula      text := NULLIF(TRIM(NEW.raw_user_meta_data->>'matricula'), '');
BEGIN
  IF v_rol_solicitado = 'veterinario' AND v_dni IS NULL THEN
    RAISE EXCEPTION 'El DNI es obligatorio para registrarse como veterinario.'
      USING ERRCODE = 'HM003';
  END IF;

  INSERT INTO public.usuario (id, nombre, apellido, email, rol, dni, matricula)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre',   'Sin nombre'),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.email,
    CASE WHEN v_rol_solicitado = 'veterinario' THEN 'veterinario' ELSE 'admin' END,
    v_dni,
    v_matricula
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_rol_solicitado = 'veterinario' THEN
    INSERT INTO public.suscripcion_veterinario (usuario_id, estado)
    VALUES (NEW.id, 'inactiva')
    ON CONFLICT (usuario_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- "Por ahora nada editable": el DNI y la matrícula no se cambian desde la
-- propia sesión. Sin esto la policy `usuario_update_propio` (id = auth.uid())
-- dejaría reescribirlos por API aunque la UI no los ofrezca.
CREATE OR REPLACE FUNCTION public.bloquear_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() = NEW.id THEN
    IF (NEW.rol    IS DISTINCT FROM OLD.rol)
    OR (NEW.activo IS DISTINCT FROM OLD.activo)
    OR (NEW.email  IS DISTINCT FROM OLD.email)
    THEN
      RAISE EXCEPTION
        'No se pueden modificar rol/activo/email desde la propia sesión';
    END IF;

    IF (NEW.dni       IS DISTINCT FROM OLD.dni)
    OR (NEW.matricula IS DISTINCT FROM OLD.matricula)
    THEN
      RAISE EXCEPTION
        'El DNI y la matrícula no se pueden modificar desde la propia sesión';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
