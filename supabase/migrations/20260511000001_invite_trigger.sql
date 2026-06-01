-- =============================================================================
-- Migración: Trigger para auto-crear usuario público al registrar en auth.users
--
-- Cuando un admin invita a un usuario via signUp(), Supabase crea el registro
-- en auth.users. Este trigger lo espeja automáticamente en public.usuario
-- usando el raw_user_meta_data (nombre, apellido) enviado en el signUp.
--
-- Nota: SECURITY DEFINER permite que la función escriba en public.usuario
-- incluso con RLS activo (equivale a service_role para esa operación puntual).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuario (id, nombre, apellido, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre',   'Sin nombre'),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Solo crea el trigger si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
  END IF;
END;
$$;
