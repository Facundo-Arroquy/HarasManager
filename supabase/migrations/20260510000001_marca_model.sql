-- =============================================================================
-- Migración 6: Reemplazar modelo propietario/propiedad por marca
--
-- CAMBIOS:
--   - DROP propietario + propiedad (reemplazados por marca)
--   - CREATE marca  (tenant de segundo nivel, identificado por dominio de email)
--   - ALTER caballo → agregar marca_id
--   - CREATE acceso_veterinario (acceso masivo por marca o individual por caballo)
--   - CREATE historial_propiedad (inmutable, registra transferencias entre marcas)
--
-- Depende de: todas las migraciones anteriores
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Eliminar tablas del modelo anterior
-- (CASCADE elimina FKs dependientes y sus políticas RLS automáticamente)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS propiedad  CASCADE;
DROP TABLE IF EXISTS propietario CASCADE;

-- ---------------------------------------------------------------------------
-- marca: entidad propietaria identificada por dominio de email
--
-- Lógica de acceso:
--   Usuario con email facu@losalamos.com → pertenece a la marca cuyo
--   dominio_email = 'losalamos.com' en la misma sociedad.
--   El dominio es UNIQUE por sociedad — no puede haber dos marcas con el mismo
--   dominio dentro de un mismo haras.
-- ---------------------------------------------------------------------------
CREATE TABLE marca (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(200) NOT NULL,
  dominio_email VARCHAR(100) NOT NULL,   -- 'losalamos.com', 'pcba.com.ar'
  sociedad_id   UUID        NOT NULL REFERENCES sociedad(id) ON DELETE RESTRICT,
  activa        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dominio_email, sociedad_id)
);

CREATE TRIGGER set_updated_at_marca
  BEFORE UPDATE ON marca
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_marca_sociedad  ON marca (sociedad_id);
CREATE INDEX idx_marca_dominio   ON marca (dominio_email);

-- ---------------------------------------------------------------------------
-- caballo: agregar FK a marca
--
-- marca_id puede ser NULL si el caballo aún no fue asignado a ninguna marca.
-- El admin del haras asigna la marca al registrar o al transferir un caballo.
-- ---------------------------------------------------------------------------
ALTER TABLE caballo
  ADD COLUMN marca_id UUID REFERENCES marca(id) ON DELETE RESTRICT;

CREATE INDEX idx_caballo_marca ON caballo (marca_id);

-- ---------------------------------------------------------------------------
-- acceso_veterinario: acceso que el admin de una marca le concede a un vet
--
-- Dos variantes mutuamente excluyentes (CHECK XOR):
--   1. Masivo:    marca_id NOT NULL, caballo_id NULL
--      → el vet ve TODOS los caballos de esa marca
--   2. Individual: marca_id NULL, caballo_id NOT NULL
--      → el vet ve solo ese caballo específico
--
-- otorgado_por: admin que concedió el acceso (auditoría).
-- activo = FALSE para revocar sin borrar el historial.
-- ---------------------------------------------------------------------------
CREATE TABLE acceso_veterinario (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id       UUID        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  marca_id     UUID        REFERENCES marca(id)   ON DELETE CASCADE,  -- masivo
  caballo_id   UUID        REFERENCES caballo(id) ON DELETE CASCADE,  -- individual
  otorgado_por UUID        NOT NULL REFERENCES usuario(id),
  activo       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT acceso_xor CHECK (
    (marca_id IS NOT NULL AND caballo_id IS NULL) OR
    (marca_id IS NULL     AND caballo_id IS NOT NULL)
  )
);

-- Evitar duplicados: un vet no puede tener dos registros activos para la misma marca o caballo
CREATE UNIQUE INDEX uq_acceso_vet_marca
  ON acceso_veterinario (vet_id, marca_id)
  WHERE marca_id IS NOT NULL;

CREATE UNIQUE INDEX uq_acceso_vet_caballo
  ON acceso_veterinario (vet_id, caballo_id)
  WHERE caballo_id IS NOT NULL;

CREATE INDEX idx_acceso_vet_vet_activo ON acceso_veterinario (vet_id, activo);

-- ---------------------------------------------------------------------------
-- historial_propiedad: registro inmutable de transferencias entre marcas
--
-- marca_anterior_id NULL → primera asignación del caballo a una marca.
-- Nunca hacer UPDATE ni DELETE — es el registro histórico de propiedad.
-- ---------------------------------------------------------------------------
CREATE TABLE historial_propiedad (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id         UUID    NOT NULL REFERENCES caballo(id) ON DELETE RESTRICT,
  marca_anterior_id  UUID    REFERENCES marca(id),           -- NULL = primera asignación
  marca_nueva_id     UUID    NOT NULL REFERENCES marca(id),
  fecha              DATE    NOT NULL,
  registrado_por     UUID    NOT NULL REFERENCES usuario(id),
  observaciones      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Sin updated_at: tabla inmutable
);

CREATE INDEX idx_historial_propiedad_caballo ON historial_propiedad (caballo_id);
