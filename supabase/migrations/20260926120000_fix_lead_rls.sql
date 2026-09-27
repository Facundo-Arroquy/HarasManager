-- Fix crítico de seguridad: las políticas SELECT y UPDATE de la tabla "lead"
-- estaban abiertas a cualquier usuario autenticado (qual: true).
-- Se restringen a is_superadmin() para que solo el administrador global
-- pueda ver y editar leads comerciales.

-- 1. Eliminar políticas abiertas
DROP POLICY IF EXISTS "lead_select_authenticated" ON public.lead;
DROP POLICY IF EXISTS "lead_update_authenticated" ON public.lead;

-- 2. Crear políticas restringidas a superadmin
CREATE POLICY "lead_select_superadmin"
  ON public.lead
  FOR SELECT
  TO authenticated
  USING ( is_superadmin() );

CREATE POLICY "lead_update_superadmin"
  ON public.lead
  FOR UPDATE
  TO authenticated
  USING ( is_superadmin() );
