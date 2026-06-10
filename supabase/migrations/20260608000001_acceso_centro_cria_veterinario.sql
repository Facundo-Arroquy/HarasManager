-- =============================================================================
-- Migración: acceso al Centro de Embriones para veterinarios, gestionado
-- por el superadmin (igual que sociedad.acceso_centro_cria para empresas).
--
-- Los veterinarios son usuarios globales (usuario.rol = 'veterinario') sin
-- sociedad/membresía fija, por lo que el toggle de acceso vive directamente
-- en la tabla usuario. Por defecto en true para no romper el acceso de los
-- veterinarios existentes (hasta ahora tenían acceso siempre).
-- =============================================================================

ALTER TABLE usuario
  ADD COLUMN acceso_centro_cria BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN usuario.acceso_centro_cria IS
  'Acceso al Centro de Embriones para usuarios con rol veterinario. Otorgado/denegado por el superadmin.';

-- ── Permite al superadmin actualizar usuarios (alternar acceso_centro_cria) ──
CREATE POLICY "superadmin_usuario_update" ON usuario
  FOR UPDATE USING (is_superadmin())
  WITH CHECK (is_superadmin());
