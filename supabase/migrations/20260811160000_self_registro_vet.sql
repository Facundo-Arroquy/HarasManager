-- Auto-registro público de veterinario. En vez de una Edge Function separada
-- invocada después de signUp() (que tendría un modo de falla real: si el
-- proyecto exige confirmación de email no hay sesión todavía para autorizar
-- la llamada, y si falla después de que signUp() ya creó el usuario, queda
-- un usuario huérfano con rol 'admin' por default), se extiende el trigger
-- que YA corre atómicamente en cada INSERT de auth.users. El frontend pasa
-- `rol_solicitado: 'veterinario'` en el metadata de auth.signUp(); si no
-- viene ese flag, el comportamiento es idéntico al de antes (rol 'admin').
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rol_solicitado text := NEW.raw_user_meta_data->>'rol_solicitado';
BEGIN
  INSERT INTO public.usuario (id, nombre, apellido, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre',   'Sin nombre'),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.email,
    CASE WHEN v_rol_solicitado = 'veterinario' THEN 'veterinario' ELSE 'admin' END
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
