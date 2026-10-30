-- `get_alertas_vet` joineaba `caballo` sin filtrar por `activo`, así que un
-- caballo dado de baja seguía generando alertas de próxima consulta en el
-- panel del vet. Con la baja en lote del límite freemium eso pasa de ser un
-- caso raro a ser el escenario normal: el vet da de baja 7 caballos y le
-- quedan sus alertas colgadas para siempre.
--
-- Se mantiene el resto de la definición igual (mismo filtro por `creado_por`
-- y misma ventana de 30 días).
CREATE OR REPLACE FUNCTION get_alertas_vet()
RETURNS TABLE(
  historial_id     UUID,
  proxima_consulta DATE,
  caballo_id       UUID,
  caballo_nombre   TEXT,
  tipo             TEXT,
  dias_restantes   INTEGER
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    hc.id AS historial_id,
    hc.proxima_consulta,
    hc.caballo_id,
    c.nombre AS caballo_nombre,
    ct.nombre AS tipo,
    (hc.proxima_consulta - CURRENT_DATE)::INTEGER AS dias_restantes
  FROM historial_clinico hc
  JOIN caballo c ON c.id = hc.caballo_id
  LEFT JOIN cat_tipo_consulta ct ON ct.id = hc.tipo_consulta_id
  WHERE hc.creado_por = auth.uid()
    AND c.activo = TRUE
    AND hc.proxima_consulta IS NOT NULL
    AND hc.proxima_consulta <= CURRENT_DATE + INTERVAL '30 days'
  ORDER BY hc.proxima_consulta ASC;
$$;
