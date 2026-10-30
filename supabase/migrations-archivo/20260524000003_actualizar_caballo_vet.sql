-- =============================================================================
-- RPC: actualizar_caballo_veterinario
-- Permite a un veterinario actualizar los datos de un caballo al que tiene acceso.
-- Verifica acceso via vet_tiene_acceso() antes de ejecutar la actualización.
-- No modifica campo_id ni activo (esos los gestiona el admin del haras).
-- =============================================================================

CREATE OR REPLACE FUNCTION actualizar_caballo_veterinario(
  p_caballo_id       UUID,
  p_nombre           TEXT,
  p_fecha_nacimiento DATE,
  p_categoria        TEXT,
  p_subcategoria     TEXT    DEFAULT NULL,
  p_raza_id          INTEGER DEFAULT NULL,
  p_pelaje_id        INTEGER DEFAULT NULL,
  p_numero_chip      TEXT    DEFAULT NULL,
  p_numero_registro  TEXT    DEFAULT NULL,
  p_padre_id         UUID    DEFAULT NULL,
  p_padre_nombre     TEXT    DEFAULT NULL,
  p_madre_id         UUID    DEFAULT NULL,
  p_madre_nombre     TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT vet_tiene_acceso(p_caballo_id) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE caballo SET
    nombre           = p_nombre,
    fecha_nacimiento = p_fecha_nacimiento,
    categoria        = p_categoria,
    subcategoria     = p_subcategoria,
    raza_id          = p_raza_id,
    pelaje_id        = p_pelaje_id,
    numero_chip      = p_numero_chip,
    numero_registro  = p_numero_registro,
    padre_id         = p_padre_id,
    padre_nombre     = p_padre_nombre,
    madre_id         = p_madre_id,
    madre_nombre     = p_madre_nombre
  WHERE id = p_caballo_id;
END;
$$;
