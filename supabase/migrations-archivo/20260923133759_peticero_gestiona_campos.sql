-- El peticero pasa a gestionar los campos/caballerizas de su sociedad, igual
-- que admin, jugador y piloto (entra a /config). Antes la matriz del SKILL lo
-- decía pero la función y la policy de DELETE lo dejaban afuera.

CREATE OR REPLACE FUNCTION public.puede_gestionar_campo(p_sociedad_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
      SELECT 1
      FROM membresia m
      JOIN cat_rol r ON r.id = m.rol_id
      WHERE m.usuario_id  = auth.uid()
        AND m.sociedad_id = p_sociedad_id
        AND m.activa      = TRUE
        AND r.nombre IN ('admin', 'jugador', 'piloto', 'peticero')
    );
  $function$;

-- El DELETE tenía la lista de roles inline; pasa a usar la misma función que
-- INSERT/UPDATE para que no se vuelvan a desincronizar.
DROP POLICY IF EXISTS campo_delete ON public.campo;
CREATE POLICY campo_delete ON public.campo
  FOR DELETE
  USING (puede_gestionar_campo(sociedad_id));
