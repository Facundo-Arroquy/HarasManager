-- =================================================================
-- DEMO SEED — HarasManager
-- Ejecutar en el SQL Editor de Supabase con rol service_role
--
-- UUIDs fijos para referencias cruzadas:
--   Sociedad:   b0000000-0000-0000-0000-000000000001
--   Marca m1:   b0000000-0000-0000-0000-000000000010  (La Cimarrona)
--   Marca m2:   b0000000-0000-0000-0000-000000000011  (Los Ombúes Polo)
--   User u1:    b0000000-0000-0000-0000-000000000020  admin@harasdemo.test   (admin haras)
--   User u2:    b0000000-0000-0000-0000-000000000021  vet@harasdemo.test     (veterinario)
--   User u3:    b0000000-0000-0000-0000-000000000022  admin@lacimarrona.test (admin marca)
--   User u4:    b0000000-0000-0000-0000-000000000023  nicanor@lacimarrona.test  (jugador)
--   User u5:    b0000000-0000-0000-0000-000000000024  fortunato@losombues.test  (peticero)
--   Caballos:   b0000000-0000-0000-0000-00000000003x  (x = 0..7)
--   Contraseña de todos los usuarios demo: Demo1234!
-- =================================================================


-- =================================================================
-- PASO 1: Catálogos (idempotente con ON CONFLICT)
-- =================================================================

INSERT INTO cat_tipo_consulta (nombre) VALUES
  ('Consulta general'),
  ('Cirugía'),
  ('Vacunación'),
  ('Desparasitación'),
  ('Odontología'),
  ('Podología'),
  ('Reproducción'),
  ('Urgencia')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO cat_parte_cuerpo (nombre) VALUES
  ('Cabeza'),
  ('Cuello'),
  ('Tronco'),
  ('Columna'),
  ('Abdomen'),
  ('Miembro anterior izquierdo'),
  ('Miembro anterior derecho'),
  ('Miembro posterior izquierdo'),
  ('Miembro posterior derecho'),
  ('Casco')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO cat_raza (nombre) VALUES
  ('Polo Argentino'),
  ('Sangre Pura de Carrera'),
  ('Cuarto de Milla'),
  ('Criollo'),
  ('Árabe'),
  ('Warmblood'),
  ('Mestizo')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO cat_pelaje (nombre) VALUES
  ('Alazán'),
  ('Zaino'),
  ('Tordillo'),
  ('Oscuro'),
  ('Bayo'),
  ('Picazo'),
  ('Rosillo'),
  ('Palomino')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO cat_rol (nombre) VALUES
  ('admin'),
  ('veterinario'),
  ('piloto'),
  ('jugador'),
  ('peticero')
ON CONFLICT (nombre) DO NOTHING;


-- =================================================================
-- PASO 2: Usuarios en auth.users (requiere service_role / postgres)
-- Si ya los creaste por el Dashboard de Supabase, saltear este
-- bloque y actualizar las UUIDs en los pasos siguientes.
-- =================================================================

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
)
VALUES
  ('b0000000-0000-0000-0000-000000000020',
   '00000000-0000-0000-0000-000000000000',
   'admin@harasdemo.test', crypt('Demo1234!', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   NOW(), NOW(), 'authenticated', 'authenticated'),

  ('b0000000-0000-0000-0000-000000000021',
   '00000000-0000-0000-0000-000000000000',
   'vet@harasdemo.test', crypt('Demo1234!', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   NOW(), NOW(), 'authenticated', 'authenticated'),

  ('b0000000-0000-0000-0000-000000000022',
   '00000000-0000-0000-0000-000000000000',
   'admin@lacimarrona.test', crypt('Demo1234!', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   NOW(), NOW(), 'authenticated', 'authenticated'),

  ('b0000000-0000-0000-0000-000000000023',
   '00000000-0000-0000-0000-000000000000',
   'nicanor@lacimarrona.test', crypt('Demo1234!', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   NOW(), NOW(), 'authenticated', 'authenticated'),

  ('b0000000-0000-0000-0000-000000000024',
   '00000000-0000-0000-0000-000000000000',
   'fortunato@losombues.test', crypt('Demo1234!', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   NOW(), NOW(), 'authenticated', 'authenticated')

ON CONFLICT (id) DO NOTHING;


-- =================================================================
-- PASO 3: Sociedad
-- =================================================================

INSERT INTO sociedad (id, nombre, cuit, direccion)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Haras El Zorzal',
  '30-00000001-0',
  'Camino de los Teros km 12, Villa Porvenir, Buenos Aires (Demo)'
)
ON CONFLICT (id) DO NOTHING;


-- =================================================================
-- PASO 4: Usuarios (tabla de negocio — espejo de auth.users)
-- =================================================================

INSERT INTO usuario (id, nombre, apellido, email, telefono, rol)
VALUES
  ('b0000000-0000-0000-0000-000000000020', 'Rómulo',    'Zampieri',  'admin@harasdemo.test',    '+54 9 2999 000-001', NULL),
  ('b0000000-0000-0000-0000-000000000021', 'Brunilda',  'Salcedo',   'vet@harasdemo.test',      '+54 9 2999 000-002', 'veterinario'),
  ('b0000000-0000-0000-0000-000000000022', 'Wenceslao', 'Frías',     'admin@lacimarrona.test',  '+54 9 2999 000-003', NULL),
  ('b0000000-0000-0000-0000-000000000023', 'Nicanor',   'Saldías',   'nicanor@lacimarrona.test','+54 9 2999 000-004', NULL),
  ('b0000000-0000-0000-0000-000000000024', 'Fortunato', 'Breglia',   'fortunato@losombues.test','+54 9 2999 000-005', NULL)
ON CONFLICT (id) DO NOTHING;


-- =================================================================
-- PASO 5: Marcas
-- =================================================================

INSERT INTO marca (id, sociedad_id, nombre, dominio_email)
VALUES
  ('b0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000001',
   'La Cimarrona', 'lacimarrona.test'),

  ('b0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000001',
   'Los Ombúes Polo', 'losombues.test')
ON CONFLICT (id) DO NOTHING;


-- =================================================================
-- PASO 6: Membresías (un INSERT por fila para poder usar subquery)
-- =================================================================

INSERT INTO membresia (usuario_id, sociedad_id, rol_id)
SELECT
  'b0000000-0000-0000-0000-000000000020',
  'b0000000-0000-0000-0000-000000000001',
  id FROM cat_rol WHERE nombre = 'admin'
ON CONFLICT (usuario_id, sociedad_id, rol_id) DO NOTHING;

INSERT INTO membresia (usuario_id, sociedad_id, rol_id)
SELECT
  'b0000000-0000-0000-0000-000000000021',
  'b0000000-0000-0000-0000-000000000001',
  id FROM cat_rol WHERE nombre = 'veterinario'
ON CONFLICT (usuario_id, sociedad_id, rol_id) DO NOTHING;

INSERT INTO membresia (usuario_id, sociedad_id, rol_id)
SELECT
  'b0000000-0000-0000-0000-000000000022',
  'b0000000-0000-0000-0000-000000000001',
  id FROM cat_rol WHERE nombre = 'admin'
ON CONFLICT (usuario_id, sociedad_id, rol_id) DO NOTHING;

INSERT INTO membresia (usuario_id, sociedad_id, rol_id)
SELECT
  'b0000000-0000-0000-0000-000000000023',
  'b0000000-0000-0000-0000-000000000001',
  id FROM cat_rol WHERE nombre = 'jugador'
ON CONFLICT (usuario_id, sociedad_id, rol_id) DO NOTHING;

INSERT INTO membresia (usuario_id, sociedad_id, rol_id)
SELECT
  'b0000000-0000-0000-0000-000000000024',
  'b0000000-0000-0000-0000-000000000001',
  id FROM cat_rol WHERE nombre = 'peticero'
ON CONFLICT (usuario_id, sociedad_id, rol_id) DO NOTHING;


-- =================================================================
-- PASO 7: Caballos
-- rol_reproductivo fue agregado por migración posterior al schema base
-- =================================================================

INSERT INTO caballo (
  id, nombre, fecha_nacimiento, categoria,
  raza_id, pelaje_id,
  numero_chip, numero_registro,
  sociedad_id, marca_id, rol_reproductivo
)
SELECT
  t.id, t.nombre, t.fecha_nacimiento, t.categoria,
  (SELECT id FROM cat_raza   WHERE nombre = t.raza),
  (SELECT id FROM cat_pelaje WHERE nombre = t.pelaje),
  t.chip, t.registro,
  'b0000000-0000-0000-0000-000000000001',
  t.marca_id,
  t.rol_reproductivo
FROM (VALUES
  -- ── La Cimarrona ─────────────────────────────────────────────
  ('b0000000-0000-0000-0000-000000000030'::uuid,
   'Tordona',     '2018-03-12'::date, 'Yegua',
   'Polo Argentino',        'Alazán',
   'ARG-CHI-001', 'AACCE-001',
   'b0000000-0000-0000-0000-000000000010'::uuid, 'Donante'),

  ('b0000000-0000-0000-0000-000000000031'::uuid,
   'Curuzú',  '2017-07-04'::date, 'Yegua',
   'Polo Argentino',        'Zaino',
   'ARG-CHI-002', 'AACCE-002',
   'b0000000-0000-0000-0000-000000000010'::uuid, 'Receptora'),

  ('b0000000-0000-0000-0000-000000000032'::uuid,
   'Zorzalito',    '2016-11-20'::date, 'Padrillo',
   'Sangre Pura de Carrera','Tordillo',
   'ARG-CHI-003', 'AACCE-003',
   'b0000000-0000-0000-0000-000000000010'::uuid, NULL),

  ('b0000000-0000-0000-0000-000000000033'::uuid,
   'Cieluna','2020-05-08'::date, 'Yegua',
   'Polo Argentino',        'Picazo',
   'ARG-CHI-004', 'AACCE-004',
   'b0000000-0000-0000-0000-000000000010'::uuid, 'Receptora'),

  ('b0000000-0000-0000-0000-000000000034'::uuid,
   'Fogarín', '2022-01-15'::date, 'Potrillo',
   'Mestizo',               'Bayo',
   'ARG-CHI-005', NULL,
   'b0000000-0000-0000-0000-000000000010'::uuid, NULL),

  ('b0000000-0000-0000-0000-000000000035'::uuid,
   'Trovazul', '2019-09-30'::date, 'Yegua',
   'Polo Argentino',        'Rosillo',
   'ARG-CHI-006', 'AACCE-006',
   'b0000000-0000-0000-0000-000000000010'::uuid, 'Donante'),

  -- ── Los Ombúes Polo ──────────────────────────────────────────
  ('b0000000-0000-0000-0000-000000000036'::uuid,
   'Charanguero',  '2015-02-25'::date, 'Caballo',
   'Criollo',               'Oscuro',
   'ARG-CHI-007', 'AACCE-007',
   'b0000000-0000-0000-0000-000000000011'::uuid, NULL),

  ('b0000000-0000-0000-0000-000000000037'::uuid,
   'Tonada','2021-06-10'::date, 'Yegua',
   'Polo Argentino',        'Alazán',
   'ARG-CHI-008', 'AACCE-008',
   'b0000000-0000-0000-0000-000000000011'::uuid, 'Donante')

) AS t(id, nombre, fecha_nacimiento, categoria, raza, pelaje, chip, registro, marca_id, rol_reproductivo)
ON CONFLICT (id) DO NOTHING;


-- =================================================================
-- PASO 8: Acceso veterinario
-- u2 (Dra. Salcedo) tiene acceso masivo a La Cimarrona + acceso
-- individual a Charanguero (Los Ombúes Polo), otorgado por el admin haras.
-- =================================================================

INSERT INTO acceso_veterinario (vet_id, marca_id, caballo_id, otorgado_por)
VALUES
  ('b0000000-0000-0000-0000-000000000021',
   'b0000000-0000-0000-0000-000000000010',
   NULL,
   'b0000000-0000-0000-0000-000000000020'),

  ('b0000000-0000-0000-0000-000000000021',
   NULL,
   'b0000000-0000-0000-0000-000000000036',
   'b0000000-0000-0000-0000-000000000020');


-- =================================================================
-- PASO 9: Historial clínico
-- =================================================================

-- Registro 1: Tordona — Vacunación
INSERT INTO historial_clinico (
  id, caballo_id, tipo_consulta_id, fecha_consulta,
  diagnostico, tratamiento, observaciones, proxima_consulta, creado_por
)
SELECT
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'b0000000-0000-0000-0000-000000000030',
  (SELECT id FROM cat_tipo_consulta WHERE nombre = 'Vacunación'),
  '2025-08-15 10:00:00+00',
  'Animal en buen estado general.',
  'Vacuna triple equina + Influenza.',
  'Sin reacciones adversas. Próxima dosis en 6 meses.',
  '2026-02-15',
  'b0000000-0000-0000-0000-000000000021'
ON CONFLICT (id) DO NOTHING;

INSERT INTO historial_medicamento (historial_id, medicamento, dosis, via_administracion, duracion_dias)
VALUES
  ('c0000000-0000-0000-0000-000000000001',
   'Vacuna Triple Equina', '2 ml', 'Intramuscular', 1),
  ('c0000000-0000-0000-0000-000000000001',
   'Vacuna Influenza Equina', '2 ml', 'Intramuscular', 1);

-- Registro 2: Curuzú — Consulta general con parte afectada
INSERT INTO historial_clinico (
  id, caballo_id, tipo_consulta_id, fecha_consulta,
  diagnostico, tratamiento, observaciones, proxima_consulta, creado_por
)
SELECT
  'c0000000-0000-0000-0000-000000000002'::uuid,
  'b0000000-0000-0000-0000-000000000031',
  (SELECT id FROM cat_tipo_consulta WHERE nombre = 'Consulta general'),
  '2025-10-03 09:30:00+00',
  'Claudicación leve en miembro posterior derecho. Probable sobrecarga muscular.',
  'Reposo relativo 7 días. Aplicación de frío local 2 veces al día.',
  'Se recomienda evitar trabajo de alta intensidad por 15 días.',
  '2025-10-17',
  'b0000000-0000-0000-0000-000000000021'
ON CONFLICT (id) DO NOTHING;

INSERT INTO historial_parte_afectada (historial_id, parte_cuerpo_id, lado, descripcion)
SELECT
  'c0000000-0000-0000-0000-000000000002',
  (SELECT id FROM cat_parte_cuerpo WHERE nombre = 'Miembro posterior derecho'),
  'derecho',
  'Inflamación leve en tendón flexor. Sin lesión evidente en ecografía.';

INSERT INTO historial_medicamento (historial_id, medicamento, dosis, via_administracion, duracion_dias)
VALUES
  ('c0000000-0000-0000-0000-000000000002',
   'Fenilbutazona', '4 mg/kg', 'Oral', 5);

-- Registro 3: Zorzalito — Odontología
INSERT INTO historial_clinico (
  id, caballo_id, tipo_consulta_id, fecha_consulta,
  diagnostico, tratamiento, observaciones, creado_por
)
SELECT
  'c0000000-0000-0000-0000-000000000003'::uuid,
  'b0000000-0000-0000-0000-000000000032',
  (SELECT id FROM cat_tipo_consulta WHERE nombre = 'Odontología'),
  '2025-11-20 08:00:00+00',
  'Puntas de esmalte excesivas en molares superiores.',
  'Desgaste manual con fresa. Egualación de arcadas.',
  'Próximo control odontológico en 12 meses.',
  'b0000000-0000-0000-0000-000000000021'
ON CONFLICT (id) DO NOTHING;

-- Registro 4: Tordona — Reproducción
INSERT INTO historial_clinico (
  id, caballo_id, tipo_consulta_id, fecha_consulta,
  diagnostico, tratamiento, observaciones, proxima_consulta, creado_por
)
SELECT
  'c0000000-0000-0000-0000-000000000004'::uuid,
  'b0000000-0000-0000-0000-000000000030',
  (SELECT id FROM cat_tipo_consulta WHERE nombre = 'Reproducción'),
  '2026-01-10 07:30:00+00',
  'Folículo dominante en ovario derecho (38 mm). Útero con buen tono.',
  'Inducción con hCG 3000 UI IV.',
  'Ovulación estimada 36-40 h post inducción. Programar flushing.',
  '2026-01-25',
  'b0000000-0000-0000-0000-000000000021'
ON CONFLICT (id) DO NOTHING;

-- Registro 5: Charanguero — Desparasitación
INSERT INTO historial_clinico (
  id, caballo_id, tipo_consulta_id, fecha_consulta,
  diagnostico, tratamiento, observaciones, proxima_consulta, creado_por
)
SELECT
  'c0000000-0000-0000-0000-000000000005'::uuid,
  'b0000000-0000-0000-0000-000000000036',
  (SELECT id FROM cat_tipo_consulta WHERE nombre = 'Desparasitación'),
  '2025-09-05 11:00:00+00',
  'Control parasitario de rutina. Sin signos clínicos.',
  'Ivermectina 0.2 mg/kg VO. Praziquantel 5 mg/kg VO.',
  'Rotación programada en primavera.',
  '2026-03-05',
  'b0000000-0000-0000-0000-000000000021'
ON CONFLICT (id) DO NOTHING;

INSERT INTO historial_medicamento (historial_id, medicamento, dosis, via_administracion, duracion_dias)
VALUES
  ('c0000000-0000-0000-0000-000000000005',
   'Ivermectina', '0.2 mg/kg', 'Oral', 1),
  ('c0000000-0000-0000-0000-000000000005',
   'Praziquantel', '5 mg/kg', 'Oral', 1);

-- Registro 6: Trovazul — Urgencia
INSERT INTO historial_clinico (
  id, caballo_id, tipo_consulta_id, fecha_consulta,
  diagnostico, tratamiento, observaciones, proxima_consulta, creado_por
)
SELECT
  'c0000000-0000-0000-0000-000000000006'::uuid,
  'b0000000-0000-0000-0000-000000000035',
  (SELECT id FROM cat_tipo_consulta WHERE nombre = 'Urgencia'),
  '2026-02-14 03:15:00+00',
  'Cólico espástico moderado. Aumento de motilidad intestinal audible.',
  'Espasmolítico EV + hidratación IV. Resolución en 2 horas.',
  'Alta a las 06:00 hs. Control a las 24 h.',
  '2026-02-15',
  'b0000000-0000-0000-0000-000000000021'
ON CONFLICT (id) DO NOTHING;

INSERT INTO historial_parte_afectada (historial_id, parte_cuerpo_id, lado, descripcion)
SELECT
  'c0000000-0000-0000-0000-000000000006',
  (SELECT id FROM cat_parte_cuerpo WHERE nombre = 'Abdomen'),
  'bilateral',
  'Distensión leve de colon ascendente. Sin impactación.';

INSERT INTO historial_medicamento (historial_id, medicamento, dosis, via_administracion, duracion_dias)
VALUES
  ('c0000000-0000-0000-0000-000000000006',
   'N-Butil Escopolamina', '0.1 mg/kg', 'Intravenosa', 1),
  ('c0000000-0000-0000-0000-000000000006',
   'Solución Ringer Lactato', '5 L', 'Intravenosa', 1);


-- =================================================================
-- PASO 10: Centro de Embriones
-- =================================================================

-- ── Registros clínicos reproductivos ────────────────────────────

-- Tordona: seguimiento pre-flushing
INSERT INTO cria_registro_clinico (
  id, caballo_id, sociedad_id, fecha, veterinario_id,
  ovario_izq, ovario_der, utero, obs_chips,
  padrillo_id, ov_dias,
  review_manana, review_manana_desc,
  motivo, diagnostico, tratamiento
)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000030',
  'b0000000-0000-0000-0000-000000000001',
  '2026-01-08',
  'b0000000-0000-0000-0000-000000000021',
  ARRAY['Folículo 25mm'],
  ARRAY['Folículo dominante 38mm'],
  ARRAY['Edema +', 'Tono bueno'],
  ARRAY[]::TEXT[],
  'b0000000-0000-0000-0000-000000000032',
  NULL,
  TRUE, 'Revisar folículo — esperado ≥ 40 mm para inducir',
  'Evaluación pre-flushing',
  'Folículo dominante derecho en crecimiento activo.',
  'Sin tratamiento. Control mañana.'
) ON CONFLICT (id) DO NOTHING;

-- Tordona: inducción
INSERT INTO cria_registro_clinico (
  id, caballo_id, sociedad_id, fecha, veterinario_id,
  ovario_izq, ovario_der, utero, obs_chips,
  padrillo_id, ov_dias,
  motivo, diagnostico, tratamiento
)
VALUES (
  'd0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000030',
  'b0000000-0000-0000-0000-000000000001',
  '2026-01-10',
  'b0000000-0000-0000-0000-000000000021',
  ARRAY['Folículo 22mm'],
  ARRAY['Folículo 42mm — inducido'],
  ARRAY['Edema ++', 'Tono muy bueno'],
  ARRAY[]::TEXT[],
  'b0000000-0000-0000-0000-000000000032',
  NULL,
  'Inducción a la ovulación',
  'Folículo ≥ 40 mm. Condición óptima para inducir.',
  'hCG 3000 UI IV. Flushing programado día +8.'
) ON CONFLICT (id) DO NOTHING;

-- ── Recordatorio generado automáticamente ───────────────────────

INSERT INTO cria_recordatorio (
  id, caballo_id, sociedad_id, tipo, fecha_vto, estado,
  veterinario_id, notas, auto_generado, origen_registro_id
)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000030',
  'b0000000-0000-0000-0000-000000000001',
  'Flushing',
  '2026-01-18',
  'hecho',
  'b0000000-0000-0000-0000-000000000021',
  'Flushing post-inducción de Tordona x Zorzalito.',
  TRUE,
  'd0000000-0000-0000-0000-000000000002'
) ON CONFLICT (id) DO NOTHING;

-- ── Flushing (resultado positivo) ───────────────────────────────

INSERT INTO cria_flushing (
  id, caballo_id, sociedad_id, fecha, veterinario_id,
  es_negativo, cantidad, estadio, grado, tamanio, zona_pelucida,
  padrillo_id, origen_recordatorio_id, pg_given
)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000030',
  'b0000000-0000-0000-0000-000000000001',
  '2026-01-18',
  'b0000000-0000-0000-0000-000000000021',
  FALSE,
  2,
  'Blastocisto',
  1,
  'Mediano',
  'Intacta',
  'b0000000-0000-0000-0000-000000000032',
  'e0000000-0000-0000-0000-000000000001',
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- Recordatorio para dar PG post-flushing
INSERT INTO cria_recordatorio (
  id, caballo_id, sociedad_id, tipo, fecha_vto, estado,
  veterinario_id, notas, auto_generado, origen_registro_id
)
VALUES (
  'e0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000030',
  'b0000000-0000-0000-0000-000000000001',
  'Dar PG',
  '2026-01-20',
  'hecho',
  'b0000000-0000-0000-0000-000000000021',
  'PG a Tordona 2 días post-flushing.',
  TRUE,
  'd0000000-0000-0000-0000-000000000002'
) ON CONFLICT (id) DO NOTHING;

-- ── Registro clínico de receptoras ──────────────────────────────

-- Curuzú: evaluación como receptora
INSERT INTO cria_registro_clinico (
  id, caballo_id, sociedad_id, fecha, veterinario_id,
  ovario_izq, ovario_der, utero, obs_chips,
  ov_dias,
  motivo, diagnostico, tratamiento
)
VALUES (
  'd0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000031',
  'b0000000-0000-0000-0000-000000000001',
  '2026-01-17',
  'b0000000-0000-0000-0000-000000000021',
  ARRAY['CL activo'],
  ARRAY['CL activo', 'Pequeño folículo 15mm'],
  ARRAY['Sin edema', 'Tono bueno'],
  ARRAY[]::TEXT[],
  3,
  'Evaluación receptora para transferencia',
  'CL bilateral. Sincronía con donante estimada: ok.',
  'Apta para transferencia mañana.'
) ON CONFLICT (id) DO NOTHING;

-- ── Transferencia de embrión ─────────────────────────────────────

INSERT INTO cria_transferencia (
  id, sociedad_id, fecha, veterinario_id,
  registro_id, caballo_receptora_id, caballo_donante_id,
  padrillo_id, flushing_id,
  cl_calidad, tono_uterino, tono_cervical,
  clasificacion, notas
)
VALUES (
  'g0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  '2026-01-19',
  'b0000000-0000-0000-0000-000000000021',
  'd0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000031',
  'b0000000-0000-0000-0000-000000000030',
  'b0000000-0000-0000-0000-000000000032',
  'f0000000-0000-0000-0000-000000000001',
  'Buena', 'Normal', 'Cerrado',
  'Fresco',
  'Transferencia exitosa. Embrión Blastocisto grado 1. Receptora en día 3 de ovulación.'
) ON CONFLICT (id) DO NOTHING;

-- Recordatorio de revisión post-transferencia
INSERT INTO cria_recordatorio (
  id, caballo_id, sociedad_id, tipo, fecha_vto, estado,
  veterinario_id, notas, auto_generado
)
VALUES (
  'e0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000031',
  'b0000000-0000-0000-0000-000000000001',
  'Revisión',
  '2026-02-02',
  'pendiente',
  'b0000000-0000-0000-0000-000000000021',
  'Confirmar preñez por ecografía a los 14 días post-transferencia.',
  TRUE,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- ── Trovazul: flushing negativo ─────────────────────────────

INSERT INTO cria_registro_clinico (
  id, caballo_id, sociedad_id, fecha, veterinario_id,
  ovario_izq, ovario_der, utero, obs_chips,
  padrillo_id, ov_dias,
  motivo, diagnostico, tratamiento
)
VALUES (
  'd0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000035',
  'b0000000-0000-0000-0000-000000000001',
  '2026-02-20',
  'b0000000-0000-0000-0000-000000000021',
  ARRAY['CL', 'Folículo 12mm'],
  ARRAY['CL post-ovulación'],
  ARRAY['Buen tono', 'Sin líquido'],
  ARRAY[]::TEXT[],
  'b0000000-0000-0000-0000-000000000032',
  8,
  'Flushing programado',
  'Lavado uterino completado. Sin embriones recuperados.',
  'Dar PG para reiniciar ciclo. Reagendar próximo flushing.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO cria_flushing (
  id, caballo_id, sociedad_id, fecha, veterinario_id,
  es_negativo, padrillo_id, pg_given
)
VALUES (
  'f0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000035',
  'b0000000-0000-0000-0000-000000000001',
  '2026-02-20',
  'b0000000-0000-0000-0000-000000000021',
  TRUE,
  'b0000000-0000-0000-0000-000000000032',
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- Recordatorio de próximo flushing (pendiente)
INSERT INTO cria_recordatorio (
  id, caballo_id, sociedad_id, tipo, fecha_vto, estado,
  veterinario_id, notas, auto_generado
)
VALUES (
  'e0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000035',
  'b0000000-0000-0000-0000-000000000001',
  'Flushing',
  '2026-03-10',
  'pendiente',
  'b0000000-0000-0000-0000-000000000021',
  'Segundo intento de flushing para Trovazul.',
  TRUE,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Recordatorio próximo: IN para Cieluna (receptora)
INSERT INTO cria_recordatorio (
  id, caballo_id, sociedad_id, tipo, fecha_vto, estado,
  veterinario_id, notas, auto_generado
)
VALUES (
  'e0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000033',
  'b0000000-0000-0000-0000-000000000001',
  'IN',
  '2026-03-05',
  'pendiente',
  'b0000000-0000-0000-0000-000000000021',
  'Sincronización con donante Tordona para campaña marzo.',
  FALSE,
  NULL
) ON CONFLICT (id) DO NOTHING;


-- =================================================================
-- PASO 11: Historial de propiedad (primera asignación de cada caballo)
-- =================================================================

INSERT INTO historial_propiedad (
  caballo_id, marca_anterior_id, marca_nueva_id,
  fecha_transferencia, registrado_por, observaciones
)
SELECT *
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000030'::uuid, NULL, 'b0000000-0000-0000-0000-000000000010'::uuid, '2018-04-01'::date, 'b0000000-0000-0000-0000-000000000020'::uuid, 'Primera asignación'),
  ('b0000000-0000-0000-0000-000000000031'::uuid, NULL, 'b0000000-0000-0000-0000-000000000010'::uuid, '2017-08-01'::date, 'b0000000-0000-0000-0000-000000000020'::uuid, 'Primera asignación'),
  ('b0000000-0000-0000-0000-000000000032'::uuid, NULL, 'b0000000-0000-0000-0000-000000000010'::uuid, '2017-01-10'::date, 'b0000000-0000-0000-0000-000000000020'::uuid, 'Primera asignación'),
  ('b0000000-0000-0000-0000-000000000033'::uuid, NULL, 'b0000000-0000-0000-0000-000000000010'::uuid, '2020-06-01'::date, 'b0000000-0000-0000-0000-000000000020'::uuid, 'Primera asignación'),
  ('b0000000-0000-0000-0000-000000000034'::uuid, NULL, 'b0000000-0000-0000-0000-000000000010'::uuid, '2022-02-01'::date, 'b0000000-0000-0000-0000-000000000020'::uuid, 'Primera asignación'),
  ('b0000000-0000-0000-0000-000000000035'::uuid, NULL, 'b0000000-0000-0000-0000-000000000010'::uuid, '2019-10-15'::date, 'b0000000-0000-0000-0000-000000000020'::uuid, 'Primera asignación'),
  ('b0000000-0000-0000-0000-000000000036'::uuid, NULL, 'b0000000-0000-0000-0000-000000000011'::uuid, '2015-03-01'::date, 'b0000000-0000-0000-0000-000000000020'::uuid, 'Primera asignación'),
  ('b0000000-0000-0000-0000-000000000037'::uuid, NULL, 'b0000000-0000-0000-0000-000000000011'::uuid, '2021-07-01'::date, 'b0000000-0000-0000-0000-000000000020'::uuid, 'Primera asignación')
) AS t(caballo_id, marca_anterior_id, marca_nueva_id, fecha_transferencia, registrado_por, observaciones);
