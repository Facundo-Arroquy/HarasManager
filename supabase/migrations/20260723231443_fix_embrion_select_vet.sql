-- =============================================================================
-- Fix: embrion_select era la única policy del módulo de cría que no contemplaba
-- al veterinario. Un vet sin membresía (caso Gero) no veía ningún embrión:
--   - el selector de embriones del modal de transferencia salía vacío, así que
--     la transferencia nunca podía descontar stock;
--   - crearEmbriones() hace .insert().select('*'): el WITH CHECK del INSERT
--     pasaba, pero el RETURNING necesita permiso de SELECT → error → rollback,
--     dejando flushings que declaraban N embriones con 0 filas reales
--     (los 4 flushings de "Any" del 13/06 en Sol de Agosto).
--
-- Se alinea con el patrón del resto del módulo:
--   cria_flushing_select → tiene_membresia OR vet_tiene_acceso(caballo_id)
--   cria_transf_select   → tiene_membresia OR vet_tiene_acceso(receptora/donante)
--
-- Aplicada en prod vía MCP como 20260723231443_fix_embrion_select_vet.
-- =============================================================================

DROP POLICY IF EXISTS "embrion_select" ON public.embrion;
CREATE POLICY "embrion_select" ON public.embrion
  FOR SELECT TO authenticated
  USING (
    tiene_membresia(sociedad_id)
    OR vet_tiene_acceso(caballo_donante_id)
    OR is_superadmin()
  );
