-- =============================================================================
-- Restricción de padrillos familiares en la inseminación
-- =============================================================================
-- Definición de Gero (2026-08-02): al inseminar una donante no se puede elegir
-- un padrillo que sea familiar directo de la yegua. El alcance acordado es de
-- 2 generaciones: padres, abuelos, hijos, nietos, hermanos/medios hermanos y
-- tíos — es decir, cualquier par que comparta un ancestro dentro de 2 niveles.
--
-- Solo se evalúa el pedigree cargado con FK (padre_id / madre_id). Los padres
-- cargados como texto libre (padre_nombre / madre_nombre) no se pueden cruzar.
-- =============================================================================

-- Ancestros de un caballo hasta N generaciones, incluyéndose a sí mismo (nivel 0).
CREATE OR REPLACE FUNCTION ancestros_caballo(p_caballo_id UUID, p_gen INT DEFAULT 2)
RETURNS TABLE (caballo_id UUID, nivel INT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE arbol AS (
    SELECT p_caballo_id AS id, 0 AS nivel
    UNION ALL
    SELECT padres.parent_id, arbol.nivel + 1
    FROM arbol
    JOIN caballo c ON c.id = arbol.id
    CROSS JOIN LATERAL (VALUES (c.padre_id), (c.madre_id)) AS padres(parent_id)
    WHERE padres.parent_id IS NOT NULL
      AND arbol.nivel < p_gen
  )
  SELECT id, MIN(nivel)::INT FROM arbol WHERE id IS NOT NULL GROUP BY id;
$$;

-- TRUE si comparten algún ancestro dentro de p_gen generaciones (o si uno es
-- ancestro/descendiente del otro dentro de ese rango).
CREATE OR REPLACE FUNCTION es_familiar_directo(p_a UUID, p_b UUID, p_gen INT DEFAULT 2)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p_a IS NOT NULL AND p_b IS NOT NULL AND EXISTS (
    SELECT 1
    FROM ancestros_caballo(p_a, p_gen) x
    JOIN ancestros_caballo(p_b, p_gen) y ON y.caballo_id = x.caballo_id
  );
$$;

-- Devuelve, de la lista de padrillos que la UI está mostrando, cuáles son
-- familiares de la donante y con qué parentesco (para la etiqueta roja).
CREATE OR REPLACE FUNCTION get_padrillos_familiares(
  p_donante_id  UUID,
  p_padrillo_ids UUID[]
)
RETURNS TABLE (padrillo_id UUID, parentesco TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH donante AS (
    SELECT a.caballo_id, a.nivel FROM ancestros_caballo(p_donante_id, 2) a
  ),
  candidatos AS (
    SELECT UNNEST(p_padrillo_ids) AS id
  ),
  cruce AS (
    SELECT
      c.id,
      MIN(CASE WHEN c.id = d.caballo_id      THEN d.nivel END)  AS nivel_es_ancestro,   -- el padrillo es ancestro de la donante
      MIN(CASE WHEN p_donante_id = p.caballo_id THEN p.nivel END) AS nivel_es_desc,     -- la donante es ancestro del padrillo
      MIN(GREATEST(d.nivel, p.nivel))                            AS nivel_comun
    FROM candidatos c
    JOIN LATERAL ancestros_caballo(c.id, 2) p ON TRUE
    JOIN donante d ON d.caballo_id = p.caballo_id
    GROUP BY c.id
  )
  SELECT
    cruce.id,
    CASE
      WHEN cruce.nivel_es_ancestro = 1 THEN 'Padre'
      WHEN cruce.nivel_es_ancestro = 2 THEN 'Abuelo'
      WHEN cruce.nivel_es_desc     = 1 THEN 'Hijo'
      WHEN cruce.nivel_es_desc     = 2 THEN 'Nieto'
      WHEN cruce.nivel_comun       = 1 THEN 'Hermano'
      ELSE 'Familiar'
    END
  FROM cruce
  WHERE cruce.id <> p_donante_id;
END;
$$;

GRANT EXECUTE ON FUNCTION ancestros_caballo(UUID, INT)        TO authenticated;
GRANT EXECUTE ON FUNCTION es_familiar_directo(UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_padrillos_familiares(UUID, UUID[]) TO authenticated;

-- Bloqueo real en la DB: el frontend deshabilita la opción, pero la regla vive acá.
CREATE OR REPLACE FUNCTION bloquear_padrillo_familiar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.padrillo_id IS NOT NULL
     AND es_familiar_directo(NEW.caballo_id, NEW.padrillo_id, 2) THEN
    RAISE EXCEPTION
      'El padrillo seleccionado es familiar directo de la yegua; no se puede inseminar.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_padrillo_familiar ON cria_registro_clinico;
CREATE TRIGGER trg_bloquear_padrillo_familiar
  BEFORE INSERT OR UPDATE OF padrillo_id, caballo_id ON cria_registro_clinico
  FOR EACH ROW EXECUTE FUNCTION bloquear_padrillo_familiar();
