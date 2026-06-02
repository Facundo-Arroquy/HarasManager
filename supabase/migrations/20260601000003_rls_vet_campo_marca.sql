-- =============================================================================
-- Migración: RLS — campo visible para veterinarios
--
-- Problema: vets no tienen membresia, por lo que la política "campo_select"
-- (que usa tiene_membresia) les bloquea el acceso a la tabla campo.
-- Esto causa 400 en cualquier query que intente hacer join campo(nombre).
--
-- Solución: política adicional que permite a cualquier vet activo leer campos.
-- Es consistente con vet_tiene_acceso() que ya retorna TRUE para todo vet activo.
-- =============================================================================

DROP POLICY IF EXISTS "campo_select_vet" ON public.campo;

CREATE POLICY "campo_select_vet"
  ON public.campo FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuario
      WHERE id     = auth.uid()
        AND rol    = 'veterinario'
        AND activo = TRUE
    )
  );
