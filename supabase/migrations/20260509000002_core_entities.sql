-- =============================================================================
-- Migración 2: Entidades core — sociedad, usuario, membresia
-- Depende de: 20260509000001_catalogs.sql (cat_rol)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Función reutilizable: actualizar updated_at automáticamente en cualquier tabla
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Sociedades (tenants raíz del sistema multi-tenant)
-- INSERT solo via service_role (backend); no hay política RLS de INSERT.
-- ---------------------------------------------------------------------------
CREATE TABLE sociedad (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     VARCHAR(200) NOT NULL,
  cuit       VARCHAR(20),
  direccion  TEXT,
  activa     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_sociedad
  BEFORE UPDATE ON sociedad
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Usuarios (espejo de auth.users — se crea via trigger o backend)
-- El registro público está deshabilitado; solo admins crean usuarios.
-- ---------------------------------------------------------------------------
CREATE TABLE usuario (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     VARCHAR(100) NOT NULL,
  apellido   VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  telefono   VARCHAR(30),
  activo     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_usuario
  BEFORE UPDATE ON usuario
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Membresía: relación N:M entre usuario y sociedad con rol asignado.
-- Un mismo usuario puede tener distintos roles en distintas sociedades.
-- UNIQUE(usuario_id, sociedad_id, rol_id) evita duplicados exactos.
-- ---------------------------------------------------------------------------
CREATE TABLE membresia (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  sociedad_id UUID        NOT NULL REFERENCES sociedad(id) ON DELETE CASCADE,
  rol_id      INTEGER     NOT NULL REFERENCES cat_rol(id),
  activa      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, sociedad_id, rol_id)
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

-- Auth checks frecuentes: "¿tiene el usuario membresía activa en sociedad X?"
CREATE INDEX idx_membresia_usuario_activa
  ON membresia (usuario_id, activa);

-- Admin checks: listar miembros de una sociedad
CREATE INDEX idx_membresia_sociedad_activa
  ON membresia (sociedad_id, activa);
