-- =============================================================================
-- 02 · Sociedades, usuarios demo y permisos
--
-- Contraseña de desarrollo de TODOS los usuarios: Local-dev-2026
-- Es solo para esta base local. No coincide con ningún usuario de producción
-- (acá no se copia ningún hash de prod): los emails son los mismos que los demo
-- de prod, pero son cuentas distintas en otra base.
--
-- Usuarios (12):
--   superadmin.demo@haras.com             superadmin (ficticio, no existe en prod)
--   admin.demo1 / admin.demo2             admin de Haras Demo 1 / 2
--   vet.demo1 / vet.demo2                 veterinarios con membresía en cada haras
--   vet.independiente.demo                veterinario SIN membresía: solo accesos a
--                                         caballos y a una sociedad (ficticio)
--   jugador / peticero / piloto .demo1/2  un usuario de cada rol por haras
--
-- Los UUID son fijos para poder referenciarlos desde los otros archivos:
--   a0000001-…-0000000000NN usuarios      b0000001-…-00000000000N sociedades
--   f0000001-…-0000000000NN membresías
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Auth. El trigger on_auth_user_created crea la fila de `usuario` (y la de
-- suscripcion_veterinario para quienes piden rol veterinario).
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Local-dev-2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_strip_nulls(jsonb_build_object(
    'nombre', u.nombre, 'apellido', u.apellido,
    'rol_solicitado', u.rol_solicitado, 'dni', u.dni, 'matricula', u.matricula
  )),
  now(), now(), '', '', '', ''
FROM (VALUES
  ('a0000001-0000-4000-8000-000000000001'::uuid, 'superadmin.demo@haras.com',         'Super',    'Admin',         NULL::text,    NULL::text,  NULL::text),
  ('a0000001-0000-4000-8000-000000000002'::uuid, 'admin.demo1@haras.com',             'Admin',    'Demo 1',        NULL,          NULL,        NULL),
  ('a0000001-0000-4000-8000-000000000003'::uuid, 'admin.demo2@haras.com',             'Admin',    'Demo 2',        NULL,          NULL,        NULL),
  ('a0000001-0000-4000-8000-000000000004'::uuid, 'vet.demo1@haras.com',               'Vet',      'Demo 1',        'veterinario', '90000001',  'MP-DEMO-1'),
  ('a0000001-0000-4000-8000-000000000005'::uuid, 'vet.demo2@haras.com',               'Vet',      'Demo 2',        'veterinario', '90000002',  'MP-DEMO-2'),
  ('a0000001-0000-4000-8000-000000000006'::uuid, 'vet.independiente.demo@haras.com',  'Vet',      'Independiente', 'veterinario', '90000003',  'MP-DEMO-3'),
  ('a0000001-0000-4000-8000-000000000007'::uuid, 'jugador.demo1@haras.com',           'Jugador',  'Demo 1',        NULL,          NULL,        NULL),
  ('a0000001-0000-4000-8000-000000000008'::uuid, 'jugador.demo2@haras.com',           'Jugador',  'Demo 2',        NULL,          NULL,        NULL),
  ('a0000001-0000-4000-8000-000000000009'::uuid, 'peticero.demo1@haras.com',          'Peticero', 'Demo 1',        NULL,          NULL,        NULL),
  ('a0000001-0000-4000-8000-000000000010'::uuid, 'peticero.demo2@haras.com',          'Peticero', 'Demo 2',        NULL,          NULL,        NULL),
  ('a0000001-0000-4000-8000-000000000011'::uuid, 'piloto.demo1@haras.com',            'Piloto',   'Demo 1',        NULL,          NULL,        NULL),
  ('a0000001-0000-4000-8000-000000000012'::uuid, 'piloto.demo2@haras.com',            'Piloto',   'Demo 2',        NULL,          NULL,        NULL)
) AS u(id, email, nombre, apellido, rol_solicitado, dni, matricula);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
FROM auth.users;

-- El trigger deja a todos como 'admin' salvo los veterinarios. En prod el rol
-- global de jugador/peticero/piloto es NULL (su rol vive en la membresía).
UPDATE public.usuario SET rol = 'superadmin' WHERE email = 'superadmin.demo@haras.com';
UPDATE public.usuario SET rol = NULL
WHERE email ~ '^(jugador|peticero|piloto)\.demo[12]@haras\.com$';

-- ---------------------------------------------------------------------------
-- Sociedades
-- ---------------------------------------------------------------------------
INSERT INTO public.sociedad (id, nombre, cuit, direccion) VALUES
  ('b0000001-0000-4000-8000-000000000001', 'Haras Demo 1', '30-00000001-0', 'Ruta 6 km 100, Buenos Aires'),
  ('b0000001-0000-4000-8000-000000000002', 'Haras Demo 2', '30-00000002-0', 'Ruta 8 km 200, Córdoba');

-- ---------------------------------------------------------------------------
-- Membresías (cat_rol: 1 admin, 2 veterinario, 3 piloto, 4 jugador, 5 peticero)
-- ---------------------------------------------------------------------------
INSERT INTO public.membresia (id, usuario_id, sociedad_id, rol_id) VALUES
  ('f0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 1),
  ('f0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000002', 1),
  ('f0000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001', 2),
  ('f0000001-0000-4000-8000-000000000004', 'a0000001-0000-4000-8000-000000000005', 'b0000001-0000-4000-8000-000000000002', 2),
  ('f0000001-0000-4000-8000-000000000005', 'a0000001-0000-4000-8000-000000000007', 'b0000001-0000-4000-8000-000000000001', 4),
  ('f0000001-0000-4000-8000-000000000006', 'a0000001-0000-4000-8000-000000000008', 'b0000001-0000-4000-8000-000000000002', 4),
  ('f0000001-0000-4000-8000-000000000007', 'a0000001-0000-4000-8000-000000000009', 'b0000001-0000-4000-8000-000000000001', 5),
  ('f0000001-0000-4000-8000-000000000008', 'a0000001-0000-4000-8000-000000000010', 'b0000001-0000-4000-8000-000000000002', 5),
  ('f0000001-0000-4000-8000-000000000009', 'a0000001-0000-4000-8000-000000000011', 'b0000001-0000-4000-8000-000000000001', 3),
  ('f0000001-0000-4000-8000-000000000010', 'a0000001-0000-4000-8000-000000000012', 'b0000001-0000-4000-8000-000000000002', 3);

-- ---------------------------------------------------------------------------
-- Módulos (cat_modulo: 1 centro_cria, 2 polo): habilitados para ambos haras,
-- todas las membresías y los tres veterinarios (centro de cría).
-- ---------------------------------------------------------------------------
INSERT INTO public.sociedad_modulo (sociedad_id, modulo_id, habilitado)
SELECT s.id, m.id, true FROM public.sociedad s CROSS JOIN public.cat_modulo m;

INSERT INTO public.membresia_modulo (membresia_id, modulo_id, habilitado)
SELECT ms.id, m.id, true FROM public.membresia ms CROSS JOIN public.cat_modulo m;

INSERT INTO public.usuario_modulo (usuario_id, modulo_id, habilitado)
SELECT u.id, 1, true FROM public.usuario u WHERE u.rol = 'veterinario';

-- ---------------------------------------------------------------------------
-- Suscripciones de veterinarios (el trigger ya creó las tres como 'inactiva')
--   vet.demo1            activa (activada a mano por el superadmin)
--   vet.demo2            cancelada
--   vet.independiente    inactiva: plan gratuito
-- ---------------------------------------------------------------------------
UPDATE public.suscripcion_veterinario SET
  estado = 'activa', plan_id = '50000001-0000-4000-8000-000000000001',
  activado_por = 'a0000001-0000-4000-8000-000000000001',
  fecha_activacion = now() - interval '10 days', fecha_vencimiento = now() + interval '20 days',
  proveedor_pago = 'manual', notas = 'Seed local'
WHERE usuario_id = 'a0000001-0000-4000-8000-000000000004';

UPDATE public.suscripcion_veterinario SET
  estado = 'cancelada', plan_id = '50000001-0000-4000-8000-000000000001',
  activado_por = 'a0000001-0000-4000-8000-000000000001',
  fecha_activacion = now() - interval '40 days', fecha_vencimiento = now() - interval '10 days',
  fecha_cancelacion = now() - interval '12 days',
  proveedor_pago = 'manual', notas = 'Seed local'
WHERE usuario_id = 'a0000001-0000-4000-8000-000000000005';

-- ---------------------------------------------------------------------------
-- Todos aceptaron la versión vigente de los términos (si no, el front los frena)
-- ---------------------------------------------------------------------------
INSERT INTO public.terminos_aceptacion (usuario_id, version_id)
SELECT id, '51000001-0000-4000-8000-000000000002' FROM auth.users;
