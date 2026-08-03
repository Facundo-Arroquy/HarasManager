-- =============================================================================
-- Ranking de padrillos preferidos por donante
-- =============================================================================
-- Definición de Gero (2026-08-02): admin y veterinario pueden armar, para cada
-- donante, una lista de hasta 10 padrillos ordenada por prioridad
-- (1 = más recomendado, 10 = menos recomendado).
--
-- La lista es del establecimiento (sociedad de la donante), no del veterinario:
-- se comparte entre todos los que trabajan sobre esa donante. El vet solo puede
-- armarla con las donantes y padrillos a los que el admin le dio acceso.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cria_padrillo_preferido (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id UUID NOT NULL REFERENCES sociedad(id),
  donante_id  UUID NOT NULL REFERENCES caballo(id) ON DELETE CASCADE,
  padrillo_id UUID NOT NULL REFERENCES caballo(id) ON DELETE CASCADE,
  prioridad   SMALLINT NOT NULL CHECK (prioridad BETWEEN 1 AND 10),
  creado_por  UUID REFERENCES usuario(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cria_padrillo_preferido_no_autoref CHECK (donante_id <> padrillo_id),
  UNIQUE (donante_id, padrillo_id),
  UNIQUE (donante_id, prioridad)
);

CREATE INDEX IF NOT EXISTS idx_cria_padrillo_preferido_donante
  ON cria_padrillo_preferido (donante_id, prioridad);

DROP TRIGGER IF EXISTS set_updated_at ON cria_padrillo_preferido;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON cria_padrillo_preferido
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE cria_padrillo_preferido ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros de la sociedad o el vet con acceso a la donante.
DROP POLICY IF EXISTS cria_padrillo_preferido_select ON cria_padrillo_preferido;
CREATE POLICY cria_padrillo_preferido_select ON cria_padrillo_preferido
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR tiene_membresia(sociedad_id)
    OR vet_tiene_acceso(donante_id)
  );

-- La escritura pasa siempre por guardar_ranking_padrillos(): la política deja
-- entrar al admin de la sociedad y al vet con acceso a la donante.
DROP POLICY IF EXISTS cria_padrillo_preferido_write ON cria_padrillo_preferido;
CREATE POLICY cria_padrillo_preferido_write ON cria_padrillo_preferido
  FOR ALL TO authenticated
  USING (is_superadmin() OR es_admin(sociedad_id) OR vet_tiene_acceso(donante_id))
  WITH CHECK (is_superadmin() OR es_admin(sociedad_id) OR vet_tiene_acceso(donante_id));

-- Reemplaza el ranking completo de una donante en una sola transacción: evita
-- los choques del UNIQUE (donante_id, prioridad) al reordenar desde el frontend.
CREATE OR REPLACE FUNCTION guardar_ranking_padrillos(
  p_donante_id   UUID,
  p_padrillo_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sociedad_id UUID;
  v_es_vet      BOOLEAN;
  v_ids         UUID[] := COALESCE(p_padrillo_ids, '{}'::UUID[]);
  v_padrillo_id UUID;
BEGIN
  SELECT sociedad_id INTO v_sociedad_id FROM caballo WHERE id = p_donante_id;
  IF v_sociedad_id IS NULL THEN
    RAISE EXCEPTION 'La donante no existe o no pertenece a un establecimiento.';
  END IF;

  v_es_vet := vet_tiene_acceso(p_donante_id);
  IF NOT (is_superadmin() OR es_admin(v_sociedad_id) OR v_es_vet) THEN
    RAISE EXCEPTION 'Sin permiso para configurar el ranking de esta donante.';
  END IF;

  IF array_length(v_ids, 1) > 10 THEN
    RAISE EXCEPTION 'El ranking admite como máximo 10 padrillos.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM UNNEST(v_ids) AS t(id) GROUP BY t.id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'El ranking no puede repetir el mismo padrillo.';
  END IF;

  -- El vet solo puede rankear padrillos a los que tiene acceso otorgado.
  IF v_es_vet AND NOT (is_superadmin() OR es_admin(v_sociedad_id)) THEN
    FOREACH v_padrillo_id IN ARRAY v_ids LOOP
      IF NOT vet_tiene_acceso(v_padrillo_id) THEN
        RAISE EXCEPTION 'No tenés acceso a alguno de los padrillos seleccionados.';
      END IF;
    END LOOP;
  END IF;

  DELETE FROM cria_padrillo_preferido WHERE donante_id = p_donante_id;

  INSERT INTO cria_padrillo_preferido (sociedad_id, donante_id, padrillo_id, prioridad, creado_por)
  SELECT v_sociedad_id, p_donante_id, t.id, t.orden, auth.uid()
  FROM UNNEST(v_ids) WITH ORDINALITY AS t(id, orden);

  RETURN COALESCE(array_length(v_ids, 1), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION guardar_ranking_padrillos(UUID, UUID[]) TO authenticated;
