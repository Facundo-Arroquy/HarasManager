-- Estado de la consulta clínica.
-- Hasta ahora una fila de historial_clinico era siempre una consulta ya hecha.
-- Con el calendario se pueden agendar consultas: nacen 'pendiente' (con fecha y
-- hora, sin datos clínicos) y pasan a 'realizada' cuando se completa la ficha.
-- Todo lo que ya existe está hecho, por eso el default.
ALTER TABLE historial_clinico
  ADD COLUMN estado TEXT NOT NULL DEFAULT 'realizada'
  CHECK (estado IN ('pendiente', 'realizada'));

-- El calendario consulta las pendientes por fecha.
CREATE INDEX idx_historial_clinico_pendiente
  ON historial_clinico (fecha_consulta)
  WHERE estado = 'pendiente';
