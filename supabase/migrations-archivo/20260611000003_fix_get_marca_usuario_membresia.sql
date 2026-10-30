-- =============================================================================
-- Fix [SEC CRÍTICO] 34: get_marca_usuario no exigía membresía en la sociedad.
--
-- Bug: get_marca_usuario(sociedad_id) buscaba marca por (sociedad_id,
-- dominio_email) sin validar que el usuario tuviese membresía activa en esa
-- sociedad. Como UNIQUE(dominio_email, sociedad_id) permite que dos haras
-- distintos tengan una marca con el mismo dominio, un usuario @losalamos.com
-- con membresía solo en haras A leía caballos de la marca "Los Álamos" en
-- haras B vía caballo_select (predicado marca_id = get_marca_usuario(...)).
-- Mismo leak en historial_clinico_select e historial_propiedad_select.
--
-- Fix: agregar tiene_membresia(p_sociedad_id) como guarda dentro de la
-- función. Al ser FALSE devuelve NULL → el predicado marca_id = NULL no
-- matchea ninguna fila. Un solo cambio cubre las tres policies.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_marca_usuario(p_sociedad_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id
  FROM marca
  WHERE sociedad_id   = p_sociedad_id
    AND dominio_email = email_dominio()
    AND activa        = TRUE
    AND tiene_membresia(p_sociedad_id)
  LIMIT 1;
$$;
