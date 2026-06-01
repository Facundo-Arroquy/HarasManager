-- Tabla de versiones de términos y condiciones
create table if not exists terminos_condiciones (
  id          uuid primary key default gen_random_uuid(),
  version     integer not null unique,
  titulo      text    not null default 'Términos y Condiciones',
  contenido   text    not null,
  activo      boolean not null default false,
  creado_en   timestamptz not null default now()
);

-- Solo la versión activa más reciente
create unique index if not exists terminos_condiciones_activo_unico
  on terminos_condiciones (activo)
  where activo = true;

-- Tabla de aceptaciones por usuario
create table if not exists terminos_aceptacion (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users(id) on delete cascade,
  version_id      uuid not null references terminos_condiciones(id) on delete cascade,
  aceptado_en     timestamptz not null default now(),
  unique (usuario_id, version_id)
);

-- RLS para terminos_condiciones: todos los autenticados pueden leer
alter table terminos_condiciones enable row level security;

create policy "Todos leen términos vigentes"
  on terminos_condiciones for select
  to authenticated
  using (activo = true);

-- RLS para terminos_aceptacion
alter table terminos_aceptacion enable row level security;

create policy "Usuario lee sus propias aceptaciones"
  on terminos_aceptacion for select
  to authenticated
  using (usuario_id = auth.uid());

create policy "Usuario inserta su propia aceptación"
  on terminos_aceptacion for insert
  to authenticated
  with check (usuario_id = auth.uid());

-- Insertar versión inicial (v1)
insert into terminos_condiciones (version, titulo, contenido, activo)
values (
  1,
  'Términos y Condiciones de Uso',
  E'# Términos y Condiciones de Uso\n**HarasManager** — Versión 1 — Mayo 2026\n\n---\n\n## 1. Aceptación\n\nAl acceder y utilizar HarasManager, aceptás los presentes Términos y Condiciones. Si no estás de acuerdo, no uses la plataforma.\n\n## 2. Descripción del servicio\n\nHarasManager es una plataforma de gestión para establecimientos equinos. Permite administrar caballos, historiales clínicos, transferencias y actividades relacionadas.\n\n## 3. Uso permitido\n\n- Usar la plataforma únicamente para los fines para los que fue diseñada.\n- No compartir credenciales de acceso con terceros.\n- No intentar acceder a datos de otras organizaciones.\n- No utilizar la plataforma para actividades ilegales o fraudulentas.\n\n## 4. Responsabilidad de los datos\n\nEres responsable de la exactitud e integridad de los datos que ingresás. HarasManager no se hace responsable por errores derivados de información incorrecta cargada por el usuario.\n\n## 5. Confidencialidad\n\nToda la información ingresada en la plataforma es confidencial. Nos comprometemos a no divulgarla a terceros salvo requerimiento legal.\n\n## 6. Propiedad intelectual\n\nTodos los derechos sobre el software, diseño y contenido de HarasManager pertenecen a sus desarrolladores. Queda prohibida la reproducción o distribución sin autorización expresa.\n\n## 7. Modificaciones\n\nNos reservamos el derecho de actualizar estos Términos. Ante cualquier cambio, se te solicitará nueva aceptación al ingresar a la plataforma.\n\n## 8. Rescisión\n\nPodemos suspender o cancelar el acceso ante incumplimiento de estos Términos.\n\n## 9. Contacto\n\nPara consultas sobre estos Términos, contactá al administrador de tu organización o al equipo de soporte de HarasManager.',
  true
);
