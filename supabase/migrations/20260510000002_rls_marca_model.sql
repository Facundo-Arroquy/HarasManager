-- =============================================================================
-- Migración 7: RLS actualizado para modelo de marcas
--
-- Reemplaza las políticas de propietario/propiedad (ya eliminadas) y actualiza
-- caballo e historial_clinico para el nuevo modelo de acceso por dominio.
--
-- Lógica de acceso:
--   • Propietario → usuario cuyo email domain coincide con marca.dominio_email
--   • Veterinario → acceso explícito en acceso_veterinario (masivo o individual)
--   • Admin del haras → admin en membresia SIN marca propia en la sociedad
--   • Admin de marca → admin en membresia CON marca cuyo dominio = su email domain
-- =============================================================================

-- =============================================================================
-- Funciones auxiliares
-- =============================================================================

-- Dominio del email del usuario autenticado (parte después del @)
CREATE OR REPLACE FUNCTION email_dominio()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT split_part(auth.jwt() ->> 'email', '@', 2);
$$;

-- Retorna el id de la marca del usuario en una sociedad dada (por dominio de email).
-- NULL si el usuario no pertenece a ninguna marca de esa sociedad.
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
  LIMIT 1;
$$;

-- ¿El usuario autenticado es admin de una marca específica?
-- (tiene rol admin en membresia Y su email domain = dominio de esa marca)
CREATE OR REPLACE FUNCTION es_admin_marca(p_marca_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membresia m
    JOIN cat_rol   r  ON r.id  = m.rol_id
    JOIN marca     ma ON ma.id = p_marca_id
    WHERE m.usuario_id  = auth.uid()
      AND m.sociedad_id = ma.sociedad_id
      AND m.activa      = TRUE
      AND r.nombre      = 'admin'
      AND email_dominio() = ma.dominio_email
  );
$$;

-- ¿El vet autenticado tiene acceso a un caballo?
-- Verdadero si tiene acceso masivo (por marca) o acceso individual (por caballo).
CREATE OR REPLACE FUNCTION vet_tiene_acceso(p_caballo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM acceso_veterinario av
    WHERE av.vet_id = auth.uid()
      AND av.activo = TRUE
      AND (
        -- Acceso individual al caballo
        av.caballo_id = p_caballo_id
        OR
        -- Acceso masivo a la marca del caballo
        av.marca_id = (SELECT marca_id FROM caballo WHERE id = p_caballo_id)
      )
  );
$$;

-- ¿El usuario es admin del haras sin marca propia? (puede ver todo)
-- Distingue al admin del haras del admin de marca.
CREATE OR REPLACE FUNCTION es_admin_haras(p_sociedad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membresia m
    JOIN cat_rol r ON r.id = m.rol_id
    WHERE m.usuario_id  = auth.uid()
      AND m.sociedad_id = p_sociedad_id
      AND m.activa      = TRUE
      AND r.nombre      = 'admin'
      -- Admin del haras: sin marca asociada a su dominio en esta sociedad
      AND NOT EXISTS (
        SELECT 1 FROM marca
        WHERE sociedad_id   = p_sociedad_id
          AND dominio_email = email_dominio()
          AND activa        = TRUE
      )
  );
$$;

-- =============================================================================
-- MARCA
-- =============================================================================

ALTER TABLE marca ENABLE ROW LEVEL SECURITY;

-- Un usuario ve su propia marca; el admin del haras ve todas las marcas de la sociedad
CREATE POLICY "marca_select"
  ON marca FOR SELECT TO authenticated
  USING (
    tiene_membresia(sociedad_id)
    AND (
      dominio_email = email_dominio()        -- propietario de esa marca
      OR es_admin_haras(sociedad_id)         -- admin del haras ve todas
    )
  );

-- Solo admin del haras puede crear marcas (service_role también puede)
CREATE POLICY "marca_insert"
  ON marca FOR INSERT TO authenticated
  WITH CHECK (es_admin_haras(sociedad_id));

-- Admin del haras o admin de esa marca puede actualizar
CREATE POLICY "marca_update"
  ON marca FOR UPDATE TO authenticated
  USING (
    es_admin_haras(sociedad_id) OR es_admin_marca(id)
  )
  WITH CHECK (
    es_admin_haras(sociedad_id) OR es_admin_marca(id)
  );

-- =============================================================================
-- CABALLO — reemplazar políticas anteriores
-- =============================================================================

DROP POLICY IF EXISTS "caballo_select"  ON caballo;
DROP POLICY IF EXISTS "caballo_insert"  ON caballo;
DROP POLICY IF EXISTS "caballo_update"  ON caballo;

-- SELECT: propietario (misma marca) | vet con acceso | admin del haras
CREATE POLICY "caballo_select"
  ON caballo FOR SELECT TO authenticated
  USING (
    -- Propietario: usuario cuyo dominio = marca del caballo
    (marca_id IS NOT NULL AND marca_id = get_marca_usuario(sociedad_id))
    OR
    -- Veterinario con acceso explícito concedido
    (es_veterinario(sociedad_id) AND vet_tiene_acceso(id))
    OR
    -- Admin del haras: ve todos los caballos de la sociedad
    es_admin_haras(sociedad_id)
  );

-- INSERT: solo admin del haras (o service_role para bulk imports)
CREATE POLICY "caballo_insert"
  ON caballo FOR INSERT TO authenticated
  WITH CHECK (es_admin_haras(sociedad_id));

-- UPDATE: admin del haras (datos generales); admin de marca solo sus caballos
CREATE POLICY "caballo_update"
  ON caballo FOR UPDATE TO authenticated
  USING (
    es_admin_haras(sociedad_id)
    OR (marca_id IS NOT NULL AND es_admin_marca(marca_id))
  )
  WITH CHECK (
    es_admin_haras(sociedad_id)
    OR (marca_id IS NOT NULL AND es_admin_marca(marca_id))
  );

-- =============================================================================
-- HISTORIAL CLÍNICO — reemplazar política SELECT
-- =============================================================================

DROP POLICY IF EXISTS "historial_clinico_select" ON historial_clinico;

-- El acceso al historial sigue el acceso al caballo
CREATE POLICY "historial_clinico_select"
  ON historial_clinico FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM caballo c
      WHERE c.id = historial_clinico.caballo_id
        AND (
          (c.marca_id IS NOT NULL AND c.marca_id = get_marca_usuario(c.sociedad_id))
          OR (es_veterinario(c.sociedad_id) AND vet_tiene_acceso(c.id))
          OR es_admin_haras(c.sociedad_id)
        )
    )
  );

-- Las políticas de INSERT y UPDATE del historial (solo creado_por) no cambian

-- =============================================================================
-- HISTORIAL_PARTE_AFECTADA y HISTORIAL_MEDICAMENTO
-- Las políticas existentes derivan del historial_clinico → no cambian
-- =============================================================================

-- =============================================================================
-- ACCESO_VETERINARIO
-- =============================================================================

ALTER TABLE acceso_veterinario ENABLE ROW LEVEL SECURITY;

-- El vet ve sus propios accesos
CREATE POLICY "acceso_vet_select_vet"
  ON acceso_veterinario FOR SELECT TO authenticated
  USING (vet_id = auth.uid());

-- El admin de marca ve los accesos que otorgó sobre su marca
CREATE POLICY "acceso_vet_select_admin"
  ON acceso_veterinario FOR SELECT TO authenticated
  USING (
    (marca_id   IS NOT NULL AND es_admin_marca(marca_id))
    OR
    (caballo_id IS NOT NULL AND es_admin_marca(
      (SELECT marca_id FROM caballo WHERE id = caballo_id)
    ))
    OR
    es_admin_haras(
      (SELECT sociedad_id FROM marca WHERE id = COALESCE(
        marca_id,
        (SELECT marca_id FROM caballo WHERE id = caballo_id)
      ))
    )
  );

-- El admin de marca puede otorgar acceso sobre sus caballos
CREATE POLICY "acceso_vet_insert"
  ON acceso_veterinario FOR INSERT TO authenticated
  WITH CHECK (
    (marca_id   IS NOT NULL AND es_admin_marca(marca_id))
    OR
    (caballo_id IS NOT NULL AND es_admin_marca(
      (SELECT marca_id FROM caballo WHERE id = caballo_id)
    ))
  );

-- El admin de marca puede revocar (activo = FALSE) accesos sobre sus caballos
CREATE POLICY "acceso_vet_update"
  ON acceso_veterinario FOR UPDATE TO authenticated
  USING (
    (marca_id   IS NOT NULL AND es_admin_marca(marca_id))
    OR
    (caballo_id IS NOT NULL AND es_admin_marca(
      (SELECT marca_id FROM caballo WHERE id = caballo_id)
    ))
  )
  WITH CHECK (
    (marca_id   IS NOT NULL AND es_admin_marca(marca_id))
    OR
    (caballo_id IS NOT NULL AND es_admin_marca(
      (SELECT marca_id FROM caballo WHERE id = caballo_id)
    ))
  );

-- =============================================================================
-- HISTORIAL_PROPIEDAD
-- =============================================================================

ALTER TABLE historial_propiedad ENABLE ROW LEVEL SECURITY;

-- Propietario y admin del haras pueden ver el historial de propiedad de sus caballos
CREATE POLICY "historial_propiedad_select"
  ON historial_propiedad FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM caballo c
      WHERE c.id = historial_propiedad.caballo_id
        AND (
          (c.marca_id IS NOT NULL AND c.marca_id = get_marca_usuario(c.sociedad_id))
          OR es_admin_haras(c.sociedad_id)
        )
    )
  );

-- Solo admin del haras puede registrar transferencias
CREATE POLICY "historial_propiedad_insert"
  ON historial_propiedad FOR INSERT TO authenticated
  WITH CHECK (
    es_admin_haras(
      (SELECT sociedad_id FROM caballo WHERE id = caballo_id)
    )
  );

-- UPDATE y DELETE bloqueados (historial inmutable)
