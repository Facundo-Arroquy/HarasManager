-- ── Helper: verifica si el usuario autenticado es superadmin ──────────────────
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario
    WHERE id = auth.uid() AND rol = 'superadmin'
  );
$$;

-- ── Policies para sociedad ────────────────────────────────────────────────────
CREATE POLICY "superadmin_sociedad_select" ON sociedad
  FOR SELECT USING (is_superadmin());

CREATE POLICY "superadmin_sociedad_insert" ON sociedad
  FOR INSERT WITH CHECK (is_superadmin());

CREATE POLICY "superadmin_sociedad_update" ON sociedad
  FOR UPDATE USING (is_superadmin());

-- ── Policies para membresia ───────────────────────────────────────────────────
CREATE POLICY "superadmin_membresia_select" ON membresia
  FOR SELECT USING (is_superadmin());

CREATE POLICY "superadmin_membresia_update" ON membresia
  FOR UPDATE USING (is_superadmin());

CREATE POLICY "superadmin_membresia_delete" ON membresia
  FOR DELETE USING (is_superadmin());

-- ── Policies para usuario ─────────────────────────────────────────────────────
CREATE POLICY "superadmin_usuario_select" ON usuario
  FOR SELECT USING (is_superadmin());

-- ── Policies para caballo (lectura para contar) ───────────────────────────────
CREATE POLICY "superadmin_caballo_select" ON caballo
  FOR SELECT USING (is_superadmin());

-- ── Policies para campo (lectura para contar) ─────────────────────────────────
CREATE POLICY "superadmin_campo_select" ON campo
  FOR SELECT USING (is_superadmin());

-- ── Policy para cat_rol (lectura para mapear nombres a IDs) ──────────────────
CREATE POLICY "superadmin_cat_rol_select" ON cat_rol
  FOR SELECT USING (is_superadmin());
