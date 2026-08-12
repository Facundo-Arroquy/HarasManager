# Roles y freemium para veterinarios — brief de implementación

> Preparado a partir de la inspección directa del schema de Supabase del proyecto **Haras Manager** (`cbllmyboxyoumnhakvyj`). No se asume nada del `CLAUDE.md`/`docs/SKILL.md` del repo sin confirmarlo contra la base real, porque ese doc está desactualizado (habla de `marca`, que ya no existe — fue reemplazada por `propietario`/`propiedad`).

## 1. Decisiones ya tomadas

- **Bloqueo al límite:** duro. Al intentar guardar el 6to caballo propio sin sociedad, el guardado falla con un mensaje claro. No hay soft-lock ni período de gracia.
- **Alcance de pagos ahora:** Fase 1 = gate + activación manual (admin/superadmin marca "pago recibido"). No se integra pasarela todavía.
- **Pasarela para Fase 2:** MercadoPago (preapproval / suscripciones recurrentes). El modelo de datos se deja preparado para no tener que migrar de nuevo cuando se integre.
- **Qué desbloquea el pago:** suscripción plana → caballos propios ilimitados. No es pago por caballo adicional.

## 2. Hallazgo clave: el modelo de datos ya lo anticipa

En `caballo` ya existen, sin usar (0 filas con estos valores hoy):

| Columna | Nullable | FK |
|---|---|---|
| `sociedad_id` | sí | → `sociedad.id` |
| `vet_owner_id` | sí | → `usuario.id` |

Es decir: **un caballo ya puede existir sin `sociedad_id` (sin pertenecer a ningún haras) y con `vet_owner_id` apuntando a un usuario con rol veterinario.** Esa es exactamente la relación "caballo propio de un vet, sin relación con ningún haras" que pediste. No hace falta tocar la tabla `caballo` — solo construir la lógica de negocio y el registro alrededor de esas dos columnas.

Además ya existe un sistema de módulos (migraciones del 10/8: `cat_modulo`, `usuario_modulo`, `sociedad_modulo`, `membresia_modulo`) para habilitar/deshabilitar funcionalidades por usuario, membresía o sociedad. Hoy solo tiene `centro_cria` y `polo` cargados. Es un mecanismo genérico de feature-flags, no de facturación — por eso para la suscripción de vets conviene una tabla dedicada (ver §4) en vez de forzarla ahí, pero queda documentado como alternativa.

## 3. Modelo de roles: dos capas que ya conviven, no se tocan

El repo ya tiene dos niveles de rol independientes. El feature nuevo usa el primero, no inventa un tercero:

1. **`usuario.rol`** (global, a nivel cuenta): `admin` | `veterinario` | `superadmin` | `null`. No depende de pertenecer a ningún haras.
2. **`membresia.rol_id` → `cat_rol`** (por sociedad): `admin`, `veterinario`, `piloto`, `jugador`, `peticero`. Solo existe si el usuario pertenece a una sociedad (haras).

Un mismo veterinario puede tener **ambas cosas a la vez y no son excluyentes**:
- Puede tener acceso clínico otorgado a caballos de uno o varios haras (tabla `acceso_vet`, sin cambios) — esto ya existe y sigue igual.
- Puede además ser dueño directo de hasta 5 caballos propios sin sociedad (`vet_owner_id` + `sociedad_id IS NULL`) — esto es lo nuevo.

No se crea un rol "veterinario independiente" separado en `cat_rol` ni en `usuario.rol`. Sigue siendo `usuario.rol = 'veterinario'`; lo que cambia es que ahora ese usuario puede existir **sin ninguna fila en `membresia`**, cosa que hoy probablemente no pasa en la práctica.

## 4. Modelo de datos nuevo

### Tabla `suscripcion_veterinario`

```sql
create table suscripcion_veterinario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario(id),
  estado text not null default 'inactiva' check (estado in ('activa', 'inactiva', 'cancelada')),
  activado_por uuid references usuario(id),       -- admin/superadmin que la activó manualmente (Fase 1)
  fecha_activacion timestamptz,
  fecha_vencimiento timestamptz,                    -- null = sin vencimiento (Fase 1, activación manual indefinida)
  proveedor_pago text,                              -- null en Fase 1; 'mercadopago' en Fase 2
  external_subscription_id text,                    -- id de preapproval de MercadoPago, Fase 2
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index suscripcion_veterinario_usuario_id_key on suscripcion_veterinario(usuario_id);
```

Por qué tabla propia y no reusar `usuario_modulo`: la suscripción necesita trazabilidad de pago (quién la activó, cuándo vence, proveedor, id externo) que no entra bien en un simple booleano `habilitado`. Además separa claramente "feature flag" (módulos) de "estado de facturación" (suscripción).

### Función de límite (sigue la convención existente: `tiene_membresia`, `es_admin`, `vet_tiene_acceso`)

```sql
create or replace function vet_puede_agregar_caballo(p_usuario_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from caballo
       where vet_owner_id = p_usuario_id
         and sociedad_id is null
         and activo = true) < 5
    or exists (
      select 1 from suscripcion_veterinario
       where usuario_id = p_usuario_id
         and estado = 'activa'
         and (fecha_vencimiento is null or fecha_vencimiento > now())
    );
$$;
```

### RLS: bloqueo duro real (no solo en frontend)

Agregar `WITH CHECK (vet_puede_agregar_caballo(auth.uid()) or sociedad_id is not null)` a la policy de `INSERT` sobre `caballo` cuando `vet_owner_id = auth.uid()`. Esto respeta la regla del proyecto de "no saltear RLS bajo ninguna circunstancia" — el frontend puede (y debe) mostrar el paywall antes, pero la base es la que realmente corta.

## 5. Flujo: autoregistro de veterinario

Hoy la única vía de alta de usuarios es la Edge Function `create-user`, invocada por un admin (regla explícita: "no crear usuarios desde el frontend"). Para vets, se necesita una excepción controlada:

1. Página pública nueva `/registro-veterinario` (como `/landing`, lazy load).
2. Supabase Auth signup normal (email + password) desde el frontend.
3. Nueva Edge Function `self-register-vet` (service role, sin `verify_jwt` estricto de admin — se dispara post-signup o la llama el frontend ya autenticado con el JWT del usuario recién creado) que:
   - Inserta en `usuario`: `rol = 'veterinario'`.
   - **No** crea `membresia` (el vet no pertenece a ningún haras).
   - Inserta en `suscripcion_veterinario` con `estado = 'inactiva'`.
4. Aceptación de T&C: reusar `terminos_condiciones` / `terminos_aceptacion`, igual que en el flujo actual.
5. Redirect a `/caballos` o a un dashboard simplificado de vet independiente (sin las secciones de admin/config de haras, que no aplican).

## 6. Flujo: activación manual del pago (Fase 1)

Vista nueva en `/superadmin` (o `/admin` si aplica a nivel más bajo — a definir con Claude Code según cómo esté armado el panel hoy): **"Veterinarios independientes"**.

- Lista de `usuario` con `rol = 'veterinario'` y sin `membresia` activa.
- Por cada uno: cantidad de caballos propios (`count(*) where vet_owner_id = usuario.id and sociedad_id is null`), estado de `suscripcion_veterinario`.
- Botón "Activar suscripción" → upsert en `suscripcion_veterinario` (`estado='activa'`, `activado_por=auth.uid()`, `fecha_activacion=now()`, `proveedor_pago=null`, `fecha_vencimiento=null`).
- Botón "Desactivar" → `estado='cancelada'`.
- RLS: solo superadmin (a confirmar si también admin de haras debería poder — probablemente no, ya que estos vets no pertenecen a ningún haras).

## 7. Alta de haras: sigue manual, sin cambios de fondo

Confirmado: "por ahora" los haras los seguimos dando de alta nosotros. No hace falta construir autoregistro de sociedad. Lo único que conviene ajustar:

- La tabla `lead` ya captura `nombre_establecimiento`, `cantidad_animales`, `modulos_interes`, `estado` desde el landing — es el intake natural para pedidos de alta de haras. No hace falta una tabla nueva.
- Sugerencia menor: agregar un valor de `estado` tipo `'convertido'` en `lead` para marcar cuando ya se creó la `sociedad` correspondiente, si no existe ya ese tracking.
- El alta en sí sigue el camino actual: superadmin crea `sociedad` + primer `usuario` admin vía `create-user`.

## 8. Fuera de alcance ahora (Fase 2, no implementar todavía)

- Webhook de MercadoPago (`mercadopago-webhook` Edge Function) que actualice `suscripcion_veterinario.estado` automáticamente al confirmarse/cancelarse un pago.
- Checkout / botón de pago real en el frontend.
- Recordatorios de vencimiento / dunning.
- Cualquier modelo de pago para haras (hoy el alta de haras ni siquiera es self-service, así que no hay freemium de haras todavía — si en el futuro lo hay, probablemente sea otro modelo, no por caballo).

## 9. Checklist para Claude Code (formato ticket, para sumar a `TASKS.md`)

- [ ] Migración: crear tabla `suscripcion_veterinario` + índice único por `usuario_id`.
- [ ] Migración: función `vet_puede_agregar_caballo(uuid)`.
- [ ] Migración: policy RLS de `INSERT` en `caballo` que use la función anterior cuando `vet_owner_id = auth.uid()`.
- [ ] Edge Function `self-register-vet` (crea `usuario` rol veterinario + fila `suscripcion_veterinario` inactiva, sin `membresia`).
- [ ] Página `/registro-veterinario` (signup + aceptación de T&C).
- [ ] Ajustar `caballoService.ts` / formulario de alta de caballo: manejar el error de límite alcanzado y mostrar paywall en vez de un error genérico.
- [ ] Dashboard reducido para vet independiente (ocultar secciones que no aplican: admin, config de haras, transferencias entre empresas).
- [ ] Vista superadmin "Veterinarios independientes" con activar/desactivar suscripción.
- [ ] `authStore`: contemplar el caso de usuario con `rol='veterinario'` y sin `sociedad_id` activa (hoy probablemente asume que siempre hay una sociedad).

## 10. Riesgos / cosas a validar con el otro dev antes de arrancar

- Confirmar que `authStore` y el routing (`/` → redirect según rol) no rompen cuando `sociedadActiva` es `null` para un usuario válido. Hoy el flujo parece asumir que todo usuario logueado tiene una sociedad activa.
- Confirmar que ningún componente de `caballo` asume `sociedad_id` no nulo (búsquedas, RLS de lectura, exportación de ficha, etc.) — dado que hasta ahora esa combinación (`sociedad_id null`) nunca se usó en producción (0 filas), es probable que haya lugares del frontend que no la contemplen aunque el schema la permita.
- Definir si un vet independiente puede eventualmente "convertir" su cuenta en admin de un haras nuevo, o si son cuentas completamente separadas de por vida. No es necesario resolverlo ahora, pero conviene no cerrar puertas en el diseño de `usuario`/`membresia` (y no se cierran con este diseño).
