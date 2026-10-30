-- =============================================================================
-- 01 · Catálogos globales
--
-- Datos de referencia copiados de producción el 2026-10-25 (cat_modulo,
-- cat_parte_cuerpo, cat_pelaje, cat_raza, cat_rol, cat_tag, cat_tipo_consulta).
-- No contienen datos de clientes. Se omitieron dos filas de prueba de
-- cat_tipo_consulta ("Prueba 1" y "Prueba 2"). Después van el plan de suscripción
-- de veterinarios y los términos y condiciones (texto de prueba, no el real).
-- =============================================================================

INSERT INTO "public"."cat_modulo" ("id", "codigo", "nombre", "activo", "created_at") VALUES
	(1, 'centro_cria', 'Centro de Embriones', true, '2026-08-10 18:50:41.113892+00'),
	(2, 'polo', 'Polo', true, '2026-08-10 18:50:41.113892+00');

INSERT INTO "public"."cat_parte_cuerpo" ("id", "nombre") VALUES
	(1, 'Cabeza'),
	(2, 'Cuello'),
	(3, 'Lomo'),
	(4, 'Grupa'),
	(5, 'Cola'),
	(6, 'Pecho'),
	(7, 'Abdomen'),
	(8, 'Hombro derecho'),
	(9, 'Brazo derecho'),
	(10, 'Antebrazo derecho'),
	(11, 'Rodilla delantera derecha'),
	(12, 'Caña delantera derecha'),
	(13, 'Menudillo delantero derecho'),
	(14, 'Cuartilla delantera derecha'),
	(15, 'Casco delantero derecho'),
	(16, 'Hombro izquierdo'),
	(17, 'Brazo izquierdo'),
	(18, 'Antebrazo izquierdo'),
	(19, 'Rodilla delantera izquierda'),
	(20, 'Caña delantera izquierda'),
	(21, 'Menudillo delantero izquierdo'),
	(22, 'Cuartilla delantera izquierda'),
	(23, 'Casco delantero izquierdo'),
	(24, 'Anca derecha'),
	(25, 'Muslo derecho'),
	(26, 'Corvejón derecho'),
	(27, 'Caña trasera derecha'),
	(28, 'Menudillo trasero derecho'),
	(29, 'Cuartilla trasera derecha'),
	(30, 'Casco trasero derecho'),
	(31, 'Anca izquierda'),
	(32, 'Muslo izquierdo'),
	(33, 'Corvejón izquierdo'),
	(34, 'Caña trasera izquierda'),
	(35, 'Menudillo trasero izquierdo'),
	(36, 'Cuartilla trasera izquierda'),
	(37, 'Casco trasero izquierdo');

INSERT INTO "public"."cat_pelaje" ("id", "nombre") VALUES
	(1, 'Zaino'),
	(2, 'Tordillo'),
	(3, 'Alazán'),
	(4, 'Bayo'),
	(5, 'Overo'),
	(6, 'Tobiano'),
	(7, 'Picazo'),
	(8, 'Rodado'),
	(9, 'Rosillo'),
	(10, 'Moro'),
	(11, 'Palomino'),
	(12, 'Zaino negro'),
	(13, 'Zaino colorado'),
	(14, 'Alazán tostado'),
	(15, 'Zaino oscuro'),
	(16, 'Gateado'),
	(17, 'Zaino pampa'),
	(18, 'Colorado');

INSERT INTO "public"."cat_raza" ("id", "nombre") VALUES
	(1, 'Criollo'),
	(2, 'Pura Sangre de Carrera'),
	(3, 'Polo Argentino'),
	(4, 'Cuarto de Milla'),
	(5, 'Árabe'),
	(6, 'Warmblood'),
	(7, 'Percherón'),
	(8, 'Appaloosa'),
	(9, 'Frisón'),
	(10, 'Sin raza definida');

INSERT INTO "public"."cat_rol" ("id", "nombre") VALUES
	(1, 'admin'),
	(2, 'veterinario'),
	(3, 'piloto'),
	(4, 'jugador'),
	(5, 'peticero');

INSERT INTO "public"."cat_tag" ("id", "nombre", "color", "activo", "created_at") VALUES
	(1, 'Jugador', 'emerald', true, '2026-08-02 23:00:54.390867+00');

INSERT INTO "public"."cat_tipo_consulta" ("id", "nombre") VALUES
	(1, 'Revisión general'),
	(2, 'Vacuna'),
	(3, 'Cirugía'),
	(4, 'Control de preñez'),
	(5, 'Desparasitación'),
	(6, 'Herraje'),
	(7, 'Odontología'),
	(8, 'Radiografía'),
	(9, 'Ecografía'),
	(10, 'Tratamiento ortopédico'),
	(11, 'Herida / sutura'),
	(12, 'Otro'),
	(13, 'Vacunación'),
	(15, 'Herrado'),
	(22, 'Extracción de sangre'),
	(24, 'Control odontológico'),
	(40, 'Rino');

SELECT pg_catalog.setval('"public"."cat_modulo_id_seq"', 2, true);
SELECT pg_catalog.setval('"public"."cat_parte_cuerpo_id_seq"', 37, true);
SELECT pg_catalog.setval('"public"."cat_pelaje_id_seq"', 18, true);
SELECT pg_catalog.setval('"public"."cat_raza_id_seq"', 10, true);
SELECT pg_catalog.setval('"public"."cat_rol_id_seq"', 5, true);
SELECT pg_catalog.setval('"public"."cat_tag_id_seq"', 1, true);
SELECT pg_catalog.setval('"public"."cat_tipo_consulta_id_seq"', 46, true);

-- ---------------------------------------------------------------------------
-- Plan de suscripción de veterinarios (mismo precio que prod)
-- ---------------------------------------------------------------------------
INSERT INTO public.plan_suscripcion_vet (id, codigo, nombre, precio, moneda, frecuencia, frecuencia_tipo, activo)
VALUES ('50000001-0000-4000-8000-000000000001', 'mensual', 'Membresía veterinario — mensual', 10000.00, 'ARS', 1, 'months', true);

-- ---------------------------------------------------------------------------
-- Términos y condiciones: texto de prueba. La v1 está inactiva y la v2 activa,
-- igual que en prod. No es el texto legal vigente.
-- ---------------------------------------------------------------------------
INSERT INTO public.terminos_condiciones (id, version, titulo, contenido, activo)
VALUES
  ('51000001-0000-4000-8000-000000000001', 1, 'Términos y Condiciones de Uso',
   'Texto de prueba del entorno local (versión 1, inactiva).', false),
  ('51000001-0000-4000-8000-000000000002', 2, 'Términos y Condiciones',
   'Texto de prueba del entorno local (versión 2, vigente). El texto legal real vive en producción.', true);
