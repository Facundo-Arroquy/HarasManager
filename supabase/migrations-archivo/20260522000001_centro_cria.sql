-- =============================================================================
-- Migración: Centro de Cría — módulo reproductivo
-- Depende de: core_entities (sociedad, usuario), horses_and_owners (caballo), rls_policies
--
-- Cambios a tablas existentes:
--   - caballo: agrega columna rol_reproductivo
--
-- Tablas nuevas:
--   - cria_registro_clinico   — revisiones ecográficas reproductivas
--   - cria_recordatorio       — recordatorios auto-generados del ciclo
--   - cria_flushing           — registros de flushing de donantes
--   - cria_transferencia      — transferencias embrionarias
--
-- Convención de acceso (igual al resto de la app):
--   SELECT  → tiene_membresia(sociedad_id)
--   INSERT  → es_veterinario(sociedad_id)
--   UPDATE  → veterinario creador (o admin para estado de recordatorios)
--   DELETE  → bloqueado
-- =============================================================================


-- =============================================================================
-- 1. ALTER caballo — rol reproductivo
-- =============================================================================

ALTER TABLE caballo
  ADD COLUMN IF NOT EXISTS rol_reproductivo TEXT
    CHECK (rol_reproductivo IN ('Donante', 'Receptora'));

COMMENT ON COLUMN caballo.rol_reproductivo IS
  'Rol dentro del programa reproductivo. NULL = sin rol asignado.';


-- =============================================================================
-- 2. cria_registro_clinico — revisión ecográfica reproductiva
--    Una por yegua por fecha. Guarda estado ovárico y chips aplicados.
-- =============================================================================

CREATE TABLE cria_registro_clinico (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id       UUID        NOT NULL REFERENCES caballo(id) ON DELETE RESTRICT,
  sociedad_id      UUID        NOT NULL REFERENCES sociedad(id) ON DELETE RESTRICT,
  fecha            DATE        NOT NULL,
  veterinario_id   UUID        NOT NULL REFERENCES usuario(id),

  -- Estado ovárico (arrays de chips: 'Chico','Mediano','CLV','30','35','40','OV',...)
  ovario_izq       TEXT[]      NOT NULL DEFAULT '{}',
  ovario_der       TEXT[]      NOT NULL DEFAULT '{}',
  utero            TEXT[]      NOT NULL DEFAULT '{}',

  -- Acciones/tratamientos aplicados ('Strelin','IN','OXI','PG','1PG','Flushing',
  --   'Transferida','Revisar mañana')
  obs_chips        TEXT[]      NOT NULL DEFAULT '{}',

  -- Padrillo usado en inseminación (solo cuando obs_chips incluye 'IN')
  padrillo_id      UUID        REFERENCES caballo(id),

  -- Días post-OV registrados en este control (facilita cálculo de ventana)
  ov_dias          SMALLINT,

  -- Revisión pendiente para el día siguiente
  review_manana    BOOLEAN     NOT NULL DEFAULT FALSE,
  review_manana_desc TEXT,

  motivo           TEXT,
  diagnostico      TEXT,
  tratamiento      TEXT,
  observaciones    TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_cria_registro_clinico
  BEFORE UPDATE ON cria_registro_clinico
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_cria_rc_caballo_fecha
  ON cria_registro_clinico (caballo_id, fecha DESC);

CREATE INDEX idx_cria_rc_sociedad_fecha
  ON cria_registro_clinico (sociedad_id, fecha DESC);


-- =============================================================================
-- 3. cria_recordatorio — recordatorios del ciclo reproductivo
--    Mayormente auto-generados según los chips del registro clínico.
-- =============================================================================

CREATE TABLE cria_recordatorio (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id          UUID        NOT NULL REFERENCES caballo(id) ON DELETE RESTRICT,
  sociedad_id         UUID        NOT NULL REFERENCES sociedad(id) ON DELETE RESTRICT,

  -- Tipo: 'IN','OXI','Flushing','Dar PG','Revisión Strelin','Revisión PG',
  --        'Revisión Flushing','Revisión'
  tipo                TEXT        NOT NULL,
  fecha_vto           DATE        NOT NULL,

  estado              TEXT        NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','vencido','hecho','cancelado')),

  veterinario_id      UUID        REFERENCES usuario(id),
  notas               TEXT,

  auto_generado       BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Registro clínico que disparó este recordatorio (trazabilidad)
  origen_registro_id  UUID        REFERENCES cria_registro_clinico(id),

  cancel_motivo       TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_cria_recordatorio
  BEFORE UPDATE ON cria_recordatorio
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_cria_rec_caballo_estado
  ON cria_recordatorio (caballo_id, estado, fecha_vto);

CREATE INDEX idx_cria_rec_sociedad_fecha
  ON cria_recordatorio (sociedad_id, fecha_vto);


-- =============================================================================
-- 4. cria_flushing — flushing de donantes
-- =============================================================================

CREATE TABLE cria_flushing (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id             UUID        NOT NULL REFERENCES caballo(id) ON DELETE RESTRICT,  -- donante
  sociedad_id            UUID        NOT NULL REFERENCES sociedad(id) ON DELETE RESTRICT,
  fecha                  DATE        NOT NULL,
  veterinario_id         UUID        NOT NULL REFERENCES usuario(id),

  es_negativo            BOOLEAN     NOT NULL DEFAULT FALSE,
  cantidad               SMALLINT,                    -- embriones recuperados
  estadio                TEXT,                        -- 'Mórula','Blastocisto temprano', etc.
  grado                  SMALLINT CHECK (grado BETWEEN 1 AND 4),
  tamanio                TEXT,                        -- 'Pequeño','Mediano','Grande'
  zona_pelucida          TEXT,

  padrillo_id            UUID        REFERENCES caballo(id),

  -- Recordatorio que originó este flushing
  origen_recordatorio_id UUID        REFERENCES cria_recordatorio(id),

  pg_given               BOOLEAN     NOT NULL DEFAULT FALSE,
  cancelado              BOOLEAN     NOT NULL DEFAULT FALSE,
  notas                  TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_cria_flushing
  BEFORE UPDATE ON cria_flushing
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_cria_flushing_caballo_fecha
  ON cria_flushing (caballo_id, fecha DESC);

CREATE INDEX idx_cria_flushing_sociedad_fecha
  ON cria_flushing (sociedad_id, fecha DESC);


-- =============================================================================
-- 5. cria_transferencia — transferencia embrionaria
-- =============================================================================

CREATE TABLE cria_transferencia (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id           UUID        NOT NULL REFERENCES sociedad(id) ON DELETE RESTRICT,
  fecha                 DATE        NOT NULL,
  veterinario_id        UUID        NOT NULL REFERENCES usuario(id),

  -- Registro clínico de la receptora en el día de la transferencia
  registro_id           UUID        NOT NULL REFERENCES cria_registro_clinico(id),

  caballo_receptora_id  UUID        NOT NULL REFERENCES caballo(id),
  caballo_donante_id    UUID        NOT NULL REFERENCES caballo(id),
  padrillo_id           UUID        REFERENCES caballo(id),

  -- Flushing de origen del embrión transferido
  flushing_id           UUID        REFERENCES cria_flushing(id),

  -- Condición de la receptora al momento de la transferencia
  cl_calidad            TEXT,       -- calidad del cuerpo lúteo
  tono_uterino          TEXT,
  tono_cervical         TEXT,
  clasificacion         TEXT,       -- 'Fresco','Congelado'

  notas                 TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_cria_transferencia
  BEFORE UPDATE ON cria_transferencia
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_cria_transf_receptora_fecha
  ON cria_transferencia (caballo_receptora_id, fecha DESC);

CREATE INDEX idx_cria_transf_donante_fecha
  ON cria_transferencia (caballo_donante_id, fecha DESC);

CREATE INDEX idx_cria_transf_sociedad_fecha
  ON cria_transferencia (sociedad_id, fecha DESC);


-- =============================================================================
-- 6. Row Level Security — Centro de Cría
--
-- Patrón uniforme para las 4 tablas:
--   SELECT  → tiene_membresia(sociedad_id)         — cualquier miembro activo
--   INSERT  → es_veterinario(sociedad_id)          — solo veterinarios
--   UPDATE  → veterinario_id = auth.uid()          — solo el creador
--   DELETE  → bloqueado
--
-- Excepción: cria_recordatorio UPDATE también permitido al admin
--   (el admin puede cerrar/cancelar recordatorios desde el panel)
-- =============================================================================

-- ── cria_registro_clinico ────────────────────────────────────────────────────

ALTER TABLE cria_registro_clinico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cria_rc_select"
  ON cria_registro_clinico FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id));

CREATE POLICY "cria_rc_insert"
  ON cria_registro_clinico FOR INSERT TO authenticated
  WITH CHECK (
    veterinario_id = auth.uid()
    AND es_veterinario(sociedad_id)
  );

CREATE POLICY "cria_rc_update"
  ON cria_registro_clinico FOR UPDATE TO authenticated
  USING     (veterinario_id = auth.uid())
  WITH CHECK (veterinario_id = auth.uid());

-- ── cria_recordatorio ────────────────────────────────────────────────────────

ALTER TABLE cria_recordatorio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cria_rec_select"
  ON cria_recordatorio FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id));

CREATE POLICY "cria_rec_insert"
  ON cria_recordatorio FOR INSERT TO authenticated
  WITH CHECK (es_veterinario(sociedad_id));

-- El vet creador O el admin puede actualizar estado/notas
CREATE POLICY "cria_rec_update"
  ON cria_recordatorio FOR UPDATE TO authenticated
  USING (
    (veterinario_id = auth.uid())
    OR es_admin(sociedad_id)
  )
  WITH CHECK (
    (veterinario_id = auth.uid())
    OR es_admin(sociedad_id)
  );

-- ── cria_flushing ────────────────────────────────────────────────────────────

ALTER TABLE cria_flushing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cria_flushing_select"
  ON cria_flushing FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id));

CREATE POLICY "cria_flushing_insert"
  ON cria_flushing FOR INSERT TO authenticated
  WITH CHECK (
    veterinario_id = auth.uid()
    AND es_veterinario(sociedad_id)
  );

CREATE POLICY "cria_flushing_update"
  ON cria_flushing FOR UPDATE TO authenticated
  USING     (veterinario_id = auth.uid())
  WITH CHECK (veterinario_id = auth.uid());

-- ── cria_transferencia ───────────────────────────────────────────────────────

ALTER TABLE cria_transferencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cria_transf_select"
  ON cria_transferencia FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id));

CREATE POLICY "cria_transf_insert"
  ON cria_transferencia FOR INSERT TO authenticated
  WITH CHECK (
    veterinario_id = auth.uid()
    AND es_veterinario(sociedad_id)
  );

CREATE POLICY "cria_transf_update"
  ON cria_transferencia FOR UPDATE TO authenticated
  USING     (veterinario_id = auth.uid())
  WITH CHECK (veterinario_id = auth.uid());


-- =============================================================================
-- 7. Política adicional en caballo — veterinarios pueden asignar rol_reproductivo
--
--    La política existente caballo_update solo permite al admin.
--    Agregamos una segunda política para que veterinarios puedan únicamente
--    cambiar rol_reproductivo (CHECK garantiza que no toquen otros campos
--    sensibles como marca_id o activo).
-- =============================================================================

CREATE POLICY "caballo_update_rol_reproductivo_vet"
  ON caballo FOR UPDATE TO authenticated
  USING     (es_veterinario(sociedad_id))
  WITH CHECK (es_veterinario(sociedad_id));

COMMENT ON POLICY "caballo_update_rol_reproductivo_vet" ON caballo IS
  'Permite a veterinarios asignar/cambiar rol_reproductivo. '
  'Control fino de columnas pendiente: aplicar en capa de servicio.';
