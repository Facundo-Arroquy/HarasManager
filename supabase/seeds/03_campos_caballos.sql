-- =============================================================================
-- 03 · Campos, caballos y accesos de veterinarios
--
-- Datos ficticios. UUID fijos:
--   c0000001-…-0000000000NN campos      d0000001-…-0000000000NN caballos
--
-- Caballos:
--   01-12  Haras Demo 1       13-25  Haras Demo 2
--   26-31  propios de vet.demo1 (sin sociedad)
--   32-34  propios de vet.independiente.demo (sin sociedad)
--
-- Usuarios (ver 02_usuarios.sql): u02 admin1, u03 admin2, u04 vet1, u05 vet2,
-- u06 vet independiente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Campos
-- ---------------------------------------------------------------------------
INSERT INTO public.campo (id, sociedad_id, nombre, descripcion, vet_owner_id) VALUES
  ('c0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'Campo Norte',        'Yeguas de cría y padrillos', NULL),
  ('c0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 'Campo Sur',          'Receptoras',                 NULL),
  ('c0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000001', 'Potrero del Monte',  'Caballos de juego',          NULL),
  ('c0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000002', 'La Cañada',          'Donantes y padrillos',       NULL),
  ('c0000001-0000-4000-8000-000000000005', 'b0000001-0000-4000-8000-000000000002', 'El Paraíso',         'Receptoras',                 NULL),
  ('c0000001-0000-4000-8000-000000000006', 'b0000001-0000-4000-8000-000000000002', 'Potrero Chico',      'Caballos de juego',          NULL),
  ('c0000001-0000-4000-8000-000000000007', NULL,                                   'Campo del Vet',      'Campo propio del veterinario', 'a0000001-0000-4000-8000-000000000004');

-- ---------------------------------------------------------------------------
-- Caballos (sin pedigrí; el pedigrí se completa en el UPDATE de más abajo)
-- sexo: Yegua → H, Padrillo/Caballo → M, Potrillo → cualquiera (misma regla que
-- caballoService.resolverSexo en el front).
-- cat_raza: 1 Criollo, 3 Polo Argentino, 10 Sin raza definida.
-- ---------------------------------------------------------------------------
INSERT INTO public.caballo (
  id, nombre, fecha_nacimiento, categoria, sexo, raza_id, pelaje_id,
  numero_chip, numero_registro, sociedad_id, vet_owner_id, campo_id, rol_reproductivo
)
SELECT
  ('d0000001-0000-4000-8000-0000000000' || lpad(h.n::text, 2, '0'))::uuid,
  h.nombre, current_date - h.edad, h.categoria, h.sexo, h.raza_id, h.pelaje_id,
  CASE WHEN h.con_chip THEN '98200000000' || lpad(h.n::text, 4, '0') END,
  CASE WHEN h.con_chip THEN 'REG-DEMO-' || lpad(h.n::text, 3, '0') END,
  h.sociedad_id, h.vet_owner_id,
  CASE WHEN h.campo > 0 THEN ('c0000001-0000-4000-8000-00000000000' || h.campo)::uuid END,
  h.rol
FROM (VALUES
  -- Haras Demo 1 -----------------------------------------------------------
  ( 1, 'Estrella del Alba', interval '8 years',  'Yegua',    'H',  3,  3, true,  'b0000001-0000-4000-8000-000000000001'::uuid, NULL::uuid, 1, 'Donante'),
  ( 2, 'Luna Llena',        interval '9 years',  'Yegua',    'H',  3,  1, true,  'b0000001-0000-4000-8000-000000000001', NULL, 1, 'Donante'),
  ( 3, 'Tormenta',          interval '6 years',  'Yegua',    'H',  1,  2, true,  'b0000001-0000-4000-8000-000000000001', NULL, 2, 'Receptora'),
  ( 4, 'Brisa Marina',      interval '7 years',  'Yegua',    'H', 10,  4, false, 'b0000001-0000-4000-8000-000000000001', NULL, 2, 'Receptora'),
  ( 5, 'Candela',           interval '5 years',  'Yegua',    'H', 10,  3, false, 'b0000001-0000-4000-8000-000000000001', NULL, 2, 'Receptora'),
  ( 6, 'Pampero',           interval '10 years', 'Padrillo', 'M',  3,  1, true,  'b0000001-0000-4000-8000-000000000001', NULL, 1, NULL),
  ( 7, 'Rayo',              interval '11 years', 'Padrillo', 'M',  3,  3, true,  'b0000001-0000-4000-8000-000000000001', NULL, 1, NULL),
  ( 8, 'Trueno',            interval '7 years',  'Caballo',  'M',  3,  2, true,  'b0000001-0000-4000-8000-000000000001', NULL, 3, NULL),
  ( 9, 'Relámpago',         interval '6 years',  'Caballo',  'M',  3, 15, false, 'b0000001-0000-4000-8000-000000000001', NULL, 3, NULL),
  (10, 'Centella',          interval '8 years',  'Caballo',  'M',  3,  1, false, 'b0000001-0000-4000-8000-000000000001', NULL, 3, NULL),
  (11, 'Ñandú',             interval '1 year',   'Potrillo', 'M',  3,  1, false, 'b0000001-0000-4000-8000-000000000001', NULL, 1, NULL),
  (12, 'Aurora',            interval '1 year',   'Potrillo', 'H',  3,  3, false, 'b0000001-0000-4000-8000-000000000001', NULL, 1, NULL),
  -- Haras Demo 2 -----------------------------------------------------------
  (13, 'Dulce de Leche',    interval '8 years',  'Yegua',    'H',  3,  3, true,  'b0000001-0000-4000-8000-000000000002', NULL, 4, 'Donante'),
  (14, 'Pimienta',          interval '10 years', 'Yegua',    'H',  3,  1, true,  'b0000001-0000-4000-8000-000000000002', NULL, 4, 'Donante'),
  (15, 'Garúa',             interval '6 years',  'Yegua',    'H',  1,  2, false, 'b0000001-0000-4000-8000-000000000002', NULL, 5, 'Receptora'),
  (16, 'Escarcha',          interval '7 years',  'Yegua',    'H', 10,  4, false, 'b0000001-0000-4000-8000-000000000002', NULL, 5, 'Receptora'),
  (17, 'Mandarina',         interval '5 years',  'Yegua',    'H', 10,  3, false, 'b0000001-0000-4000-8000-000000000002', NULL, 5, 'Receptora'),
  (18, 'Zonda',             interval '6 years',  'Yegua',    'H',  1,  9, false, 'b0000001-0000-4000-8000-000000000002', NULL, 5, 'Receptora'),
  (19, 'Cacique',           interval '12 years', 'Padrillo', 'M',  3,  1, true,  'b0000001-0000-4000-8000-000000000002', NULL, 4, NULL),
  (20, 'Facón',             interval '9 years',  'Padrillo', 'M',  3,  3, true,  'b0000001-0000-4000-8000-000000000002', NULL, 4, NULL),
  (21, 'Malambo',           interval '7 years',  'Caballo',  'M',  3,  2, false, 'b0000001-0000-4000-8000-000000000002', NULL, 6, NULL),
  (22, 'Gualicho',          interval '8 years',  'Caballo',  'M',  3,  5, false, 'b0000001-0000-4000-8000-000000000002', NULL, 6, NULL),
  (23, 'Pehuén',            interval '6 years',  'Caballo',  'M',  3,  4, false, 'b0000001-0000-4000-8000-000000000002', NULL, 6, NULL),
  (24, 'Lucero',            interval '1 year',   'Potrillo', 'M',  3,  1, false, 'b0000001-0000-4000-8000-000000000002', NULL, 4, NULL),
  (25, 'Sol Naciente',      interval '1 year',   'Potrillo', 'H',  3,  3, false, 'b0000001-0000-4000-8000-000000000002', NULL, 4, NULL),
  -- Propios de vet.demo1 (sin sociedad) ------------------------------------
  (26, 'Zafiro',            interval '7 years',  'Caballo',  'M',  1,  2, false, NULL, 'a0000001-0000-4000-8000-000000000004', 7, NULL),
  (27, 'Gaucho',            interval '9 years',  'Padrillo', 'M',  1,  1, false, NULL, 'a0000001-0000-4000-8000-000000000004', 7, NULL),
  (28, 'Malevo',            interval '6 years',  'Caballo',  'M', 10,  3, false, NULL, 'a0000001-0000-4000-8000-000000000004', 7, NULL),
  (29, 'Cometa',            interval '5 years',  'Yegua',    'H', 10,  4, false, NULL, 'a0000001-0000-4000-8000-000000000004', 7, 'Receptora'),
  (30, 'Vesta',             interval '8 years',  'Yegua',    'H',  1,  3, false, NULL, 'a0000001-0000-4000-8000-000000000004', 7, 'Donante'),
  (31, 'Duende',            interval '1 year',   'Potrillo', 'M',  1,  1, false, NULL, 'a0000001-0000-4000-8000-000000000004', 7, NULL),
  -- Propios de vet.independiente.demo (sin sociedad) -----------------------
  (32, 'Nube',              interval '7 years',  'Yegua',    'H',  3,  2, false, NULL, 'a0000001-0000-4000-8000-000000000006', 0, 'Donante'),
  (33, 'Alfajor',           interval '10 years', 'Padrillo', 'M',  3,  3, false, NULL, 'a0000001-0000-4000-8000-000000000006', 0, NULL),
  (34, 'Chimango',          interval '5 years',  'Yegua',    'H',  1,  1, false, NULL, 'a0000001-0000-4000-8000-000000000006', 0, 'Receptora')
) AS h(n, nombre, edad, categoria, sexo, raza_id, pelaje_id, con_chip, sociedad_id, vet_owner_id, campo, rol);
-- (campo 0 = sin campo: los propios de vet.independiente no tienen)

-- Pedigrí de los potrillos
UPDATE public.caballo SET padre_id = 'd0000001-0000-4000-8000-000000000006', madre_id = 'd0000001-0000-4000-8000-000000000001' WHERE id = 'd0000001-0000-4000-8000-000000000011';
UPDATE public.caballo SET padre_id = 'd0000001-0000-4000-8000-000000000007', madre_id = 'd0000001-0000-4000-8000-000000000002' WHERE id = 'd0000001-0000-4000-8000-000000000012';
UPDATE public.caballo SET padre_id = 'd0000001-0000-4000-8000-000000000019', madre_id = 'd0000001-0000-4000-8000-000000000013' WHERE id = 'd0000001-0000-4000-8000-000000000024';
UPDATE public.caballo SET padre_id = 'd0000001-0000-4000-8000-000000000020', madre_id = 'd0000001-0000-4000-8000-000000000014' WHERE id = 'd0000001-0000-4000-8000-000000000025';

-- Tag "Jugador" (cat_tag 1): los caballos que pueden asignarse en un torneo
INSERT INTO public.caballo_tag (caballo_id, tag_id, creado_por)
SELECT ('d0000001-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 1,
       CASE WHEN n <= 12 THEN 'a0000001-0000-4000-8000-000000000002'::uuid ELSE 'a0000001-0000-4000-8000-000000000003'::uuid END
FROM unnest(ARRAY[8, 9, 10, 21, 22, 23]) AS n;

-- ---------------------------------------------------------------------------
-- Accesos de veterinarios
--   vet.demo1  → los 12 caballos de Haras Demo 1 + sus 6 propios
--   vet.demo2  → los 13 de Haras Demo 2
--   vet.independiente → sus 3 propios + 4 de Demo 1 (por caballo) y TODA
--                       Haras Demo 2 (acceso_vet_sociedad). No tiene membresía.
-- ---------------------------------------------------------------------------
INSERT INTO public.acceso_vet (vet_id, caballo_id, otorgado_por)
SELECT 'a0000001-0000-4000-8000-000000000004', c.id,
       CASE WHEN c.sociedad_id IS NULL THEN 'a0000001-0000-4000-8000-000000000004'::uuid
            ELSE 'a0000001-0000-4000-8000-000000000002'::uuid END
FROM public.caballo c
WHERE c.sociedad_id = 'b0000001-0000-4000-8000-000000000001' OR c.vet_owner_id = 'a0000001-0000-4000-8000-000000000004';

INSERT INTO public.acceso_vet (vet_id, caballo_id, otorgado_por)
SELECT 'a0000001-0000-4000-8000-000000000005', c.id, 'a0000001-0000-4000-8000-000000000003'
FROM public.caballo c WHERE c.sociedad_id = 'b0000001-0000-4000-8000-000000000002';

INSERT INTO public.acceso_vet (vet_id, caballo_id, otorgado_por)
SELECT 'a0000001-0000-4000-8000-000000000006', c.id,
       CASE WHEN c.vet_owner_id IS NOT NULL THEN 'a0000001-0000-4000-8000-000000000006'::uuid
            ELSE 'a0000001-0000-4000-8000-000000000002'::uuid END
FROM public.caballo c
WHERE c.vet_owner_id = 'a0000001-0000-4000-8000-000000000006'
   OR c.id IN ('d0000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000002',
               'd0000001-0000-4000-8000-000000000003', 'd0000001-0000-4000-8000-000000000006');

INSERT INTO public.acceso_vet_sociedad (vet_id, sociedad_id, otorgado_por)
VALUES ('a0000001-0000-4000-8000-000000000006', 'b0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000003');
