-- Dos correcciones sobre el stock de Sol de Agosto cargado en la PR #76, que
-- salieron de revisar la planilla original con el cliente. Van antes de la
-- carga del resto del stock (20260902151101) porque esa resuelve el pedigree
-- por nombre: con el padrillo duplicado todavía presente, los hijos podían
-- quedar colgando del registro equivocado.

-- 1. El excel repite el padrillo "Che" en dos filas idénticas, y el import creó
--    dos registros. Se elimina el que quedó sin hijos; el otro conserva su
--    pedigree. `acceso_vet` no tiene ON DELETE CASCADE, así que va primero.
DELETE FROM acceso_vet WHERE caballo_id = 'fa4ef88f-1724-4b30-ac8e-271a32cca553';
DELETE FROM caballo    WHERE id         = 'fa4ef88f-1724-4b30-ac8e-271a32cca553';

-- 2. RP 702 y 703 tenían padre y madre invertidos: en la columna MADRE del
--    excel figuraba el padrillo "Sacerdote". En el 702 además el "nombre" del
--    animal era una nota suelta de la planilla, que pasa a observaciones.
--    Las fechas siguen el criterio acordado con el cliente: una temporada
--    ('2021/2022') se carga como el 31/12 del primer año.
UPDATE caballo SET
  nombre           = 'RP 702',
  padre_nombre     = 'Sacerdote',
  madre_nombre     = '384 (galleta sensa)',
  fecha_nacimiento = '2021-12-31',
  observaciones    = 'Temporada (excel): 2021/2022 — fecha fijada al 31/12/2021 | '
                     'Padre/madre venían invertidos en el excel — corregido | '
                     'Nota del excel: pueden estar cambiados con el 701'
WHERE id = '55ac7077-716d-4f49-b71a-7d8da728f986';

UPDATE caballo SET
  padre_nombre     = 'Sacerdote',
  madre_nombre     = '255 (galleta tabasco)',
  fecha_nacimiento = '2021-12-31',
  observaciones    = 'Temporada (excel): 2021/2022 — fecha fijada al 31/12/2021 | '
                     'Padre/madre venían invertidos en el excel — corregido | Pelaje (excel): ???'
WHERE id = 'd0be9052-5233-4c27-a772-071d1cf96514';
