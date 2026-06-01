-- =============================================================================
-- Migración 5: Row Level Security — funciones auxiliares y políticas
-- Depende de: todas las migraciones anteriores.
--
-- Convención de acceso:
--   - service_role (backend)  → bypasa RLS por defecto en Supabase → acceso total
--   - authenticated (frontend) → sujeto a todas las políticas definidas aquí
--   - anon                    → sin acceso (no hay políticas para anon)
--
-- Operaciones sin política = DENY implícito para usuarios autenticados.
-- Eso cubre: INSERT en sociedad/usuario, UPDATE/DELETE en propiedad,
-- DELETE en historial_clinico, etc.
-- =============================================================================

-- =============================================================================
-- Funciones auxiliares (SECURITY DEFINER para leer sin restricciones de RLS)
-- =============================================================================

-- ¿El usuario autenticado tiene membresía activa en la sociedad dada?
CREATE OR REPLACE FUNCTION tiene_membresia(p_sociedad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM membresia
    WHERE usuario_id  = auth.uid()
      AND sociedad_id = p_sociedad_id
      AND activa      = TRUE
  );
$$;

-- ¿El usuario autenticado es admin activo en la sociedad dada?
CREATE OR REPLACE FUNCTION es_admin(p_sociedad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membresia m
    JOIN cat_rol   r ON r.id = m.rol_id
    WHERE m.usuario_id  = auth.uid()
      AND m.sociedad_id = p_sociedad_id
      AND m.activa      = TRUE
      AND r.nombre      = 'admin'
  );
$$;

-- ¿El usuario autenticado es veterinario activo en la sociedad dada?
CREATE OR REPLACE FUNCTION es_veterinario(p_sociedad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membresia m
    JOIN cat_rol   r ON r.id = m.rol_id
    WHERE m.usuario_id  = auth.uid()
      AND m.sociedad_id = p_sociedad_id
      AND m.activa      = TRUE
      AND r.nombre      = 'veterinario'
  );
$$;

-- =============================================================================
-- CATÁLOGOS — solo lectura para cualquier usuario autenticado
-- (No tienen sociedad_id; son datos de referencia global)
-- =============================================================================

ALTER TABLE cat_tipo_consulta ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_parte_cuerpo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_raza          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_pelaje        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_rol           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_select"
  ON cat_tipo_consulta FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalogo_select"
  ON cat_parte_cuerpo FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalogo_select"
  ON cat_raza FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalogo_select"
  ON cat_pelaje FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalogo_select"
  ON cat_rol FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- SOCIEDAD
-- SELECT: solo sociedades donde el usuario tiene membresía activa.
-- UPDATE: solo el admin de esa sociedad.
-- INSERT/DELETE: bloqueados para authenticated (solo service_role).
-- =============================================================================

ALTER TABLE sociedad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sociedad_select"
  ON sociedad FOR SELECT TO authenticated
  USING (tiene_membresia(id));

CREATE POLICY "sociedad_update"
  ON sociedad FOR UPDATE TO authenticated
  USING     (es_admin(id))
  WITH CHECK (es_admin(id));

-- =============================================================================
-- USUARIO
-- Un usuario ve su propio perfil.
-- Un admin ve todos los usuarios que tienen membresía en su sociedad.
-- Un usuario puede actualizar su propio perfil.
-- INSERT: solo service_role (el admin crea usuarios por backend).
-- =============================================================================

ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_select_propio"
  ON usuario FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "usuario_select_admin"
  ON usuario FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM membresia m
      WHERE m.usuario_id  = usuario.id
        AND m.activa      = TRUE
        AND es_admin(m.sociedad_id)
    )
  );

CREATE POLICY "usuario_update_propio"
  ON usuario FOR UPDATE TO authenticated
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- MEMBRESÍA
-- SELECT: un usuario ve sus propias membresías; un admin ve todas las de su sociedad.
-- INSERT: solo el admin puede agregar miembros a su sociedad.
-- UPDATE: solo el admin puede activar/desactivar membresías de su sociedad.
-- DELETE: bloqueado (usar activa = FALSE para baja lógica).
-- =============================================================================

ALTER TABLE membresia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membresia_select_propia"
  ON membresia FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "membresia_select_admin"
  ON membresia FOR SELECT TO authenticated
  USING (es_admin(sociedad_id));

CREATE POLICY "membresia_insert_admin"
  ON membresia FOR INSERT TO authenticated
  WITH CHECK (es_admin(sociedad_id));

CREATE POLICY "membresia_update_admin"
  ON membresia FOR UPDATE TO authenticated
  USING     (es_admin(sociedad_id))
  WITH CHECK (es_admin(sociedad_id));

-- =============================================================================
-- PROPIETARIO
-- SELECT: cualquier miembro activo de la sociedad.
-- INSERT: solo el admin de la sociedad.
-- UPDATE: solo el admin de la sociedad.
-- DELETE: bloqueado.
-- =============================================================================

ALTER TABLE propietario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propietario_select"
  ON propietario FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id));

CREATE POLICY "propietario_insert"
  ON propietario FOR INSERT TO authenticated
  WITH CHECK (es_admin(sociedad_id));

CREATE POLICY "propietario_update"
  ON propietario FOR UPDATE TO authenticated
  USING     (es_admin(sociedad_id))
  WITH CHECK (es_admin(sociedad_id));

-- =============================================================================
-- CABALLO
-- SELECT: cualquier miembro activo de la sociedad.
-- INSERT: solo el admin de la sociedad.
-- UPDATE: solo el admin de la sociedad (datos generales del animal).
-- DELETE: bloqueado (usar activo = FALSE para baja lógica).
-- =============================================================================

ALTER TABLE caballo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caballo_select"
  ON caballo FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id));

CREATE POLICY "caballo_insert"
  ON caballo FOR INSERT TO authenticated
  WITH CHECK (es_admin(sociedad_id));

CREATE POLICY "caballo_update"
  ON caballo FOR UPDATE TO authenticated
  USING     (es_admin(sociedad_id))
  WITH CHECK (es_admin(sociedad_id));

-- =============================================================================
-- PROPIEDAD (historial de ventas — INMUTABLE)
-- SELECT: cualquier miembro activo de la sociedad del caballo.
-- INSERT: solo el admin de la sociedad del caballo.
-- UPDATE/DELETE: bloqueados (registros de propiedad nunca se modifican).
-- =============================================================================

ALTER TABLE propiedad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propiedad_select"
  ON propiedad FOR SELECT TO authenticated
  USING (
    tiene_membresia(
      (SELECT sociedad_id FROM caballo WHERE id = propiedad.caballo_id)
    )
  );

CREATE POLICY "propiedad_insert"
  ON propiedad FOR INSERT TO authenticated
  WITH CHECK (
    es_admin(
      (SELECT sociedad_id FROM caballo WHERE id = caballo_id)
    )
  );

-- =============================================================================
-- HISTORIAL CLÍNICO
-- SELECT: cualquier miembro activo de la sociedad del caballo.
-- INSERT: solo veterinarios activos en la sociedad del caballo.
--         creado_por debe coincidir con auth.uid() (no puede insertar "por otro").
-- UPDATE: solo el veterinario que creó el registro (creado_por = auth.uid()).
-- DELETE: bloqueado.
-- =============================================================================

ALTER TABLE historial_clinico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historial_clinico_select"
  ON historial_clinico FOR SELECT TO authenticated
  USING (
    tiene_membresia(
      (SELECT sociedad_id FROM caballo WHERE id = historial_clinico.caballo_id)
    )
  );

CREATE POLICY "historial_clinico_insert"
  ON historial_clinico FOR INSERT TO authenticated
  WITH CHECK (
    creado_por = auth.uid()
    AND es_veterinario(
      (SELECT sociedad_id FROM caballo WHERE id = caballo_id)
    )
  );

CREATE POLICY "historial_clinico_update"
  ON historial_clinico FOR UPDATE TO authenticated
  USING     (creado_por = auth.uid())
  WITH CHECK (creado_por = auth.uid());

-- =============================================================================
-- HISTORIAL PARTE AFECTADA
-- Acceso derivado del historial_clinico padre.
-- SELECT: cualquier miembro activo de la sociedad del caballo.
-- INSERT: solo el veterinario creador del historial padre.
-- UPDATE: solo el veterinario creador del historial padre.
-- DELETE: bloqueado.
-- =============================================================================

ALTER TABLE historial_parte_afectada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historial_parte_afectada_select"
  ON historial_parte_afectada FOR SELECT TO authenticated
  USING (
    tiene_membresia(
      (SELECT c.sociedad_id
       FROM caballo c
       JOIN historial_clinico h ON h.caballo_id = c.id
       WHERE h.id = historial_parte_afectada.historial_id)
    )
  );

CREATE POLICY "historial_parte_afectada_insert"
  ON historial_parte_afectada FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT creado_por FROM historial_clinico WHERE id = historial_id) = auth.uid()
  );

CREATE POLICY "historial_parte_afectada_update"
  ON historial_parte_afectada FOR UPDATE TO authenticated
  USING (
    (SELECT creado_por FROM historial_clinico WHERE id = historial_parte_afectada.historial_id) = auth.uid()
  )
  WITH CHECK (
    (SELECT creado_por FROM historial_clinico WHERE id = historial_parte_afectada.historial_id) = auth.uid()
  );

-- =============================================================================
-- HISTORIAL MEDICAMENTO
-- Acceso derivado del historial_clinico padre.
-- SELECT: cualquier miembro activo de la sociedad del caballo.
-- INSERT: solo el veterinario creador del historial padre.
-- UPDATE: solo el veterinario creador del historial padre.
-- DELETE: bloqueado.
-- =============================================================================

ALTER TABLE historial_medicamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historial_medicamento_select"
  ON historial_medicamento FOR SELECT TO authenticated
  USING (
    tiene_membresia(
      (SELECT c.sociedad_id
       FROM caballo c
       JOIN historial_clinico h ON h.caballo_id = c.id
       WHERE h.id = historial_medicamento.historial_id)
    )
  );

CREATE POLICY "historial_medicamento_insert"
  ON historial_medicamento FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT creado_por FROM historial_clinico WHERE id = historial_id) = auth.uid()
  );

CREATE POLICY "historial_medicamento_update"
  ON historial_medicamento FOR UPDATE TO authenticated
  USING (
    (SELECT creado_por FROM historial_clinico WHERE id = historial_medicamento.historial_id) = auth.uid()
  )
  WITH CHECK (
    (SELECT creado_por FROM historial_clinico WHERE id = historial_medicamento.historial_id) = auth.uid()
  );
