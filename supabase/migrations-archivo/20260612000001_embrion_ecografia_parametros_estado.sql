-- ============================================================
-- Migración: Embrión, Ecografía, Parámetros, Estado Reproductivo
-- Fecha:     2026-06-12
-- Rama:      feat/diagrama-donantes-receptora
-- ============================================================
-- Cambios:
--   NUEVA    embrion
--   NUEVA    cria_ecografia
--   NUEVA    cria_parametro  (+ seed de valores globales)
--   NUEVA    cria_estado_transicion
--   ALTER    caballo          → ADD estado_reproductivo
--   ALTER    cria_flushing    → DROP estadio, grado, tamanio, zona_pelucida  (0 filas)
--   ALTER    cria_transferencia → ADD embrion_id, sexo_embrion, fecha_sexado,
--                                     fecha_probable_parto (GENERATED)
-- ============================================================

-- ============================================================
-- 1. caballo — agregar estado_reproductivo
-- ============================================================
ALTER TABLE caballo
  ADD COLUMN IF NOT EXISTS estado_reproductivo TEXT;

-- Re-crear el CHECK de forma idempotente
ALTER TABLE caballo
  DROP CONSTRAINT IF EXISTS caballo_estado_reproductivo_check;

ALTER TABLE caballo
  ADD CONSTRAINT caballo_estado_reproductivo_check
  CHECK (estado_reproductivo IS NULL OR estado_reproductivo = ANY (ARRAY[
    -- Donante
    'revision', 'strelling', 'inseminacion', 'oxy', 'ov', 'flushing', 'pg', 'espera',
    -- Receptora
    'disponible', 'transferida', 'eco1', 'eco2', 'eco3', 'prenada', 'vacia'
    -- Nota: 'revision', 'ov', 'pg' son válidos para ambos flujos
  ]));

-- ============================================================
-- 2. cria_flushing — quitar columnas que pasan a embrion
--    (verificado 0 filas en prod → sin riesgo)
-- ============================================================
ALTER TABLE cria_flushing DROP COLUMN IF EXISTS estadio;
ALTER TABLE cria_flushing DROP COLUMN IF EXISTS grado;
ALTER TABLE cria_flushing DROP COLUMN IF EXISTS tamanio;
ALTER TABLE cria_flushing DROP COLUMN IF EXISTS zona_pelucida;

-- ============================================================
-- 3. NUEVA TABLA: embrion
--    Un registro por embrión producido en un flushing.
-- ============================================================
CREATE TABLE IF NOT EXISTS embrion (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id        UUID        NOT NULL REFERENCES sociedad(id),
  flushing_id        UUID        NOT NULL REFERENCES cria_flushing(id),
  -- padrillo heredado del flushing; desnormalizado para queries directas
  padrillo_id        UUID        REFERENCES caballo(id),
  caballo_donante_id UUID        NOT NULL REFERENCES caballo(id),
  estadio            TEXT        CHECK (estadio IS NULL OR estadio = ANY (ARRAY[
                                   'Mórula',
                                   'Blastocisto temprano',
                                   'Blastocisto',
                                   'Blastocisto expandido'
                                 ])),
  grado              SMALLINT    CHECK (grado IS NULL OR (grado >= 1 AND grado <= 4)),
  tamanio            TEXT,
  zona_pelucida      TEXT,
  estado             TEXT        NOT NULL DEFAULT 'disponible'
                                 CHECK (estado = ANY (ARRAY[
                                   'disponible',
                                   'transferido',
                                   'descartado',
                                   'congelado'
                                 ])),
  notas              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON embrion;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON embrion
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- 4. cria_transferencia — agregar nexo con embrion + sexado + parto
-- ============================================================
ALTER TABLE cria_transferencia
  ADD COLUMN IF NOT EXISTS embrion_id    UUID REFERENCES embrion(id),
  ADD COLUMN IF NOT EXISTS sexo_embrion  TEXT CHECK (sexo_embrion IS NULL OR sexo_embrion = ANY (ARRAY[
                                           'macho', 'hembra', 'no_determinado'
                                         ])),
  ADD COLUMN IF NOT EXISTS fecha_sexado  DATE;

-- Columna generada: fecha de transferencia + 335 días y 12 horas
-- fecha es DATE NOT NULL, por lo que la expresión nunca es NULL.
-- Se guarda físicamente (STORED) para poder filtrar/ordenar sin recalcular.
ALTER TABLE cria_transferencia
  ADD COLUMN IF NOT EXISTS fecha_probable_parto DATE
    GENERATED ALWAYS AS ((fecha + INTERVAL '335 days 12 hours')::date) STORED;

-- ============================================================
-- 5. NUEVA TABLA: cria_ecografia
--    Eco 1, 2 y 3 post-transferencia.
-- ============================================================
CREATE TABLE IF NOT EXISTS cria_ecografia (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id          UUID        NOT NULL REFERENCES sociedad(id),
  transferencia_id     UUID        NOT NULL REFERENCES cria_transferencia(id),
  caballo_receptora_id UUID        NOT NULL REFERENCES caballo(id),
  veterinario_id       UUID        NOT NULL REFERENCES usuario(id),
  numero               SMALLINT    NOT NULL CHECK (numero IN (1, 2, 3)),
  fecha                DATE        NOT NULL,
  resultado            TEXT        NOT NULL CHECK (resultado = ANY (ARRAY[
                                     'prenada', 'abortada', 'pendiente'
                                   ])),
  ovario_izq           TEXT[]      NOT NULL DEFAULT '{}',
  ovario_der           TEXT[]      NOT NULL DEFAULT '{}',
  notas                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Una ecografía de cada número por transferencia
  CONSTRAINT cria_ecografia_transferencia_numero_uq UNIQUE (transferencia_id, numero)
);

DROP TRIGGER IF EXISTS set_updated_at ON cria_ecografia;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON cria_ecografia
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- 6. NUEVA TABLA: cria_parametro
--    Plazos configurables por sociedad (o globales si sociedad_id IS NULL).
-- ============================================================
CREATE TABLE IF NOT EXISTS cria_parametro (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID        REFERENCES sociedad(id),  -- NULL = default global
  clave       TEXT        NOT NULL,
  descripcion TEXT,
  valor_dias  SMALLINT,
  valor_horas SMALLINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULLS NOT DISTINCT: trata NULL == NULL para detectar duplicados globales
  CONSTRAINT cria_parametro_sociedad_clave_uq
    UNIQUE NULLS NOT DISTINCT (sociedad_id, clave)
);

DROP TRIGGER IF EXISTS set_updated_at ON cria_parametro;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON cria_parametro
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Seed: valores por defecto globales
INSERT INTO cria_parametro (sociedad_id, clave, descripcion, valor_dias, valor_horas) VALUES
  (NULL, 'dias_strelling_alerta',     'Días hasta revisión post-Strelling (donante)',       2,    NULL),
  (NULL, 'dias_inseminacion_alerta',  'Días hasta revisión post-Inseminación',               2,    NULL),
  (NULL, 'horas_oxy_alerta',          'Horas hasta revisión post-Oxy',                      NULL, 36  ),
  (NULL, 'dias_flushing_alerta',      'Días hasta revisión post-Flushing',                  8,    NULL),
  (NULL, 'dias_espera_ciclo',         'Días de espera antes de nuevo ciclo donante',        14,   NULL),
  (NULL, 'horas_strelling_receptora', 'Horas hasta revisión post-Strelling (receptora)',    NULL, 36  ),
  (NULL, 'horas_ovusynch_receptora',  'Horas hasta revisión post-Ovusynch (receptora)',     NULL, 36  ),
  (NULL, 'dias_ov_eco1',              'Días desde OV hasta Eco 1',                          14,   NULL),
  (NULL, 'dias_eco1_eco2',            'Días desde Eco 1 hasta Eco 2',                       14,   NULL),
  (NULL, 'dias_eco2_eco3',            'Días desde Eco 2 hasta Eco 3',                       30,   NULL)
ON CONFLICT ON CONSTRAINT cria_parametro_sociedad_clave_uq DO NOTHING;

-- ============================================================
-- 7. NUEVA TABLA: cria_estado_transicion
--    Auditoría inmutable: cada cambio de estado reproductivo.
--    Solo INSERT; sin UPDATE/DELETE.
-- ============================================================
CREATE TABLE IF NOT EXISTS cria_estado_transicion (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  caballo_id              UUID        NOT NULL REFERENCES caballo(id),
  sociedad_id             UUID        NOT NULL REFERENCES sociedad(id),
  estado_anterior         TEXT,   -- NULL = primer estado registrado
  estado_nuevo            TEXT        NOT NULL,
  motivo                  TEXT,
  -- FKs opcionales al origen del cambio (máximo uno no nulo típicamente)
  registro_origen_id      UUID        REFERENCES cria_registro_clinico(id),
  flushing_origen_id      UUID        REFERENCES cria_flushing(id),
  transferencia_origen_id UUID        REFERENCES cria_transferencia(id),
  creado_por              UUID        NOT NULL REFERENCES usuario(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Sin updated_at: tabla append-only
);

-- ============================================================
-- 8. RLS — habilitar y crear políticas
-- ============================================================

-- ---- embrion ----
ALTER TABLE embrion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embrion_select"  ON embrion;
DROP POLICY IF EXISTS "embrion_insert"  ON embrion;
DROP POLICY IF EXISTS "embrion_update"  ON embrion;

CREATE POLICY "embrion_select" ON embrion FOR SELECT
  USING (tiene_membresia(sociedad_id) OR is_superadmin());

CREATE POLICY "embrion_insert" ON embrion FOR INSERT
  WITH CHECK (vet_tiene_acceso(caballo_donante_id));

CREATE POLICY "embrion_update" ON embrion FOR UPDATE
  USING (vet_tiene_acceso(caballo_donante_id) OR es_admin(sociedad_id) OR is_superadmin());

-- ---- cria_ecografia ----
ALTER TABLE cria_ecografia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cria_ecografia_select" ON cria_ecografia;
DROP POLICY IF EXISTS "cria_ecografia_insert" ON cria_ecografia;
DROP POLICY IF EXISTS "cria_ecografia_update" ON cria_ecografia;

CREATE POLICY "cria_ecografia_select" ON cria_ecografia FOR SELECT
  USING (
    tiene_membresia(sociedad_id)
    OR vet_tiene_acceso(caballo_receptora_id)
    OR is_superadmin()
  );

CREATE POLICY "cria_ecografia_insert" ON cria_ecografia FOR INSERT
  WITH CHECK (vet_tiene_acceso(caballo_receptora_id));

CREATE POLICY "cria_ecografia_update" ON cria_ecografia FOR UPDATE
  USING (veterinario_id = auth.uid() OR es_admin(sociedad_id) OR is_superadmin());

-- ---- cria_parametro ----
ALTER TABLE cria_parametro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cria_parametro_select" ON cria_parametro;
DROP POLICY IF EXISTS "cria_parametro_insert" ON cria_parametro;
DROP POLICY IF EXISTS "cria_parametro_update" ON cria_parametro;

-- Parámetros globales (sociedad_id IS NULL) visibles para todos los autenticados
CREATE POLICY "cria_parametro_select" ON cria_parametro FOR SELECT
  USING (
    sociedad_id IS NULL
    OR tiene_membresia(sociedad_id)
    OR is_superadmin()
  );

CREATE POLICY "cria_parametro_insert" ON cria_parametro FOR INSERT
  WITH CHECK (
    (sociedad_id IS NULL AND is_superadmin())
    OR (sociedad_id IS NOT NULL AND es_admin(sociedad_id))
  );

CREATE POLICY "cria_parametro_update" ON cria_parametro FOR UPDATE
  USING (
    (sociedad_id IS NULL AND is_superadmin())
    OR (sociedad_id IS NOT NULL AND es_admin(sociedad_id))
  );

-- ---- cria_estado_transicion ----
ALTER TABLE cria_estado_transicion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cria_estado_transicion_select" ON cria_estado_transicion;
DROP POLICY IF EXISTS "cria_estado_transicion_insert" ON cria_estado_transicion;

CREATE POLICY "cria_estado_transicion_select" ON cria_estado_transicion FOR SELECT
  USING (tiene_membresia(sociedad_id) OR is_superadmin());

CREATE POLICY "cria_estado_transicion_insert" ON cria_estado_transicion FOR INSERT
  WITH CHECK (
    vet_tiene_acceso(caballo_id)
    OR es_admin(sociedad_id)
    OR is_superadmin()
  );
-- Sin UPDATE/DELETE policy → tabla inmutable por diseño
