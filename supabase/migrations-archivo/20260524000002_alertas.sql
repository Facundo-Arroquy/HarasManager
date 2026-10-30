-- Tabla de alertas
-- sociedad_id es nullable: los veterinarios crean alertas personales (sin sociedad)
create table if not exists alerta (
  id           uuid        primary key default gen_random_uuid(),
  sociedad_id  uuid        references sociedad(id) on delete cascade,   -- null para vets
  motivo       text        not null,
  fecha_alerta date        not null,
  activo       boolean     not null default true,
  creado_por   uuid        not null references auth.users(id) on delete cascade,
  creado_en    timestamptz not null default now()
);

-- Relación alerta ↔ caballo
create table if not exists alerta_caballo (
  alerta_id  uuid not null references alerta(id)  on delete cascade,
  caballo_id uuid not null references caballo(id) on delete cascade,
  primary key (alerta_id, caballo_id)
);

-- Índices
create index if not exists alerta_sociedad_idx    on alerta (sociedad_id);
create index if not exists alerta_creado_por_idx  on alerta (creado_por);
create index if not exists alerta_fecha_idx       on alerta (fecha_alerta);
create index if not exists alerta_caballo_cab_idx on alerta_caballo (caballo_id);

-- ── RLS alerta ────────────────────────────────────────────────────────────────
alter table alerta enable row level security;

-- Miembros de una sociedad ven las alertas de su sociedad
create policy "Miembro lee alertas de su sociedad"
  on alerta for select to authenticated
  using (
    sociedad_id is not null and
    sociedad_id in (
      select sociedad_id from membresia where usuario_id = auth.uid() and activa = true
    )
  );

-- Veterinarios ven sus propias alertas (sin sociedad)
create policy "Vet lee sus propias alertas"
  on alerta for select to authenticated
  using (
    sociedad_id is null and creado_por = auth.uid()
  );

-- Miembros insertan alertas en su sociedad
create policy "Miembro inserta alertas en su sociedad"
  on alerta for insert to authenticated
  with check (
    sociedad_id is not null and
    sociedad_id in (
      select sociedad_id from membresia where usuario_id = auth.uid() and activa = true
    )
  );

-- Veterinarios insertan alertas personales
create policy "Vet inserta sus propias alertas"
  on alerta for insert to authenticated
  with check (
    sociedad_id is null and creado_por = auth.uid()
  );

-- Actualizar (miembros)
create policy "Miembro actualiza alertas de su sociedad"
  on alerta for update to authenticated
  using (
    sociedad_id is not null and
    sociedad_id in (
      select sociedad_id from membresia where usuario_id = auth.uid() and activa = true
    )
  );

-- Actualizar (vets)
create policy "Vet actualiza sus propias alertas"
  on alerta for update to authenticated
  using (sociedad_id is null and creado_por = auth.uid());

-- Eliminar (miembros)
create policy "Miembro elimina alertas de su sociedad"
  on alerta for delete to authenticated
  using (
    sociedad_id is not null and
    sociedad_id in (
      select sociedad_id from membresia where usuario_id = auth.uid() and activa = true
    )
  );

-- Eliminar (vets)
create policy "Vet elimina sus propias alertas"
  on alerta for delete to authenticated
  using (sociedad_id is null and creado_por = auth.uid());

-- ── RLS alerta_caballo ────────────────────────────────────────────────────────
alter table alerta_caballo enable row level security;

create policy "Lee alerta_caballo si puede ver la alerta"
  on alerta_caballo for select to authenticated
  using (
    alerta_id in (select id from alerta where
      (sociedad_id in (select sociedad_id from membresia where usuario_id = auth.uid() and activa = true))
      or (sociedad_id is null and creado_por = auth.uid())
    )
  );

create policy "Inserta alerta_caballo si puede ver la alerta"
  on alerta_caballo for insert to authenticated
  with check (
    alerta_id in (select id from alerta where
      (sociedad_id in (select sociedad_id from membresia where usuario_id = auth.uid() and activa = true))
      or (sociedad_id is null and creado_por = auth.uid())
    )
  );

create policy "Elimina alerta_caballo si puede ver la alerta"
  on alerta_caballo for delete to authenticated
  using (
    alerta_id in (select id from alerta where
      (sociedad_id in (select sociedad_id from membresia where usuario_id = auth.uid() and activa = true))
      or (sociedad_id is null and creado_por = auth.uid())
    )
  );
