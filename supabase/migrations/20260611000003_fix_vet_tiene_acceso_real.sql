-- =============================================================================
-- Fix [SEC CRÍTICO] 31: vet_tiene_acceso() ignoraba p_caballo_id en prod.
--
-- Bug verificado contra el schema vivo (MCP): la función vivía como
--   SELECT EXISTS (SELECT 1 FROM usuario
--                  WHERE id = auth.uid() AND rol='veterinario' AND activo=TRUE)
-- ignorando el parámetro. Cualquier veterinario activo pasaba 9 policies de RLS:
--   caballo_select_vet;
--   cria_flushing_select / cria_flushing_insert;
--   cria_recordatorio_select / cria_recordatorio_insert;
--   cria_registro_clinico_select / cria_registro_clinico_insert;
--   cria_transferencia_select / cria_transferencia_insert.
-- Y los gates de dos RPCs SECURITY DEFINER:
--   actualizar_caballo_veterinario, toggle_prenada_veterinario.
--
-- El commit 19235e0 ("fix: restaurar verificación real de acceso en
-- vet_tiene_acceso()") nunca llegó al SQL Editor → drift documentado en task 35.
--
-- Fix (mínimo y quirúrgico):
--   1) Reescribir vet_tiene_acceso para que consulte acceso_vet por vet_id +
--      caballo_id activos, y a la vez confirme que el usuario es un veterinario
--      activo (defense in depth).
--   2) Ampliar caballo_select_vet con "OR vet_owner_id = auth.uid()" — el vet
--      sin membresía (caso de Gero) sigue viendo los caballos que él creó.
--   3) Ampliar el gate de las dos RPCs con la misma cláusula para que el vet
--      pueda editar los caballos que él creó aunque no tenga acceso_vet propio.
--
-- Las 8 policies de cria_* no se tocan; ya combinan tiene_membresia OR
-- vet_tiene_acceso, así que el comportamiento queda correcto automáticamente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.vet_tiene_acceso(p_caballo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM acceso_vet av
    JOIN usuario u ON u.id = av.vet_id
    WHERE av.vet_id     = auth.uid()
      AND av.caballo_id = p_caballo_id
      AND av.activo     = TRUE
      AND u.rol         = 'veterinario'
      AND u.activo      = TRUE
  );
$$;

DROP POLICY IF EXISTS "caballo_select_vet" ON public.caballo;
CREATE POLICY "caballo_select_vet"
  ON public.caballo
  FOR SELECT TO authenticated
  USING (
    vet_tiene_acceso(id)
    OR vet_owner_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.actualizar_caballo_veterinario(
  p_caballo_id      uuid,
  p_nombre          text,
  p_fecha_nacimiento date,
  p_categoria       text,
  p_subcategoria    text    DEFAULT NULL,
  p_raza_id         integer DEFAULT NULL,
  p_pelaje_id       integer DEFAULT NULL,
  p_numero_chip     text    DEFAULT NULL,
  p_numero_registro text    DEFAULT NULL,
  p_padre_id        uuid    DEFAULT NULL,
  p_padre_nombre    text    DEFAULT NULL,
  p_madre_id        uuid    DEFAULT NULL,
  p_madre_nombre    text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo
      WHERE id = p_caballo_id AND vet_owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE caballo SET
    nombre           = p_nombre,
    fecha_nacimiento = p_fecha_nacimiento,
    categoria        = p_categoria,
    rol_reproductivo = p_subcategoria,
    raza_id          = p_raza_id,
    pelaje_id        = p_pelaje_id,
    numero_chip      = p_numero_chip,
    numero_registro  = p_numero_registro,
    padre_id         = p_padre_id,
    padre_nombre     = p_padre_nombre,
    madre_id         = p_madre_id,
    madre_nombre     = p_madre_nombre
  WHERE id = p_caballo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_prenada_veterinario(
  p_caballo_id  uuid,
  p_prenada     boolean,
  p_fecha_prenez date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo
      WHERE id = p_caballo_id AND vet_owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sin acceso a este caballo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM caballo WHERE id = p_caballo_id AND categoria = 'Yegua'
  ) THEN
    RAISE EXCEPTION 'Solo se puede marcar preñada a una Yegua';
  END IF;

  UPDATE caballo
  SET
    prenada      = p_prenada,
    fecha_prenez = CASE WHEN p_prenada THEN p_fecha_prenez ELSE NULL END,
    updated_at   = NOW()
  WHERE id = p_caballo_id;
END;
$$;
