-- Marca la consulta como hecha por alguien de afuera del establecimiento. Se
-- carga igual para que quede en el historial del animal, pero se distingue de
-- lo que hizo el equipo propio: la sección "Trabajos realizados" de Sanidad
-- filtra por este flag.
ALTER TABLE historial_clinico
  ADD COLUMN IF NOT EXISTS trabajo_externo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN historial_clinico.trabajo_externo IS
  'TRUE = lo hizo un profesional ajeno al establecimiento; se registra solo para dejar constancia.';
