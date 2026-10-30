-- =============================================================================
-- Migración: corrección de políticas RLS que usan es_veterinario(sociedad_id)
--
-- Problema: es_veterinario(sociedad_id) verifica membresía en una sociedad.
-- Los veterinarios son usuarios globales (usuario.rol = 'veterinario') sin
-- entrada en membresia, por lo que esa función siempre retorna FALSE para
-- ellos — bloqueando SELECT e INSERT en todo el módulo de cría.
--
-- Solución: reemplazar es_veterinario(sociedad_id) por vet_tiene_acceso(caballo_id),
-- que verifica usuario.rol = 'veterinario' AND activo = TRUE directamente.
-- =============================================================================

-- ── caballo ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "caballo_select_vet" ON public.caballo;

CREATE POLICY "caballo_select_vet"
  ON public.caballo FOR SELECT TO authenticated
  USING (
    vet_tiene_acceso(id)
  );

DROP POLICY IF EXISTS "caballo_update_rol_reproductivo_vet" ON public.caballo;

CREATE POLICY "caballo_update_rol_reproductivo_vet"
  ON public.caballo FOR UPDATE TO authenticated
  USING     (vet_tiene_acceso(id))
  WITH CHECK (vet_tiene_acceso(id));

COMMENT ON POLICY "caballo_update_rol_reproductivo_vet" ON caballo IS
  'Permite a veterinarios asignar/cambiar rol_reproductivo. '
  'Control fino de columnas pendiente: aplicar en capa de servicio.';

-- ── cria_registro_clinico ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cria_rc_select" ON public.cria_registro_clinico;

CREATE POLICY "cria_rc_select"
  ON public.cria_registro_clinico FOR SELECT TO authenticated
  USING (
    tiene_membresia(sociedad_id)
    OR vet_tiene_acceso(caballo_id)
  );

DROP POLICY IF EXISTS "cria_rc_insert" ON public.cria_registro_clinico;

CREATE POLICY "cria_rc_insert"
  ON public.cria_registro_clinico FOR INSERT TO authenticated
  WITH CHECK (
    vet_tiene_acceso(caballo_id)
    AND veterinario_id = auth.uid()
  );

-- ── cria_recordatorio ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cria_rec_select" ON public.cria_recordatorio;

CREATE POLICY "cria_rec_select"
  ON public.cria_recordatorio FOR SELECT TO authenticated
  USING (
    tiene_membresia(sociedad_id)
    OR vet_tiene_acceso(caballo_id)
  );

DROP POLICY IF EXISTS "cria_rec_insert" ON public.cria_recordatorio;

CREATE POLICY "cria_rec_insert"
  ON public.cria_recordatorio FOR INSERT TO authenticated
  WITH CHECK (
    vet_tiene_acceso(caballo_id)
  );

-- ── cria_flushing ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cria_flushing_select" ON public.cria_flushing;

CREATE POLICY "cria_flushing_select"
  ON public.cria_flushing FOR SELECT TO authenticated
  USING (
    tiene_membresia(sociedad_id)
    OR vet_tiene_acceso(caballo_id)
  );

DROP POLICY IF EXISTS "cria_flushing_insert" ON public.cria_flushing;

CREATE POLICY "cria_flushing_insert"
  ON public.cria_flushing FOR INSERT TO authenticated
  WITH CHECK (
    vet_tiene_acceso(caballo_id)
  );

-- ── cria_transferencia ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cria_transf_select" ON public.cria_transferencia;

CREATE POLICY "cria_transf_select"
  ON public.cria_transferencia FOR SELECT TO authenticated
  USING (
    tiene_membresia(sociedad_id)
    OR vet_tiene_acceso(caballo_receptora_id)
    OR vet_tiene_acceso(caballo_donante_id)
  );

DROP POLICY IF EXISTS "cria_transf_insert" ON public.cria_transferencia;

CREATE POLICY "cria_transf_insert"
  ON public.cria_transferencia FOR INSERT TO authenticated
  WITH CHECK (
    vet_tiene_acceso(caballo_receptora_id)
  );
