-- =============================================================================
-- 04 · Historial clínico, sanidad, alertas y notificaciones
--
-- Datos ficticios con fechas relativas a "hoy", para que el calendario y las
-- alertas siempre tengan algo cercano. Ver 02_usuarios.sql y 03_campos_caballos.sql
-- para los UUID de usuarios, sociedades y caballos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Catálogo de trabajos sanitarios de cada sociedad (prod tiene los mismos 5)
-- ---------------------------------------------------------------------------
INSERT INTO public.cat_trabajo_sanitario (sociedad_id, nombre)
SELECT s.id, t.nombre
FROM public.sociedad s
CROSS JOIN (VALUES ('Control odontológico'), ('Desparasitación'), ('Extracción de sangre'), ('Herrado'), ('Vacunación')) AS t(nombre);

-- ---------------------------------------------------------------------------
-- Parámetros del centro de cría de cada sociedad (mismos valores que prod)
-- ---------------------------------------------------------------------------
INSERT INTO public.cria_parametro (sociedad_id, clave, descripcion, valor_dias, valor_horas)
SELECT s.id, p.clave, p.descripcion, p.dias, p.horas
FROM public.sociedad s
CROSS JOIN (VALUES
  ('dias_eco1_eco2',           'Días entre la Eco 1 y la Eco 2',           14, NULL::smallint),
  ('dias_eco2_eco3',           'Días entre la Eco 2 y la Eco 3',           30, NULL),
  ('dias_espera_ciclo',        'Días de espera entre ciclos',              14, NULL),
  ('dias_flushing_alerta',     'Días de alerta del flushing',               8, NULL),
  ('dias_inseminacion_alerta', 'Días de alerta de la inseminación',         2, NULL),
  ('dias_ov_eco1',             'Días entre la ovulación y la Eco 1',       14, NULL),
  ('dias_strelling_alerta',    'Días de alerta del Strelin',                2, NULL),
  ('horas_ovusynch_receptora', 'Horas del Ovusynch de la receptora',     NULL, 36),
  ('horas_oxy_alerta',         'Horas de alerta de la oxitocina',        NULL, 36),
  ('horas_strelling_receptora','Horas del Strelin de la receptora',      NULL, 36)
) AS p(clave, descripcion, dias, horas);

-- ---------------------------------------------------------------------------
-- Historial clínico
--   Haras Demo 1: 2 consultas realizadas por caballo (24) + 2 pendientes
--   Haras Demo 2: 1 consulta realizada por cada yegua de los 6 primeros (6)
-- cat_tipo_consulta: 1 Revisión general, 2 Vacuna, 5 Desparasitación, 6 Herraje,
-- 7 Odontología, 9 Ecografía, 10 Tratamiento ortopédico.
-- ---------------------------------------------------------------------------
INSERT INTO public.historial_clinico (
  caballo_id, tipo_consulta_id, fecha_consulta, diagnostico, tratamiento, observaciones, creado_por, estado
)
SELECT
  ('d0000001-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  (ARRAY[1, 2, 5, 7, 9, 6])[1 + (n + k) % 6],
  now() - ((k * 37 + n * 5) || ' days')::interval,
  'Sin hallazgos relevantes',
  CASE (n + k) % 3 WHEN 0 THEN 'Control en 6 meses' WHEN 1 THEN 'Vacuna anual aplicada' ELSE 'Desparasitación con ivermectina' END,
  'Consulta de rutina (dato de prueba)',
  CASE k WHEN 1 THEN 'a0000001-0000-4000-8000-000000000004'::uuid ELSE 'a0000001-0000-4000-8000-000000000002'::uuid END,
  'realizada'
FROM generate_series(1, 12) AS n, generate_series(1, 2) AS k;

INSERT INTO public.historial_clinico (
  caballo_id, tipo_consulta_id, fecha_consulta, diagnostico, tratamiento, observaciones, creado_por, estado
)
SELECT
  ('d0000001-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  (ARRAY[1, 2, 5, 7, 9, 6])[1 + n % 6],
  now() - ((n * 11) || ' days')::interval,
  'Sin hallazgos relevantes', 'Control en 6 meses', 'Consulta de rutina (dato de prueba)',
  'a0000001-0000-4000-8000-000000000005', 'realizada'
FROM generate_series(13, 18) AS n;

-- Consultas pendientes (alimentan el calendario y las alertas del vet)
INSERT INTO public.historial_clinico (
  caballo_id, tipo_consulta_id, fecha_consulta, observaciones, proxima_consulta, creado_por, estado
)
SELECT ('d0000001-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 1,
       now() + interval '5 days', 'Revisión previa a la temporada de monta',
       current_date + 5, 'a0000001-0000-4000-8000-000000000004', 'pendiente'
FROM unnest(ARRAY[6, 7]) AS n;

-- Una consulta con parte afectada y medicamento (Trueno, tratamiento ortopédico)
INSERT INTO public.historial_clinico (
  id, caballo_id, tipo_consulta_id, fecha_consulta, diagnostico, tratamiento, observaciones, creado_por, estado
) VALUES (
  'e0000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000008', 10,
  now() - interval '9 days', 'Sobrecarga en el corvejón derecho', 'Reposo y antiinflamatorio',
  'Reevaluar en 15 días', 'a0000001-0000-4000-8000-000000000004', 'realizada'
);
INSERT INTO public.historial_parte_afectada (historial_id, parte_cuerpo_id, lado, descripcion)
VALUES ('e0000001-0000-4000-8000-000000000001', 26, 'derecho', 'Leve inflamación');
INSERT INTO public.historial_medicamento (historial_id, medicamento, dosis, via_administracion, duracion_dias)
VALUES ('e0000001-0000-4000-8000-000000000001', 'Fenilbutazona', '2,2 mg/kg', 'Oral', 5);

-- ---------------------------------------------------------------------------
-- Trabajos sanitarios (planes)
--   T1/T2/T3/T4 Haras Demo 1 · T5/T6 Haras Demo 2 · T7 plan propio de vet.demo1
-- ---------------------------------------------------------------------------
INSERT INTO public.trabajo_sanitario (id, sociedad_id, vet_owner_id, nombre, fecha_programada, estado, tratamiento, fecha_realizado, creado_por, compartido_con, plan_id) VALUES
  ('e1000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', NULL, 'Vacunación antigripal', current_date + 7,  'pendiente', 'Vacuna antigripal equina', NULL, 'a0000001-0000-4000-8000-000000000004', NULL, 'e2000001-0000-4000-8000-000000000001'),
  ('e1000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', NULL, 'Desparasitación',       current_date + 14, 'pendiente', 'Ivermectina',              NULL, 'a0000001-0000-4000-8000-000000000002', NULL, 'e2000001-0000-4000-8000-000000000002'),
  ('e1000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000001', NULL, 'Herrado',               current_date - 12, 'realizado', NULL,                       current_date - 11, 'a0000001-0000-4000-8000-000000000004', NULL, 'e2000001-0000-4000-8000-000000000003'),
  ('e1000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001', NULL, 'Control odontológico', current_date + 3,  'pendiente', NULL,                       NULL, 'a0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000004', 'e2000001-0000-4000-8000-000000000004'),
  ('e1000001-0000-4000-8000-000000000005', 'b0000001-0000-4000-8000-000000000002', NULL, 'Vacunación',            current_date + 5,  'pendiente', 'Vacuna antitetánica',      NULL, 'a0000001-0000-4000-8000-000000000005', NULL, 'e2000001-0000-4000-8000-000000000005'),
  ('e1000001-0000-4000-8000-000000000006', 'b0000001-0000-4000-8000-000000000002', NULL, 'Extracción de sangre',  current_date + 10, 'pendiente', NULL,                       NULL, 'a0000001-0000-4000-8000-000000000003', NULL, 'e2000001-0000-4000-8000-000000000006'),
  ('e1000001-0000-4000-8000-000000000007', NULL, 'a0000001-0000-4000-8000-000000000004',  'Desparasitación',       current_date + 2,  'pendiente', 'Ivermectina',              NULL, 'a0000001-0000-4000-8000-000000000004', NULL, 'e2000001-0000-4000-8000-000000000007');

-- Caballos de cada trabajo (las celdas pendientes quedan con estado NULL)
INSERT INTO public.trabajo_sanitario_caballo (trabajo_id, caballo_id)
SELECT t.trabajo, ('d0000001-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
FROM (VALUES
  ('e1000001-0000-4000-8000-000000000001'::uuid, ARRAY[1,2,3,4,5,6,7,8,9,10]),
  ('e1000001-0000-4000-8000-000000000002'::uuid, ARRAY[1,2,3,4,5,11,12]),
  ('e1000001-0000-4000-8000-000000000004'::uuid, ARRAY[6,7]),
  ('e1000001-0000-4000-8000-000000000005'::uuid, ARRAY[13,14,15,16,17,18]),
  ('e1000001-0000-4000-8000-000000000006'::uuid, ARRAY[19,20]),
  ('e1000001-0000-4000-8000-000000000007'::uuid, ARRAY[26,27,28,29,30,31])
) AS t(trabajo, caballos), unnest(t.caballos) AS n;

-- El herrado ya está hecho: cada caballo tiene su consulta en el historial
WITH h AS (
  INSERT INTO public.historial_clinico (caballo_id, tipo_consulta_id, fecha_consulta, diagnostico, creado_por, estado)
  SELECT ('d0000001-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 15,
         now() - interval '11 days', 'Herrado de rutina', 'a0000001-0000-4000-8000-000000000004', 'realizada'
  FROM unnest(ARRAY[8, 9, 10]) AS n
  RETURNING id, caballo_id
)
INSERT INTO public.trabajo_sanitario_caballo (trabajo_id, caballo_id, estado, historial_id)
SELECT 'e1000001-0000-4000-8000-000000000003', h.caballo_id, 'realizado', h.id FROM h;

-- ---------------------------------------------------------------------------
-- Alertas (las de un vet no tienen sociedad: lo exige la RLS de `alerta`)
-- ---------------------------------------------------------------------------
INSERT INTO public.alerta (id, sociedad_id, motivo, fecha_alerta, creado_por) VALUES
  ('e3000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'Control de dentadura de los padrillos', current_date + 3,  'a0000001-0000-4000-8000-000000000002'),
  ('e3000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 'Renovar la vacuna de Pampero',         current_date + 20, 'a0000001-0000-4000-8000-000000000002'),
  ('e3000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000002', 'Revisar a los potrillos',               current_date + 4,  'a0000001-0000-4000-8000-000000000003'),
  ('e3000001-0000-4000-8000-000000000004', NULL,                                   'Control de Zafiro',                    current_date + 6,  'a0000001-0000-4000-8000-000000000004');

INSERT INTO public.alerta_caballo (alerta_id, caballo_id) VALUES
  ('e3000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000006'),
  ('e3000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000007'),
  ('e3000001-0000-4000-8000-000000000002', 'd0000001-0000-4000-8000-000000000006'),
  ('e3000001-0000-4000-8000-000000000003', 'd0000001-0000-4000-8000-000000000024'),
  ('e3000001-0000-4000-8000-000000000003', 'd0000001-0000-4000-8000-000000000025'),
  ('e3000001-0000-4000-8000-000000000004', 'd0000001-0000-4000-8000-000000000026');

-- ---------------------------------------------------------------------------
-- Notificaciones (la campanita del encabezado)
-- ---------------------------------------------------------------------------
INSERT INTO public.notificacion (usuario_id, sociedad_id, tipo, titulo, cuerpo, link, leida) VALUES
  ('a0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001', 'plan_compartido', 'Te compartieron un plan sanitario', 'Control odontológico — Haras Demo 1', '/sanidad', false),
  ('a0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001', 'plan_compartido', 'Te compartieron un plan sanitario', 'Vacunación antigripal — Haras Demo 1',  '/sanidad', true),
  ('a0000001-0000-4000-8000-000000000005', 'b0000001-0000-4000-8000-000000000002', 'plan_compartido', 'Te compartieron un plan sanitario', 'Vacunación — Haras Demo 2',               '/sanidad', false);
