-- Migración: fix campo_delete policy + seguridad funciones
-- Fecha: 2026-06-18

-- ============================================================
-- 1. FIX CRÍTICO: campo_delete policy tenía self-join siempre true
--    m.sociedad_id = m.sociedad_id → m.sociedad_id = campo.sociedad_id
-- ============================================================
DROP POLICY IF EXISTS campo_delete ON public.campo;

CREATE POLICY campo_delete ON public.campo
  FOR DELETE
  TO authenticated
  USING (
    tiene_membresia(sociedad_id)
    AND EXISTS (
      SELECT 1
      FROM membresia m
      JOIN cat_rol r ON r.id = m.rol_id
      WHERE m.usuario_id = auth.uid()
        AND m.sociedad_id = campo.sociedad_id
        AND m.activa = true
        AND r.nombre = ANY(ARRAY['admin', 'jugador', 'piloto'])
    )
  );

-- ============================================================
-- 2. SEGURIDAD: REVOKE EXECUTE FROM anon en funciones de negocio
--    (las helper functions usadas en RLS con rol {public} se dejan intactas)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.actualizar_caballo_veterinario(uuid, text, date, text, text, integer, integer, text, text, uuid, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.actualizar_rol_reproductivo_vet(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.buscar_usuario_por_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_venta_caballo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crear_caballo_veterinario(text, date, text, integer, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ejecutar_venta_caballo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_alertas_vet() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_caballos_veterinario() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_consultas_recientes_vet(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_sociedades_activas() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_veterinarios_plataforma() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_prenada_veterinario(uuid, boolean, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transferir_caballos_vet(uuid[], uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bloquear_self_escalation() FROM anon;

-- ============================================================
-- 3. SEGURIDAD: SET search_path = public en funciones con search_path mutable
--    Evita ataques de schema hijacking
-- ============================================================
ALTER FUNCTION public.trigger_set_updated_at() SET search_path = public;
ALTER FUNCTION public.tiene_membresia(uuid) SET search_path = public;
ALTER FUNCTION public.es_admin(uuid) SET search_path = public;
ALTER FUNCTION public.ejecutar_venta_caballo(uuid) SET search_path = public;
ALTER FUNCTION public.cancelar_venta_caballo(uuid) SET search_path = public;
ALTER FUNCTION public.is_superadmin() SET search_path = public;
ALTER FUNCTION public.puede_gestionar_campo(uuid) SET search_path = public;
ALTER FUNCTION public.es_veterinario(uuid) SET search_path = public;
ALTER FUNCTION public.actualizar_caballo_veterinario(uuid, text, date, text, text, integer, integer, text, text, uuid, text, uuid, text) SET search_path = public;
ALTER FUNCTION public.bloquear_self_escalation() SET search_path = public;
