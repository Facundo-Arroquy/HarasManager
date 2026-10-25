-- Carga de receptoras de Sol de Agosto desde la planilla del cliente
-- "EMBRIONES 25-26" (hoja "Receptoras"). Son yeguas receptoras comerciales
-- identificadas solo por número de caña. No estaban en el sistema: había
-- una sola ('163'). Decisiones tomadas con el cliente:
--   * nombre = número de caña tal cual ('165', 'Veruga', ...)
--   * categoria 'Yegua', sexo 'H', rol_reproductivo 'Receptora', sin estado_reproductivo
--   * campo: 'En 60' -> potrero '60' (ya existe); 'Costal' -> potrero nuevo de SDA
--   * cañas repetidas en la planilla se cargan una sola vez
--   * NO se cargan como preñadas (no hay transferencia registrada que lo respalde)
--   * la columna 'Estado' (ok / vacío) se ignora
--   * pelajes sin equivalente en cat_pelaje (Lobuna, pintada, Azuleja) quedan
--     con pelaje_id NULL y el valor original en observaciones

-- 1. Potrero 'Costal' (La Dolfina) si no existe
INSERT INTO campo (id, sociedad_id, nombre, descripcion)
SELECT gen_random_uuid(), 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Costal',
       'Potrero de La Dolfina donde están las receptoras de Sol de Agosto (planilla EMBRIONES 25-26)'
WHERE NOT EXISTS (SELECT 1 FROM campo WHERE sociedad_id = 'fc880764-c628-4961-92f9-527a0bf03d8f' AND lower(nombre) = 'costal');

-- 2. Receptoras
WITH campo60 AS (SELECT id FROM campo WHERE sociedad_id = 'fc880764-c628-4961-92f9-527a0bf03d8f' AND nombre = '60'),
     costal  AS (SELECT id FROM campo WHERE sociedad_id = 'fc880764-c628-4961-92f9-527a0bf03d8f' AND lower(nombre) = 'costal')
INSERT INTO caballo (nombre, categoria, sexo, rol_reproductivo, sociedad_id, pelaje_id, campo_id, observaciones, activo)
VALUES
  ('165', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('237', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('161', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('247', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('224', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('156', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('425', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('421', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('724', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('228', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('155', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('114', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('14', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('172', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('419', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('136', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('129', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('230', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('778', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('146', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('214', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('4', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('10', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('115', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('66', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('72', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('428', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('209', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('148', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('64', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('219', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('3', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('427', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('199', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma 2026-08-19', TRUE),
  ('431', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('424', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('131', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('152', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('1580', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM campo60), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('140', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('488', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('4311', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('254', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Devolver a: Eduardo', TRUE),
  ('137', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Devolver a: 149', TRUE),
  ('159', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Devolver a: 1962', TRUE),
  ('141', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('411', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Devolver a: Paco', TRUE),
  ('113', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 7, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma | Devolver a: 4000', TRUE),
  ('414', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('198', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('184', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Pelaje planilla: "Lobuna" (sin equivalente en catálogo) | Planilla anota (col. plasma): "Ok, preñada ?"', TRUE),
  ('29', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('176', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 4, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('410', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 5, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('112', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Planilla anota (col. plasma): "Ok preñada"', TRUE),
  ('117', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('105', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 14, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('11', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('182', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('138', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('12', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 7, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('201', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('333', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('274', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('432', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('433', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('270', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 2, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('2', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('417', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('124', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Pelaje planilla: "lobuna" (sin equivalente en catálogo) | Extracción de plasma', TRUE),
  ('379', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma', TRUE),
  ('218', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 2, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('191', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 7, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('128', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 4, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('162', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 14, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma', TRUE),
  ('238', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 2, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('1320', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 2, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('158', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('282', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Pelaje planilla: "pintada" (sin equivalente en catálogo)', TRUE),
  ('452', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('43', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('164', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('126', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('423', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Pelaje planilla: "lobuna" (sin equivalente en catálogo)', TRUE),
  ('353', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('100', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('167', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 5, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('30', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Extracción de plasma', TRUE),
  ('208', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('434', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('435', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('430', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('Veruga', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 1, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('4714', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto | Pelaje planilla: "Azuleja" (sin equivalente en catálogo)', TRUE),
  ('239', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('436', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 13, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('153', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', 3, (SELECT id FROM costal), 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE),
  ('1523', 'Yegua', 'H', 'Receptora', 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, 'Importada de planilla "EMBRIONES 25-26" (hoja Receptoras) — Sol de Agosto', TRUE);

-- 3. La receptora '163' que ya existía: asignarle el potrero '60' (planilla)
UPDATE caballo SET campo_id = (SELECT id FROM campo WHERE sociedad_id = 'fc880764-c628-4961-92f9-527a0bf03d8f' AND nombre = '60')
WHERE sociedad_id = 'fc880764-c628-4961-92f9-527a0bf03d8f' AND nombre = '163' AND rol_reproductivo = 'Receptora' AND campo_id IS NULL;
