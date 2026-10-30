-- =============================================================================
-- Sistema genérico de módulos por empresa
-- =============================================================================
-- Reemplaza las tres columnas booleanas idénticas (sociedad/membresia/usuario
-- .acceso_centro_cria) por un catálogo + tablas puente, siguiendo el mismo
-- patrón que cat_tag/caballo_tag (migración 20260802120000).
--
-- Contexto del fix: sociedad.acceso_centro_cria es hoy GENERATED ALWAYS AS
-- (plan <> 'silver') STORED en prod (PR #47, aplicada pero nunca mergeada a
-- main). El backfill de abajo LEE esa columna (funciona igual sobre una
-- columna generada) para no perder el acceso de las empresas ya habilitadas
-- por esa vía; nunca la escribe. Las columnas viejas y el trigger/función de
-- PR #47 se eliminan recién en la migración de cleanup (20260810150000),
-- después de un smoke test en prod.
-- =============================================================================

-- =============================================================================
-- Catálogo
-- =============================================================================

CREATE TABLE IF NOT EXISTS cat_modulo (
  id     SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cat_modulo (codigo, nombre) VALUES
  ('centro_cria', 'Centro de Embriones'),
  ('polo', 'Polo')
ON CONFLICT (codigo) DO NOTHING;

-- =============================================================================
-- Tablas puente — PK compuesta (entidad_id, modulo_id), igual que caballo_tag
-- =============================================================================

CREATE TABLE IF NOT EXISTS sociedad_modulo (
  sociedad_id UUID    NOT NULL REFERENCES sociedad(id) ON DELETE CASCADE,
  modulo_id   INTEGER NOT NULL REFERENCES cat_modulo(id) ON DELETE CASCADE,
  habilitado  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sociedad_id, modulo_id)
);

CREATE TABLE IF NOT EXISTS membresia_modulo (
  membresia_id UUID    NOT NULL REFERENCES membresia(id) ON DELETE CASCADE,
  modulo_id    INTEGER NOT NULL REFERENCES cat_modulo(id) ON DELETE CASCADE,
  habilitado   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (membresia_id, modulo_id)
);

-- membresia_modulo.membresia_id ON DELETE CASCADE no es solo higiene —
-- superAdminService.eliminarUsuario() hace un DELETE FROM membresia real (no
-- baja lógica). Sin el CASCADE quedarían filas huérfanas en membresia_modulo.

CREATE TABLE IF NOT EXISTS usuario_modulo (
  usuario_id UUID    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  modulo_id  INTEGER NOT NULL REFERENCES cat_modulo(id) ON DELETE CASCADE,
  habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, modulo_id)
);

CREATE INDEX IF NOT EXISTS idx_sociedad_modulo_modulo  ON sociedad_modulo  (modulo_id);
CREATE INDEX IF NOT EXISTS idx_membresia_modulo_modulo ON membresia_modulo (modulo_id);
CREATE INDEX IF NOT EXISTS idx_usuario_modulo_modulo   ON usuario_modulo   (modulo_id);

DROP TRIGGER IF EXISTS set_updated_at_sociedad_modulo ON sociedad_modulo;
CREATE TRIGGER set_updated_at_sociedad_modulo
  BEFORE UPDATE ON sociedad_modulo FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_membresia_modulo ON membresia_modulo;
CREATE TRIGGER set_updated_at_membresia_modulo
  BEFORE UPDATE ON membresia_modulo FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_usuario_modulo ON usuario_modulo;
CREATE TRIGGER set_updated_at_usuario_modulo
  BEFORE UPDATE ON usuario_modulo FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- Backfill defensivo — copia el valor actual de las 3 columnas viejas.
-- Chequea information_schema antes de leer cada columna: en el repo solo
-- usuario.acceso_centro_cria tiene migración propia (20260608000001); las de
-- sociedad y membresia se agregaron fuera de banda, así que un proyecto
-- construido solo con `supabase/migrations/` no las tendría.
-- 'polo' NO se backfillea — arranca apagado (sin filas) para todas las
-- empresas.
-- =============================================================================

DO $$
DECLARE
  v_modulo_id INTEGER;
BEGIN
  SELECT id INTO v_modulo_id FROM cat_modulo WHERE codigo = 'centro_cria';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sociedad' AND column_name = 'acceso_centro_cria'
  ) THEN
    INSERT INTO sociedad_modulo (sociedad_id, modulo_id, habilitado)
    SELECT id, v_modulo_id, COALESCE(acceso_centro_cria, FALSE) FROM sociedad
    ON CONFLICT (sociedad_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado;
  ELSE
    RAISE NOTICE 'sociedad.acceso_centro_cria no existe — se omite backfill de sociedad_modulo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'membresia' AND column_name = 'acceso_centro_cria'
  ) THEN
    INSERT INTO membresia_modulo (membresia_id, modulo_id, habilitado)
    SELECT id, v_modulo_id, COALESCE(acceso_centro_cria, FALSE) FROM membresia
    ON CONFLICT (membresia_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado;
  ELSE
    RAISE NOTICE 'membresia.acceso_centro_cria no existe — se omite backfill de membresia_modulo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuario' AND column_name = 'acceso_centro_cria'
  ) THEN
    INSERT INTO usuario_modulo (usuario_id, modulo_id, habilitado)
    SELECT id, v_modulo_id, COALESCE(acceso_centro_cria, FALSE) FROM usuario
    ON CONFLICT (usuario_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado;
  ELSE
    RAISE NOTICE 'usuario.acceso_centro_cria no existe — se omite backfill de usuario_modulo';
  END IF;
END $$;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE cat_modulo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sociedad_modulo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE membresia_modulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_modulo   ENABLE ROW LEVEL SECURITY;

-- cat_modulo: catálogo — lectura abierta a cualquier autenticado, ABM solo superadmin
DROP POLICY IF EXISTS cat_modulo_select ON cat_modulo;
CREATE POLICY cat_modulo_select ON cat_modulo
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS cat_modulo_admin ON cat_modulo;
CREATE POLICY cat_modulo_admin ON cat_modulo
  FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

-- sociedad_modulo: SELECT para miembros de la sociedad o superadmin.
-- Escritura: SOLO superadmin (igual que el toggle de hoy sobre sociedad, pero
-- sin heredar el vector de es_admin(id) que hoy tiene sociedad_update).
DROP POLICY IF EXISTS sociedad_modulo_select ON sociedad_modulo;
CREATE POLICY sociedad_modulo_select ON sociedad_modulo
  FOR SELECT TO authenticated
  USING (is_superadmin() OR tiene_membresia(sociedad_id));

DROP POLICY IF EXISTS sociedad_modulo_write ON sociedad_modulo;
CREATE POLICY sociedad_modulo_write ON sociedad_modulo
  FOR ALL TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- membresia_modulo: SELECT propia (el usuario dueño de la membresía) o admin
-- de la sociedad o superadmin. Escritura: admin de la sociedad o superadmin
-- (igual que membresia_update_admin hoy).
DROP POLICY IF EXISTS membresia_modulo_select ON membresia_modulo;
CREATE POLICY membresia_modulo_select ON membresia_modulo
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM membresia m
      WHERE m.id = membresia_modulo.membresia_id
        AND (m.usuario_id = auth.uid() OR es_admin(m.sociedad_id))
    )
  );

DROP POLICY IF EXISTS membresia_modulo_write ON membresia_modulo;
CREATE POLICY membresia_modulo_write ON membresia_modulo
  FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR EXISTS (SELECT 1 FROM membresia m WHERE m.id = membresia_modulo.membresia_id AND es_admin(m.sociedad_id))
  )
  WITH CHECK (
    is_superadmin()
    OR EXISTS (SELECT 1 FROM membresia m WHERE m.id = membresia_modulo.membresia_id AND es_admin(m.sociedad_id))
  );

-- usuario_modulo: veterinarios globales, sin sociedad. SELECT propia o
-- superadmin; escritura SOLO superadmin (igual que hoy).
DROP POLICY IF EXISTS usuario_modulo_select ON usuario_modulo;
CREATE POLICY usuario_modulo_select ON usuario_modulo
  FOR SELECT TO authenticated
  USING (is_superadmin() OR usuario_id = auth.uid());

DROP POLICY IF EXISTS usuario_modulo_write ON usuario_modulo;
CREATE POLICY usuario_modulo_write ON usuario_modulo
  FOR ALL TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- =============================================================================
-- Funciones — SECURITY INVOKER (default): la autorización real la hace la
-- RLS de la tabla puente correspondiente, la función solo resuelve
-- codigo -> modulo_id como conveniencia de la API.
-- =============================================================================

CREATE OR REPLACE FUNCTION set_sociedad_modulo(p_sociedad_id UUID, p_modulo_codigo TEXT, p_habilitado BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_modulo_id INTEGER;
BEGIN
  SELECT id INTO v_modulo_id FROM cat_modulo WHERE codigo = p_modulo_codigo;
  IF v_modulo_id IS NULL THEN
    RAISE EXCEPTION 'Módulo "%" no existe', p_modulo_codigo;
  END IF;

  INSERT INTO sociedad_modulo (sociedad_id, modulo_id, habilitado)
  VALUES (p_sociedad_id, v_modulo_id, p_habilitado)
  ON CONFLICT (sociedad_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado;
END;
$$;

CREATE OR REPLACE FUNCTION set_membresia_modulo(p_membresia_id UUID, p_modulo_codigo TEXT, p_habilitado BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_modulo_id INTEGER;
BEGIN
  SELECT id INTO v_modulo_id FROM cat_modulo WHERE codigo = p_modulo_codigo;
  IF v_modulo_id IS NULL THEN
    RAISE EXCEPTION 'Módulo "%" no existe', p_modulo_codigo;
  END IF;

  INSERT INTO membresia_modulo (membresia_id, modulo_id, habilitado)
  VALUES (p_membresia_id, v_modulo_id, p_habilitado)
  ON CONFLICT (membresia_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado;
END;
$$;

CREATE OR REPLACE FUNCTION set_usuario_modulo(p_usuario_id UUID, p_modulo_codigo TEXT, p_habilitado BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_modulo_id INTEGER;
BEGIN
  SELECT id INTO v_modulo_id FROM cat_modulo WHERE codigo = p_modulo_codigo;
  IF v_modulo_id IS NULL THEN
    RAISE EXCEPTION 'Módulo "%" no existe', p_modulo_codigo;
  END IF;

  INSERT INTO usuario_modulo (usuario_id, modulo_id, habilitado)
  VALUES (p_usuario_id, v_modulo_id, p_habilitado)
  ON CONFLICT (usuario_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado;
END;
$$;

-- get_mis_accesos_modulo: SECURITY INVOKER (default) — la RLS de cada tabla
-- puente ya permite al usuario leer sus propias filas (tiene_membresia /
-- membresia propia / usuario_id = auth.uid()), así que no hace falta escalar
-- privilegios. Un solo round-trip para el usuario autenticado, reemplaza las
-- dos consultas secuenciales que hoy hace cargarPerfilProd
-- (sociedad(...acceso_centro_cria) + tieneAccesoCentroCria).
CREATE OR REPLACE FUNCTION get_mis_accesos_modulo()
RETURNS TABLE (modulo_codigo TEXT, org_habilitado BOOLEAN, usuario_habilitado BOOLEAN)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_rol          TEXT;
  v_sociedad_id  UUID;
  v_membresia_id UUID;
BEGIN
  SELECT rol INTO v_rol FROM usuario WHERE id = auth.uid();

  IF v_rol = 'veterinario' THEN
    RETURN QUERY
    SELECT cm.codigo, FALSE, COALESCE(um.habilitado, FALSE)
    FROM cat_modulo cm
    LEFT JOIN usuario_modulo um ON um.modulo_id = cm.id AND um.usuario_id = auth.uid()
    WHERE cm.activo;
    RETURN;
  END IF;

  SELECT m.id, m.sociedad_id INTO v_membresia_id, v_sociedad_id
  FROM membresia m
  WHERE m.usuario_id = auth.uid() AND m.activa = TRUE
  LIMIT 1;

  RETURN QUERY
  SELECT cm.codigo,
         COALESCE(sm.habilitado, FALSE),
         COALESCE(mm.habilitado, FALSE)
  FROM cat_modulo cm
  LEFT JOIN sociedad_modulo  sm ON sm.modulo_id = cm.id AND sm.sociedad_id  = v_sociedad_id
  LEFT JOIN membresia_modulo mm ON mm.modulo_id = cm.id AND mm.membresia_id = v_membresia_id
  WHERE cm.activo;
END;
$$;

-- =============================================================================
-- Cerrar las 4 funciones nuevas al rol anon (convención de la migración
-- 20260802120400_revocar_anon_funciones_nuevas.sql: Postgres da EXECUTE a
-- PUBLIC por defecto; get_mis_accesos_modulo es SECURITY DEFINER, así que
-- dejarla abierta dispara el advisor anon_security_definer_function_executable).
-- =============================================================================

REVOKE ALL ON FUNCTION set_sociedad_modulo(UUID, TEXT, BOOLEAN)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_membresia_modulo(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_usuario_modulo(UUID, TEXT, BOOLEAN)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_mis_accesos_modulo()                  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION set_sociedad_modulo(UUID, TEXT, BOOLEAN)  TO authenticated;
GRANT EXECUTE ON FUNCTION set_membresia_modulo(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION set_usuario_modulo(UUID, TEXT, BOOLEAN)   TO authenticated;
GRANT EXECUTE ON FUNCTION get_mis_accesos_modulo()                  TO authenticated;
