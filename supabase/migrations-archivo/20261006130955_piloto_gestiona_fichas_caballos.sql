-- El piloto puede crear y editar las fichas de los caballos de su sociedad,
-- incluidos sus tags. La baja y la importación masiva siguen reservadas al
-- admin desde la interfaz.

CREATE OR REPLACE FUNCTION public.puede_gestionar_ficha_caballo(p_sociedad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membresia m
    JOIN cat_rol r ON r.id = m.rol_id
    WHERE m.usuario_id = (SELECT auth.uid())
      AND m.sociedad_id = p_sociedad_id
      AND m.activa = TRUE
      AND r.nombre IN ('admin', 'piloto')
  );
$$;

REVOKE ALL ON FUNCTION public.puede_gestionar_ficha_caballo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_gestionar_ficha_caballo(UUID) TO authenticated;

DROP POLICY IF EXISTS caballo_insert ON public.caballo;
CREATE POLICY caballo_insert ON public.caballo
  FOR INSERT TO authenticated
  WITH CHECK (puede_gestionar_ficha_caballo(sociedad_id));

DROP POLICY IF EXISTS caballo_update ON public.caballo;
CREATE POLICY caballo_update ON public.caballo
  FOR UPDATE TO authenticated
  USING (puede_gestionar_ficha_caballo(sociedad_id))
  WITH CHECK (puede_gestionar_ficha_caballo(sociedad_id));

DROP POLICY IF EXISTS caballo_tag_write ON public.caballo_tag;
CREATE POLICY caballo_tag_write ON public.caballo_tag
  FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR vet_tiene_acceso(caballo_id)
    OR EXISTS (
      SELECT 1
      FROM public.caballo c
      WHERE c.id = caballo_tag.caballo_id
        AND c.sociedad_id IS NOT NULL
        AND puede_gestionar_ficha_caballo(c.sociedad_id)
    )
  )
  WITH CHECK (
    is_superadmin()
    OR vet_tiene_acceso(caballo_id)
    OR EXISTS (
      SELECT 1
      FROM public.caballo c
      WHERE c.id = caballo_tag.caballo_id
        AND c.sociedad_id IS NOT NULL
        AND puede_gestionar_ficha_caballo(c.sociedad_id)
    )
  );
