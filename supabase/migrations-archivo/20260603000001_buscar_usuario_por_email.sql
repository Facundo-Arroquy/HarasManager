-- Permite que un admin de cualquier sociedad (o superadmin) busque un usuario
-- por email para poder invitarlo a su haras.
-- SECURITY DEFINER bypasea RLS, pero el WHERE interno valida que el llamante
-- sea admin activo o superadmin antes de retornar datos.
CREATE OR REPLACE FUNCTION buscar_usuario_por_email(p_email text)
RETURNS TABLE(id uuid, nombre text, apellido text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nombre, u.apellido, u.email
  FROM usuario u
  WHERE lower(u.email) = lower(p_email)
    AND u.activo = true
    AND (
      EXISTS (
        SELECT 1 FROM membresia m
        JOIN cat_rol r ON r.id = m.rol_id
        WHERE m.usuario_id = auth.uid()
          AND m.activa = true
          AND r.nombre = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM usuario sa
        WHERE sa.id = auth.uid() AND sa.rol = 'superadmin'
      )
    );
$$;
