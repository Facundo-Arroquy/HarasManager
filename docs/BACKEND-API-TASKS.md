# Backend API — plan de implementación por bloques

Plan para agregar un backend FastAPI a HarasManager, escrito para poder
arrancarlo el día que se decida sin tener que re-investigar nada.

**Estado: no iniciado.** Hoy el frontend habla directo con Supabase y no hay
backend. Este documento no implica que la decisión esté tomada — ver Bloque 0.

Cada bloque es independiente y tiene su criterio de terminado. Se pueden hacer
de a uno, con el sistema funcionando en producción todo el tiempo.

> **Convivencia, no reemplazo.** En ningún momento hay un "big bang". El
> frontend puede hablar con Supabase y con la API a la vez, endpoint por
> endpoint. Si un bloque sale mal, se revierte solo ese.

---

## Punto de partida (medido el 24/07/2026)

| | |
|---|---|
| Tablas en `public` | 30 |
| Policies RLS | 100 |
| Funciones Postgres | 24 |
| Triggers | 20 |
| Buckets de Storage | 2 |
| Services en el front | 15 archivos, ~3.100 líneas |
| RPCs llamadas desde el front | 10 |

Las 10 RPCs que hoy consume el frontend:

```
crear_caballo_veterinario          actualizar_caballo_veterinario
toggle_prenada_veterinario         transferir_caballos_vet
registrar_transferencia_embrionaria
get_caballos_veterinario           get_veterinarios_plataforma
get_alertas_vet                    get_consultas_recientes_vet
get_sociedades_activas
```

Auth actual: Supabase Auth (`signInWithPassword`, `resetPasswordForEmail`,
`updateUser`, `onAuthStateChange`) en `frontend/src/hooks/useAuth.ts`.

---

## Bloque 0 — Decidir si corresponde

**No es una tarea de código.** Es el filtro que evita construir esto por gusto.

Hoy la arquitectura sin backend funciona y el multi-tenant por `sociedad_id`
con RLS es exactamente el caso donde RLS es más fuerte que cualquier check en
código: ningún cliente puede saltearlo, ni siquiera uno futuro.

**Disparadores reales para arrancar** (con que se cumpla uno, ya vale):

- [ ] Necesitás secretos que no pueden vivir en el navegador: pagos, AFIP,
      mails transaccionales, APIs de terceros con API key.
- [ ] Hay que generar PDFs o reportes pesados server-side.
- [ ] Hacen falta jobs programados (recalcular estados vencidos, avisos de parto).
- [ ] La lógica de negocio en plpgsql se volvió el cuello de botella. Señal
      concreta: más de ~10 funciones de negocio no triviales y debuggear plpgsql
      seguido. Al 24/07/2026 hay 2 (`registrar_transferencia_embrionaria` y
      `actualizar_caballo_veterinario`), así que este disparador **todavía no
      se cumple**.
- [ ] Un cliente que no es el navegador: app móvil nativa, integración de un
      tercero, scripts de importación masiva.

**Qué NO es un disparador:** "un backend es más prolijo", "así se hace
normalmente", o un bug puntual de RLS. Los tres bugs de julio 2026 se
resolvieron con una policy y una RPC, sin tocar la arquitectura.

**Decisión que hay que tomar antes del Bloque 1** — es la más importante de
todo el documento:

| Modo | Cómo funciona | Consecuencia |
|---|---|---|
| **A — JWT del usuario** (recomendado para empezar) | El backend recibe el token del usuario y lo reenvía a Postgres. RLS **sigue aplicando** | Doble red de seguridad. Si te olvidás un check en Python, RLS te cubre. Más lento de optimizar (no podés hacer queries administrativas fáciles) |
| **B — `service_role`** | El backend usa la key de servicio y bypassa RLS por completo | Toda la seguridad pasa a depender de tu código. Un endpoint sin filtro de `sociedad_id` = fuga entre haras. Más simple y rápido, mucho menos perdonador |

**Recomendación: arrancar en modo A** y pasar a B solo por endpoint, cuando
haya una razón medible. Las 100 policies ya escritas son un activo, no un
lastre.

---

## Bloque 1 — Esqueleto del proyecto

**Depende de:** Bloque 0.

### Tareas

- [ ] Crear `backend/` en la raíz del repo (monorepo, al lado de `frontend/`).
- [ ] Python 3.12+, gestor de dependencias `uv` (o Poetry).
- [ ] Dependencias base: `fastapi`, `uvicorn[standard]`, `sqlalchemy`,
      `psycopg[binary]`, `pydantic-settings`, `pyjwt[crypto]`, `httpx`.
- [ ] Estructura:

```
backend/
├── pyproject.toml
├── .env.example
├── Dockerfile
├── app/
│   ├── main.py            # instancia FastAPI, CORS, routers
│   ├── config.py          # Settings con pydantic-settings
│   ├── db.py              # engine + session
│   ├── auth.py            # validación del JWT (Bloque 3)
│   ├── deps.py            # dependencies de autorización (Bloque 4)
│   ├── models/            # SQLAlchemy
│   ├── schemas/           # Pydantic (request/response)
│   └── routers/           # un archivo por dominio
└── tests/
```

- [ ] `config.py` con: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`,
      `SUPABASE_ANON_KEY`, `CORS_ORIGINS`. Nada hardcodeado.
- [ ] `GET /health` que devuelva `{"status": "ok"}` y verifique la conexión a
      la DB con un `SELECT 1`.
- [ ] CORS habilitado solo para el dominio de Vercel y `localhost:5173`.
- [ ] Agregar `backend/.env` al `.gitignore`.

### Terminado cuando

`uvicorn app.main:app --reload` levanta y `curl localhost:8000/health` responde
`ok` con la DB conectada.

---

## Bloque 2 — Modelos sobre el schema existente

**Depende de:** Bloque 1.

⚠️ **El schema ya existe y tiene datos de producción.** No se genera desde los
modelos. Los modelos se escriben *para calzar* con lo que ya hay.

### Tareas

- [ ] Generar los modelos iniciales con `sqlacodegen` contra la DB de prod y
      después limpiarlos a mano. No escribirlos de cero.
- [ ] Verificar tabla por tabla contra `docs/SKILL.md`.
- [ ] Respetar las convenciones del proyecto: `snake_case` singular, catálogos
      con prefijo `cat_`, PKs UUID, `TIMESTAMPTZ`.
- [ ] Alembic configurado pero con una **migración inicial vacía marcada como
      aplicada** (`alembic stamp head`), para que el historial arranque desde el
      estado actual sin intentar recrear nada.
- [ ] Decidir y documentar: ¿las migraciones futuras siguen yendo por el MCP de
      Supabase (como hoy) o pasan a Alembic? **No pueden convivir las dos.**
      Si pasa a Alembic, actualizar `CLAUDE.md`.

### Terminado cuando

Un script lee las 30 tablas vía SQLAlchemy y los conteos coinciden con los que
devuelve el MCP.

### Trampa conocida

`supabase/migrations/` ya tiene drift respecto a producción — hay migraciones
en el repo que nunca se aplicaron y cambios en prod hechos desde el SQL Editor.
**La fuente de verdad es el schema vivo, no los archivos.** Antes de este bloque,
conciliar ambos o al menos dejar documentado qué difiere.

---

## Bloque 3 — Autenticación

**Depende de:** Bloque 2.

⚠️ **No reimplementar login, signup ni reset de password.** Supabase Auth sigue
siendo el proveedor de identidad. El frontend sigue autenticándose contra
Supabase igual que hoy. El backend solo **valida** el JWT que ya existe.

### Tareas

- [ ] `app/auth.py`: dependency que extrae el `Authorization: Bearer <jwt>`,
      lo valida y devuelve el usuario.
- [ ] Validar la firma contra el JWT secret del proyecto (o vía JWKS si se
      migra a claves asimétricas). Verificar `exp`, `aud` e `iss`.
- [ ] El `sub` del token es el `usuario.id` — es el mismo valor que
      `auth.uid()` usa en las policies.
- [ ] Cargar el usuario de la tabla `usuario` y cachear por request.
- [ ] Devolver `401` si el token falta o es inválido, `403` si el usuario está
      inactivo.
- [ ] **Modo A:** propagar el JWT a la sesión de Postgres para que RLS aplique:

```python
# Antes de cada query, en el mismo transaction scope
db.execute(text("SET LOCAL role authenticated"))
db.execute(
    text("SELECT set_config('request.jwt.claims', :claims, true)"),
    {"claims": json.dumps(claims)},
)
```

- [ ] Test: un token vencido, uno de otro proyecto y uno sin firma dan 401.

### Terminado cuando

`GET /me` devuelve los datos del usuario logueado usando el mismo token que ya
tiene el frontend, sin login nuevo.

---

## Bloque 4 — Autorización

**Depende de:** Bloque 3. **Es el bloque más delicado de todos.**

Hay 100 policies que codifican las reglas de acceso. Este bloque las expresa
como dependencies de FastAPI. En modo A son una segunda capa; en modo B son la
única.

### Tareas

- [ ] Portar los helpers de Postgres a dependencies. Los que están en
      `docs/SKILL.md`:

| Postgres | Dependency |
|---|---|
| `tiene_membresia(sociedad_id)` | `require_membresia(sociedad_id)` |
| `es_admin(sociedad_id)` | `require_admin(sociedad_id)` |
| `is_superadmin()` | `require_superadmin()` |
| `vet_tiene_acceso(caballo_id)` | `require_acceso_caballo(caballo_id)` |
| `puede_gestionar_campo(sociedad_id)` | `require_gestion_campo(sociedad_id)` |

- [ ] **Regla no negociable:** ningún endpoint que devuelva datos de negocio
      puede omitir el filtro por `sociedad_id`. Escribir un test que recorra
      todos los routers y falle si alguno no lo aplica.
- [ ] Caso especial del veterinario sin membresía: trabaja por `acceso_vet`, no
      por `membresia`. Es el caso que rompió `embrion_select` en julio 2026 —
      la policy se había olvidado del vet. **Todo endpoint del módulo de cría
      tiene que contemplar los dos caminos.**
- [ ] El historial clínico es inmutable: solo el vet que lo creó puede
      editarlo. Replicar esa regla.
- [ ] Documentar en `docs/SKILL.md` el mapa policy → endpoint.

### Terminado cuando

Existe una matriz de tests que, por cada rol (superadmin, admin, veterinario
con membresía, veterinario sin membresía, usuario de otra sociedad), verifica
qué endpoints puede tocar y cuáles le dan 403.

---

## Bloque 5 — Primer endpoint vertical: transferencia embrionaria

**Depende de:** Bloque 4.

Se migra **un solo flujo**, de punta a punta, para validar la arquitectura
antes de escribir 30 endpoints. Es el candidato ideal porque ya es
transaccional, ya tiene los permisos resueltos y su lógica está documentada.

### Tareas

- [ ] `POST /api/transferencias` que replique
      `registrar_transferencia_embrionaria()`:
  - valida acceso a la receptora y a la donante
  - toma `SELECT ... FOR UPDATE` sobre el embrión (la carrera es real: sin el
    lock, dos vets transfieren el mismo embrión)
  - verifica que el embrión exista, sea de esa donante y siga disponible
  - crea registro clínico + transferencia + descuenta el embrión, en una
    transacción
- [ ] Schemas Pydantic de entrada y salida.
- [ ] Portar los tests de la RPC (ya están definidos, ver el commit `2c44f55`):
      embrión ya transferido → error; embrión de otra donante → error;
      receptora sin `acceso_vet` → error; caso feliz → 3 ids.
- [ ] En el frontend, feature flag para elegir RPC o API:

```ts
// crianzaService.ts
const USA_API = import.meta.env.VITE_API_URL != null
return USA_API ? apiClient.post('/transferencias', payload)
               : supabase.rpc('registrar_transferencia_embrionaria', {...})
```

- [ ] Probar los dos caminos contra la misma base y comparar el resultado.

### Terminado cuando

El flujo completo anda por la API con el flag prendido, y con el flag apagado
sigue andando por la RPC. **La RPC no se borra** hasta el Bloque 11.

### Por qué este primero

Si algo de la arquitectura está mal pensado (auth, transacciones, permisos,
CORS, latencia), aparece acá, con un solo endpoint escrito y no con treinta.

---

## Bloque 6 — Migrar el resto de los dominios

**Depende de:** Bloque 5 estable en producción por al menos una semana.

Un sub-bloque por dominio, en este orden (de menor a mayor riesgo):

- [ ] **6.1 Catálogos** — `cat_raza`, `cat_pelaje`, `cat_rol`,
      `cat_tipo_consulta`, `cat_parte_cuerpo`. Solo lectura, sin multi-tenant.
      El más fácil, sirve para aceitar el flujo.
- [ ] **6.2 Caballos** — `caballoService.ts` (473 líneas) + las RPCs
      `crear_caballo_veterinario`, `actualizar_caballo_veterinario`,
      `toggle_prenada_veterinario`.
- [ ] **6.3 Campos** — `campoService.ts`.
- [ ] **6.4 Centro de cría** — `crianzaService.ts` (821 líneas, el más grande).
      Flushings, embriones, transferencias, ecografías, recordatorios.
      **Ojo:** la generación automática de recordatorios hoy vive en el front
      (`crianzaStore.ts`, función `reglasParaRegistro`). Es lógica de negocio en
      un componente — al migrar, va al backend.
- [ ] **6.5 Historial clínico** — `historialService.ts`. Recordar la
      inmutabilidad.
- [ ] **6.6 Admin y superadmin** — `adminService.ts`, `superAdminService.ts`.
- [ ] **6.7 Resto** — alertas, leads, términos, fichas históricas, transferencia
      entre empresas, acceso al centro de cría.

Para cada uno: schemas Pydantic, router, tests de permisos por rol, feature flag
en el service del front, y baja de la lógica equivalente cuando esté estable.

### Terminado cuando

Todos los services del front pueden funcionar contra la API con el flag
prendido.

---

## Bloque 7 — Storage

**Depende de:** Bloque 6.4.

Hay 2 buckets. Los usan `fotoService.ts`, `historialService.ts` y
`fichaHistoricaService.ts`.

### Tareas

- [ ] Decidir: ¿el upload sigue yendo directo del navegador a Supabase Storage
      (más simple, menos carga) o pasa por la API (permite validar tamaño, tipo,
      antivirus, y renombrar)?
- [ ] **Recomendado:** el navegador sigue subiendo directo, pero pide a la API
      una **signed URL** de corta duración. Así se valida permiso sin que el
      archivo pase por el backend.
- [ ] Endpoint `POST /api/uploads/signed-url` que valide el acceso al caballo
      antes de firmar.
- [ ] Revisar las policies de los buckets.

### Terminado cuando

Subir una foto de caballo y una ficha histórica funciona vía API, con permisos
verificados.

---

## Bloque 8 — Jobs programados

**Depende de:** Bloque 6.

Esto es capacidad nueva: hoy no existe y es uno de los disparadores del
Bloque 0.

### Tareas

- [ ] Elegir runner: APScheduler embebido (simple), Celery + Redis (si crece), o
      un cron externo pegándole a un endpoint protegido (lo más simple de todo).
- [ ] Job: recalcular estados reproductivos vencidos. Hoy lo hace
      `sincronizarVencidos()` en el store del front — o sea, solo se recalcula
      si alguien abre la app.
- [ ] Job: avisos de parto probable (360 días desde la fecha de preñez).
- [ ] Job: notificar recordatorios vencidos del centro de cría.
- [ ] Endpoint de jobs protegido con un secreto compartido, nunca público.
- [ ] Log de cada corrida, con resultado y duración.

### Terminado cuando

Los estados se recalculan sin que nadie abra la app.

---

## Bloque 9 — Testing

**Transversal.** Empieza en el Bloque 3 y crece con cada bloque.

### Tareas

- [ ] `pytest` + `httpx.AsyncClient` para tests de endpoints.
- [ ] Base de test: proyecto Supabase aparte o Postgres en Docker con el schema
      restaurado. **Nunca contra producción.**
- [ ] Fixtures: una sociedad, un admin, un vet con membresía, un vet sin
      membresía (solo `acceso_vet`), un superadmin, y una segunda sociedad para
      probar aislamiento.
- [ ] **Test de aislamiento multi-tenant**: por cada endpoint que devuelve
      datos, verificar que un usuario de la sociedad A no ve nada de la B. Este
      es el test que justifica todo el bloque.
- [ ] Cobertura mínima acordada antes de mergear (sugerido: 80% en `routers/` y
      `deps.py`).
- [ ] CI en GitHub Actions corriendo los tests en cada PR.

---

## Bloque 10 — Deploy y observabilidad

**Depende de:** Bloque 5 (se puede desplegar con un solo endpoint).

### Tareas

- [ ] Elegir hosting. Vercel no corre FastAPI cómodamente en modo persistente;
      opciones: Fly.io, Railway, Render, o un VPS. **Preferir la región más
      cercana a la DB** (Haras Manager está en `us-west-1`) para no sumar
      latencia entre API y Postgres.
- [ ] Dockerfile multi-stage.
- [ ] Variables de entorno por ambiente. `DATABASE_URL` con pooler
      (Supavisor), no conexión directa.
- [ ] Pool de conexiones dimensionado — Supabase free tiene límite bajo.
- [ ] Logs estructurados en JSON.
- [ ] Sentry o equivalente para errores.
- [ ] Health check para el orquestador.
- [ ] Deploy automático desde `main` y ambiente de preview por PR, en paralelo
      al de Vercel.

### Terminado cuando

La API está en un dominio estable con HTTPS, monitoreada, y el frontend de
producción le puede pegar.

---

## Bloque 11 — Cutover

**Depende de:** todos los anteriores.

### Tareas

- [ ] Prender el flag por dominio en producción, uno por vez, con al menos
      unos días entre cada uno.
- [ ] Monitorear errores y latencia después de cada uno.
- [ ] Cuando un dominio lleva 2 semanas estable: borrar el camino viejo del
      service del front.
- [ ] Recién ahí, evaluar si conviene dar de baja las RPCs equivalentes.
      **Las funciones de Postgres pueden quedarse** — no molestan y sirven de
      fallback.
- [ ] Rotar la `anon key` si el frontend ya no habla con Supabase directo.
- [ ] Actualizar `CLAUDE.md` y `docs/SKILL.md` con la arquitectura nueva.

### Terminado cuando

El frontend no tiene ninguna llamada directa a Supabase salvo auth y, si se
eligió así, storage.

---

## Bloque 12 — Qué NO migrar

Decisiones explícitas para no rediscutirlas cada vez.

- **Supabase Auth se queda.** Reimplementar login, reset de password y manejo de
  sesiones es semanas de trabajo y superficie de seguridad nueva sin ningún
  beneficio.
- **RLS se queda prendido.** Aunque el backend valide todo, dejar las policies
  activas cuesta cero y es la red que evita que un olvido en Python se convierta
  en una fuga entre haras. Solo desactivar una policy si se mide que es un
  problema real de performance.
- **Los triggers se quedan.** Los 20 triggers actuales (`updated_at`, auditoría)
  no ganan nada en Python.
- **Realtime**, si algún día se usa, va directo del navegador a Supabase.
  Puentearlo por el backend es complejidad pura.

---

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Duplicar la lógica de permisos y que se desincronicen | Modo A (RLS sigue aplicando) + matriz de tests del Bloque 9 |
| Un endpoint sin filtro de `sociedad_id` | Test automático que recorre los routers (Bloque 4) |
| El drift de `supabase/migrations/` se agrava con Alembic | Bloque 2: conciliar antes, y una sola herramienta de migraciones |
| Migración a medias que se abandona y deja dos arquitecturas | Feature flags por dominio y bloques chicos; cada bloque deja el sistema entero funcionando |
| Latencia extra por el hop adicional | Desplegar en la región de la DB (Bloque 10) |
| Costo de infra nuevo sobre un MVP | Bloque 0: no arrancar sin un disparador real |

---

## Registro de tasks pendientes de backend

> **Esta sección se completa sola durante el desarrollo normal.** Cada vez que
> se implementa algo en el frontend o en Postgres que el día de mañana tendrá
> que existir en el backend, se anota acá con fecha y contexto. Ver la regla en
> `CLAUDE.md`.

| Fecha | Origen | Qué hay que implementar en el back |
|---|---|---|
| 2026-07-24 | `registrar_transferencia_embrionaria()` (migración `20260724000626`) | Endpoint `POST /api/transferencias`. La RPC ya resuelve atomicidad, lock del embrión y permisos — es la especificación del endpoint. Ver Bloque 5. |
| 2026-07-24 | `crianzaStore.ts` → `reglasParaRegistro()` | La generación automática de recordatorios del centro de cría es lógica de negocio viviendo en el store del front. Al migrar tiene que pasar al backend. Ver Bloque 6.4. |
| 2026-07-24 | `crianzaStore.ts` → `sincronizarVencidos()` | Los estados reproductivos vencidos solo se recalculan cuando alguien abre la app. Tiene que ser un job programado. Ver Bloque 8. |
| 2026-07-28 | `completar_trabajo_sanitario()` (migración `20260728181738`) | Endpoint `POST /api/trabajos-sanitarios/{id}/completar`. La RPC crea una fila de `historial_clinico` por cada caballo no excluido y marca el trabajo como realizado — es la especificación del endpoint (incluye validación de membresía y `FOR UPDATE`). |
| 2026-07-29 | `cancelar_pendientes_por_baja()` — trigger en `caballo` (migración `20260729144522`) | La cancelación en cascada al dar de baja un caballo hoy vive en un trigger de DB. En el backend tiene que ser lógica del servicio de baja (cancelar recordatorios del centro + excluir de trabajos sanitarios pendientes, conservando historial). |
| 2026-07-29 | `proteger_chip_obs()` — trigger en `cat_chip_obs` (migración `20260729161500`) | ~~Validación del chip protegido~~ **Anulado por `20260730120000`**: el trigger se eliminó, los chips ya no se protegen (la lista es del vet y sacarlos es su decisión). No hay nada que implementar. |
| 2026-07-30 | `cat_chip_obs` + `cria_plazo_vet` (migración `20260730120000`) | Endpoints CRUD de configuración del veterinario: `GET/POST/PATCH /api/vet/acciones` y `GET/PUT /api/vet/plazos`. Todo el filtrado es `veterinario_id = auth.uid()`, así que en el backend es el usuario autenticado del request. |
| 2026-07-30 | `crianzaStore.ts` → `plazos` en el store | Los plazos del vet se cargan al store y `reglasParaRegistro()` los recibe por parámetro. Cuando la generación de recordatorios pase al backend (Bloque 6.4), el backend tiene que leer los plazos **del vet que crea el registro**, no de la sociedad ni de un default global. Es requisito explícito de Gero. |
| 2026-08-02 | `es_familiar_directo()` / `ancestros_caballo()` / `get_padrillos_familiares()` + trigger `bloquear_padrillo_familiar` en `cria_registro_clinico` (migración `20260802120100`) | La restricción de inseminar con un familiar directo (2 generaciones) vive en un trigger de DB. En el backend tiene que ser una validación del servicio de registro reproductivo, y el cálculo de parentesco un helper reutilizable (la UI lo consulta para pintar la etiqueta roja antes de guardar). |
| 2026-08-02 | `guardar_ranking_padrillos()` (migración `20260802120200`) | Endpoint `PUT /api/donantes/{id}/ranking-padrillos`. La RPC reemplaza el ranking completo en una transacción (borra + reinserta con prioridad por orden del array) y valida: tope de 10, sin repetidos, permiso de admin de la sociedad o vet con `acceso_vet` sobre la donante **y sobre cada padrillo**. Es la especificación del endpoint. |
| 2026-08-02 | `get_caballos_pedigree_vet()` (migración `20260802120300`) | Endpoint de listado de candidatos a padre/madre para el vet. Existe solo porque `get_caballos_veterinario()` filtra `activo = true` y el pedigree necesita incluir animales dados de baja/muertos. En el backend puede ser un parámetro `incluir_inactivos` del listado de caballos en vez de un endpoint aparte. |
| 2026-08-03 | `guardar_asignaciones_torneo()` (migración `20260803120000`) | Endpoint `PUT /api/torneos/{id}/jugadores/{jugador_id}/caballos` (y la variante con `jugador_id` nulo para devolver a disponibles). La RPC reescribe la columna entera del kanban en una transacción: suelta los caballos de su jugador anterior, borra la columna destino y reinserta con el orden del array. Valida que el torneo esté `activo`, permiso de admin de la sociedad, que el jugador pertenezca al torneo, sin repetidos, y que cada caballo esté activo, sea de la sociedad y tenga el tag "Jugador". Es la especificación del endpoint. |
| 2026-08-06 | `NuevoTrabajoSanitarioModal.tsx` → creación masiva de planes sanitarios | Endpoint `POST /api/planes-sanitarios` que reciba `{ trabajos: [{nombre, fecha, tratamiento}], caballo_ids, observaciones }` y resuelva del lado del server lo que hoy arma el modal: agrupar los caballos por `sociedad_id` (el vet puede mezclar empresas), crear un `trabajo_sanitario` por cada combinación trabajo × empresa con sus `trabajo_sanitario_caballo`, y una fila de `alerta` + `alerta_caballo` por cada plan (con `sociedad_id` NULL si lo crea un vet, que no es miembro de la sociedad — lo exige la RLS de `alerta`). Hoy son N inserts sueltos desde el front, sin transacción: si fallan las alertas los planes ya quedaron creados. |
| 2026-08-06 | `cerrar_plan_sanitario()` (migración `20260806130000`) | Endpoint `POST /api/planes-sanitarios/{plan_id}/cerrar` con el resultado por celda (`caballo_row_id` + estado). La RPC ya resuelve la transacción, el permiso (miembro, superadmin o el vet que creó el trabajo), la escritura de `historial_clinico` solo para los realizados y el cierre del `trabajo_sanitario` cuando no quedan celdas sin marcar — es la especificación del endpoint. La reprogramación de pendientes, en cambio, hoy vive en `DetallePlanSanitario.tsx` (arma un plan nuevo con los caballos pendientes de cada trabajo) y debería ser parte del mismo endpoint o uno hermano, para que el cierre y la reprogramación sean atómicos. |
| 2026-08-10 | `get_mis_accesos_modulo()` / `set_sociedad_modulo()` / `set_membresia_modulo()` / `set_usuario_modulo()` (migración `20260810140000`) | Endpoints `GET /api/mis-accesos-modulo`, `PUT /api/sociedades/{id}/modulos/{codigo}`, `PUT /api/membresias/{id}/modulos/{codigo}`, `PUT /api/usuarios/{id}/modulos/{codigo}`. Las 4 RPC ya resuelven `codigo → modulo_id` y delegan el permiso real en la RLS de la tabla puente (superadmin en `sociedad_modulo`/`usuario_modulo`, admin de la sociedad o superadmin en `membresia_modulo`) — son la especificación de los endpoints. Reemplazan el sistema anterior de 3 columnas booleanas (`sociedad`/`membresia`/`usuario.acceso_centro_cria`), que además tenía un bug real: `sociedad.acceso_centro_cria` había quedado `GENERATED ALWAYS AS (plan <> 'silver')` por una PR sin mergear, y el `UPDATE` a mano del superadmin fallaba en silencio. |
| 2026-08-11 | `crear_caballo_veterinario()` + `vet_puede_agregar_caballo()` (migraciones `20260811150100` / `20260811150200`) | Gate freemium al **crear** un caballo propio de vet. El enforcement real no es una policy RLS: `crear_caballo_veterinario` es `SECURITY DEFINER` con dueño `postgres` (`rolbypassrls = true`), así que su INSERT interno nunca pasa por la RLS de `caballo`. En el backend el límite tiene que ser una validación explícita del servicio de alta, no algo delegado a la base. (Fila que faltaba: el feature original no la registró.) |
| 2026-08-11 | `handle_new_auth_user()` extendido para autoregistro de vet (migración `20260811160000`) | Endpoint `POST /api/vet/registro` (o el equivalente en el flujo de signup del backend). Hoy el trigger que corre en cada INSERT de `auth.users` lee `raw_user_meta_data->>'rol_solicitado'` del payload de `auth.signUp()`: si viene `'veterinario'`, asigna `usuario.rol = 'veterinario'` (en vez del default `'admin'`) e inserta la fila inicial de `suscripcion_veterinario` en estado `'inactiva'`, todo atómico con la creación del usuario de auth. Es **rol autodeclarado por el cliente en el momento del registro** — sensible: el backend tiene que revalidar que el flujo de autoregistro público solo pueda otorgar `'veterinario'` (nunca `'admin'` ni `'superadmin'`) y que la creación de usuario + rol + suscripción inicial siga siendo una única operación atómica, no varios pasos donde un fallo a mitad de camino deje un usuario a medio crear. (Fila que faltaba: el feature original no la registró.) |
| 2026-08-12 | `vet_estado_limite()` (migración `20260812120000`) | Endpoint `GET /api/vet/estado-limite`. Devuelve `caballos_propios`, `limite`, `suscripcion_activa`, `excedente`, `debe_regularizar`. Es el chequeo **retroactivo** del plan gratuito: `vet_puede_agregar_caballo` solo mira al crear, así que un vet que pagó un mes, cargó de más y dejó de pagar conservaba el excedente indefinidamente. Hoy lo consulta el front en `RequireAuth` al entrar; en el backend conviene que además sea un job que marque el estado cuando vence la suscripción, en vez de depender de que el vet abra la app. |
| 2026-08-12 | `dar_de_baja_caballos_veterinario()` (migración `20260812120100`) | Endpoint `POST /api/vet/caballos/baja-lote` con `{ caballo_ids }`. La RPC valida que **todos** los ids sean caballos propios y activos del vet y aborta la operación entera si alguno no lo es — es la especificación del endpoint. Existe como `SECURITY DEFINER` porque la única policy de UPDATE sobre `caballo` es `es_admin(sociedad_id)` y los caballos de vet tienen `sociedad_id IS NULL`. Deliberadamente no toca `acceso_vet`, para que la reactivación (cuando exista el flujo de retomar membresía) sea un solo UPDATE. |
| 2026-08-12 | Modal `LimiteCaballosVetModal.tsx` → botón "Retomar membresía" | ~~Placeholder deshabilitado~~ **Implementado el 2026-08-13** (ver filas de esa fecha). El botón ahora abre el checkout de MercadoPago. |
| 2026-08-12 | `reactivar_caballos_veterinario()` + `get_caballos_propios_vet_inactivos()` (migración `20260812120400`) | Endpoints `GET /api/vet/caballos/inactivos` y `POST /api/vet/caballos/reactivar`. La RPC de reactivación aplica el mismo gate que el alta (sin suscripción vigente, solo hasta llenar el cupo del plan gratuito) — esa validación **no puede quedar solo en el front**, es lo que evita que dar de baja y reactivar sea una evasión trivial del límite. Si en el futuro la reactivación se vuelve automática al reactivar la suscripción, hace falta distinguir en la base la baja por límite de la baja por venta/muerte, dato que hoy no existe. |
| 2026-08-12 | Advisory lock + `superadmin_caballos_propios_por_vet()` (migración `20260812130000`, corrección de code review de `feat/vet-limite-downgrade`) | El check-then-act del cupo en `crear_caballo_veterinario` y `reactivar_caballos_veterinario` (leer el conteo, después insertar/actualizar) tenía una race condition: dos llamadas concurrentes del mismo vet podían leer el mismo conteo antes de que cualquiera commiteara y evadir el límite. En el backend el equivalente es una transacción con `SELECT ... FOR UPDATE` (o el lock que dé el ORM) sobre el conteo, no un check-then-act sin aislamiento. `superadmin_caballos_propios_por_vet(p_vet_ids)` es la especificación de un endpoint `GET /api/superadmin/veterinarios/caballos-propios?ids=...` en lote, restringido a superadmin. |
| 2026-08-13 | Edge Function `crear-suscripcion-vet` | Endpoint `POST /api/vet/suscripcion/checkout`. Crea el preapproval en MercadoPago (`POST /preapproval`, `status: 'pending'`) y devuelve el `init_point`. El `usuario_id` sale del token, nunca del body. Ya resuelve el corte de "ya tenés membresía activa" (evita dos preapprovals cobrando en paralelo) y la lectura del precio desde `plan_suscripcion_vet` — es la especificación del endpoint. Cuando exista el backend, el `MP_ACCESS_TOKEN` debería vivir ahí y no como secret de Supabase. |
| 2026-08-13 | Limpieza de preapprovals abandonados | `crear-suscripcion-vet` da de baja el preapproval anterior del vet si quedó en `pendiente`, pero eso solo corre **cuando el vet vuelve a intentar**. El que abre el checkout, lo abandona y no vuelve nunca deja un `pending` colgado en MercadoPago para siempre. No cobra —no tiene medio de pago asociado— así que es prolijidad, no riesgo. En el backend corresponde un job que barra los `pendiente` con más de N días y los cancele por API, junto con los otros dos jobs ya anotados. |
| 2026-08-13 | Edge Function `cancelar-suscripcion-vet` | Endpoint `DELETE /api/vet/suscripcion` (o `POST .../cancelar`). Hace `PUT /preapproval/{id}` con `status: cancelled` y sincroniza el estado sin esperar al webhook. El id de preapproval se lee de la base a partir del usuario del token, nunca del body — es lo que impide cancelarle la membresía a otro. |
| 2026-08-13 | Edge Function `mercadopago-webhook` | Endpoint `POST /api/webhooks/mercadopago`, público y sin auth de sesión: se autentica con la firma HMAC del header `x-signature` (manifest `id:...;request-id:...;ts:...;`). Tres reglas que hay que conservar al migrarlo: validar la firma antes de mirar el contenido, no confiar en el body (el estado se consulta contra la API de MercadoPago), y responder 200 también a los tópicos que se ignoran o MercadoPago reintenta para siempre. |
| 2026-08-13 | `mp_registrar_preapproval()` / `mp_sincronizar_suscripcion()` / `mp_registrar_pago()` (migración `20260813120100`) | Lógica de facturación en plpgsql: el mapeo de estados de MercadoPago a los nuestros, los 3 días de gracia sobre `next_payment_date` y la idempotencia del registro de pagos. Es la especificación del servicio de suscripciones del backend. Están revocadas de `authenticated` a propósito — solo `service_role` las ejecuta. |
| 2026-08-13 | Cambio de precio de suscripciones ya vivas | MercadoPago sigue cobrando el monto con el que se creó cada preapproval, así que editar `plan_suscripcion_vet.precio` solo afecta a las suscripciones nuevas. Actualizar las existentes requiere un `PUT /preapproval/{id}` por cada una: no está implementado y es trabajo natural de backend (recorrida en lote, reintentos, registro de qué se actualizó). |
| 2026-08-13 | Vencimiento de membresía sin que el vet entre a la app | El estado de pago solo se recalcula cuando llega un webhook o cuando el vet abre la app. Un vet cuya suscripción venció y que no entra nunca queda con `fecha_vencimiento` pasada y estado `'activa'` en la tabla: nada miente porque `vet_suscripcion_activa()` compara contra `NOW()`, pero el listado del superadmin lo muestra como activo. En el backend corresponde un job que barra vencidos, junto con el de `vet_estado_limite()` ya anotado. |
| 2026-08-13 | Tope de la membresía pagada (migración `20260813120200`) | `vet_limite_pago()` (25) y `vet_limite_aplicable(usuario_id)` reemplazan el "sin tope si paga" original: la membresía deja de ser ilimitada. `crear_caballo_veterinario` y `reactivar_caballos_veterinario` ahora chequean el cupo también con suscripción activa — antes el chequeo se salteaba entero. Es la especificación del endpoint equivalente; en el backend el número también debería vivir en un solo lugar. |
| 2026-08-13 | Distinción HM001/HM002 al llenar cada tope (migración `20260813120300`) | `crear_caballo_veterinario` levanta `HM001` cuando se llena el plan gratuito (el front ofrece el checkout) y `HM002` cuando se llena la membresía paga (no hay nada que venderle: el front lo manda a soporte). El backend tiene que preservar los dos códigos de error por separado, no colapsarlos en uno. |
| 2026-08-14 | `superadmin_eliminar_usuario()` + Edge Function `eliminar-usuario` (migración `20260814120000`) | Endpoint `DELETE /api/superadmin/usuarios/{id}`. La RPC es la especificación de la parte transaccional: valida permisos, rechaza con `HM409` si el usuario dejó datos que no se pueden destruir —**el historial clínico nunca se borra**, y `historial_clinico.creado_por` es NOT NULL, así que no hay forma de desvincular la autoría— y solo entonces purga sus caballos propios y sus filas. La Edge Function coordina lo que la RPC no puede: cancelar el preapproval en MercadoPago **antes** (si no, MP sigue cobrando sin registro local) y borrar `auth.users` **después** (Admin API). Los tres pasos no comparten transacción: si el borrado de `auth.users` falla, el perfil ya no está y el email queda tomado. En el backend esto debería ser una saga con compensación explícita, o al menos un registro de qué pasos se completaron. |
| 2026-08-14 | Orden de borrado acoplado al grafo de FK | La purga de `superadmin_eliminar_usuario` borra `venta_caballo` → `trabajo_sanitario_caballo` → `propiedad` → `acceso_vet` → `caballo` en ese orden, porque varias FK contra `caballo` son `RESTRICT`/`NO ACTION` y no cascadean. Cada tabla nueva que referencie `caballo` o `usuario` sin `ON DELETE CASCADE` rompe esta función en silencio (falla recién en tiempo de ejecución). En el backend el equivalente debería derivarse del modelo del ORM, no mantenerse a mano. |
| 2026-08-14 | `validar_campo_caballo()` + trigger `trg_validar_campo_caballo` (migraciones `caballo_campo_mismo_duenio` / `caballo_campo_limpiar_al_cambiar_duenio`) | Regla de integridad de la asignación caballo → campo, hoy en un trigger de DB. Un caballo solo puede estar en un campo de su mismo dueño: los de una sociedad en campos de esa sociedad, los propios de un vet en campos con `vet_owner_id`. Tiene dos comportamientos distintos a propósito y hay que conservar ambos: si el caballo **cambia de dueño** (transferencia entre sociedades, o de vet a organización) el `campo_id` se limpia solo —si abortara, `transferEmpresaService.transferir()` dejaría de funcionar para todo caballo con campo asignado—, mientras que asignar a mano un campo de otro dueño es un error explícito. En el backend es una validación del servicio de caballos más un efecto de la operación de transferencia, no dos reglas sueltas. |
| 2026-08-14 | Edición masiva de campo para veterinarios (pendiente) | `CaballosPage` habilita "Editar en masa" solo para admin/jugador/piloto (`canManageCampos`). Para el vet quedó afuera porque `caballoService.editarMasivo()` aplica un único `campo_id` a todos los ids seleccionados, y el vet ve mezclados sus caballos propios y los de las sociedades donde tiene acceso: aplicar un campo propio a un caballo de sociedad lo rechaza `trg_validar_campo_caballo` y aborta el lote entero. Resolverlo requiere partir el update por dueño (o un endpoint que lo haga del lado del server). Hoy el vet agrupa de a un caballo, desde el alta o la edición. |
| 2026-08-14 | DNI y matrícula del vet en `handle_new_auth_user()` (migración `usuario_dni_y_matricula_vet`) | Endpoint `POST /api/vet/registro`. El DNI obligatorio del veterinario se valida **dentro del trigger que corre en cada INSERT de `auth.users`**, leyendo `raw_user_meta_data->>'dni'` del payload de `auth.signUp()` y abortando con `HM003` si falta. Igual que `rol_solicitado`, es un dato que hoy viaja como metadata declarada por el cliente: el backend tiene que validarlo del lado del servidor (formato y obligatoriedad) y no confiar en el front. Las columnas quedaron nullable porque los 7 vets previos no tienen DNI; si en algún momento se completan esos datos, corresponde migrar a NOT NULL para `rol = 'veterinario'`. Tampoco hay unicidad de DNI: dos vets pueden registrarse con el mismo número, que es un error de negocio que hoy nadie detecta. |
| 2026-08-15 | `crear_plan_sanitario_compartido()` / `compartir_trabajos_con_vet()` / `caballos_sin_acceso_vet()` (migración `20260815000001`) | Endpoints `POST /api/planes-sanitarios` (reemplaza la fila del 2026-08-06, que pedía exactamente esto) y `POST /api/planes-sanitarios/{plan_id}/compartir`. Las tres RPC son la especificación: agrupar caballos por `sociedad_id`, crear los `trabajo_sanitario` con `plan_id` común y sus `trabajo_sanitario_caballo`, otorgar los `acceso_vet` faltantes y notificar — todo en una transacción. La regla que **no** puede quedar en el front: si el vet elegido no tiene acceso a algún caballo del plan y el usuario no autorizó otorgárselo, la operación entera se aborta; el front pregunta antes, pero la función vuelve a validarlo. Ojo con el efecto lateral: compartir un plan otorga acceso al **historial clínico completo y permanente** de esos caballos, no solo a ese plan — el endpoint debería registrar quién lo otorgó (hoy va en `acceso_vet.otorgado_por`). |
| 2026-08-15 | Tabla `notificacion` + el disparo del mail (migración `20260815000001`) | Hoy la notificación in-app se inserta desde `compartir_trabajos_con_vet`, dentro de la misma transacción que el hecho notificado — eso es deliberado y hay que conservarlo (si el plan no se creó, no se notifica). Lo que falta es el **mail**: el proyecto no tiene ningún proveedor de email propio (las 5 Edge Functions actuales son MercadoPago y ABM de usuarios; `create-user` crea con `email_confirm: true` sin enviar nada). El plan acordado es un trigger sobre `notificacion` que llame vía `pg_net` a una Edge Function `enviar-notificacion` con Resend, para que cualquier emisor futuro mande mail sin tocar nada. Requiere cuenta de Resend, dominio verificado y `RESEND_API_KEY` como secret. En el backend esto es una cola de envío con reintentos, no un trigger. |
| 2026-08-15 | Notificaciones sin realtime ni limpieza | `CampanaNotificaciones.tsx` refresca al montar y en cada cambio de ruta, y `notificacionService.listar()` trae las últimas 20. No hay realtime (deliberado: lo que se notifica son planes agendados a días vista) ni purga de notificaciones viejas. En el backend corresponde paginación real y un job de retención. |
| 2026-08-15 | `get_empresas_visibles()` (migración `20260815000002`) | Endpoint `GET /api/empresas` (las visibles para el usuario del token). Codifica una regla de permiso, no un CRUD: el veterinario puede ver el nombre de una sociedad cuando tiene un `acceso_vet` activo sobre alguno de sus caballos, aunque no tenga membresía — la RLS de `sociedad` sola (`tiene_membresia(id)`) se lo niega. El backend tiene que conservar las dos vías y el corte: un vet sin accesos no ve ninguna empresa. Ya hay un precedente con el mismo criterio, `get_caballos_veterinario`; cuando exista la API conviene que sea una sola regla de autorización y no una copia por endpoint. |
| 2026-08-15 | `trabajo_sanitario.vet_owner_id` + validación de padrón en `crear_plan_sanitario_compartido()` (migración `20260815000003`) | Dos cosas para el endpoint `POST /api/planes-sanitarios`. **(a)** Un plan sanitario tiene dos dueños posibles y excluyentes: una sociedad o un veterinario (sus caballos propios, `sociedad_id NULL` + `vet_owner_id`). `sociedad_id` dejó de ser NOT NULL; el invariante lo sostiene `trabajo_sanitario_duenio_check`. Toda regla de autorización que arranque en `tiene_membresia(sociedad_id)` da false para los planes de vet — hay que ramificar explícitamente, y es un error fácil de repetir en el backend. **(b)** La función ahora valida que cada caballo pertenezca al dueño del trabajo. No es cosmético: como es `SECURITY DEFINER`, sus inserts en `trabajo_sanitario_caballo` no pasan por RLS, y sin ese chequeo un miembro de la sociedad A podía colgar caballos de la sociedad B en un plan propio. El backend tiene que validar la pertenencia del lote explícitamente, no delegarla en la RLS de la tabla puente. |
| 2026-08-15 | Compartir planes de caballos propios de un vet (no soportado) | `compartir_trabajos_con_vet()` rechaza los trabajos con `vet_owner_id`. El bloqueo no es de negocio sino técnico: `caballos_sin_acceso_vet()` filtra por `tiene_membresia(c.sociedad_id)`, que para un caballo propio de vet es NULL → false, así que devolvería 0 faltantes y el colega quedaría con el plan visible y los caballos no. Habilitarlo requiere sumarle a esa función la rama `c.vet_owner_id = auth.uid()` y decidir el punto de negocio: si un vet puede darle a un colega el historial clínico de su propia clientela. |
| 2026-08-16 | Derivación de `caballo.sexo` desde la categoría (`caballoService.resolverSexo`) | Regla de negocio que hoy vive en el frontend: el sexo se deriva de la categoría cuando ésta lo determina (`Yegua`→H, `Padrillo`/`Caballo`→M) y solo se pide al usuario en `Potrillo`, donde la cría puede ser de cualquier sexo. El front manda al service únicamente lo que el usuario eligió y la derivación ocurre en un solo lugar antes de escribir, para que un `Padrillo` no pueda quedar guardado como hembra. La DB **no** lo garantiza: el CHECK de `sexo` solo valida H/M y no lo cruza contra `categoria`. En el backend corresponde que esta derivación (o un CHECK compuesto) viva del lado del servidor — hoy un INSERT directo puede violar la regla sin que nada lo impida. |
| 2026-08-16 | `superadmin_actividad_usuarios()` (migración `superadmin_actividad_usuarios`) | Endpoint `GET /api/superadmin/usuarios/actividad`. Dos cosas para conservar. **(a)** Es la única vía por la que el frontend accede a `auth.users` (`email_confirmed_at`, `last_sign_in_at`): con la anon key ese schema es inalcanzable, y por eso la función es `SECURITY DEFINER` con el chequeo de rol adentro. En el backend el dato sale del Admin API de Supabase o de la tabla directamente, pero la restricción a superadmin tiene que seguir siendo del lado del servidor. **(b)** `ultima_accion` es un **sustituto de auditoría, no auditoría**: se deriva del `created_at` más reciente entre las 9 tablas que registran autoría, así que solo detecta acciones que crean filas — ediciones, bajas y consultas son invisibles, y agregar una tabla con autoría nueva exige acordarse de sumarla al UNION. Lo que corresponde el día que exista backend es una tabla `evento_auditoria` escrita por middleware (usuario, acción, entidad, timestamp) y que este endpoint la lea; mientras tanto la derivación cumple, pero subestima la actividad real. |
| 2026-08-16 | Baja idempotente del preapproval + activación manual del superadmin | Dos reglas que hoy viven en `cancelar-suscripcion-vet` / `eliminar-usuario` / `superAdminService.activarSuscripcionVeterinario` y que el endpoint de suscripciones tiene que conservar. **(a)** La baja se consulta antes de escribirse: MercadoPago rechaza con 400 el `PUT /preapproval/{id}` sobre uno que ya está en `cancelled`, y un 404 significa que el preapproval no existe. Ninguno de los dos es un error a los ojos del usuario —no hay nada que pueda cobrar—, así que se sincroniza local y se devuelve ok. El único valor de estado válido es `cancelled` con dos eles; la API responde `Invalid preapproval status param: canceled`. **(b)** El invariante que rompió esto: una membresía activada a mano no puede quedarse con el `external_subscription_id` de una suscripción anterior. Si queda, la app la muestra como paga y el botón de baja apunta a un preapproval muerto. La activación manual limpia el id y marca `proveedor_pago = 'manual'`, y aborta si la suscripción todavía está viva en MercadoPago (borrarle el id ahí dejaría un cobro recurrente sin registro local). Hoy esa validación está en el front: en el backend es del servidor. |
| 2026-08-16 | Referencias sin limpiar en `superadmin_eliminar_usuario()` (migración `20260816200000`) | Dos FK a `usuario` con `ON DELETE NO ACTION` no se limpiaban —`campo.vet_owner_id` y `trabajo_sanitario.vet_owner_id`—, así que la función validaba todo, armaba el mensaje de bloqueos y recién después reventaba en el `DELETE FROM usuario` con un error crudo de Postgres. Le pasaba a cualquier vet que se hubiera creado un campo propio o un plan sanitario sobre sus propios caballos, que es el uso normal del rol. Es el mismo síntoma que ya está anotado como "orden de borrado acoplado al grafo de FK": el chequeo previo y el borrado son dos listas mantenidas a mano que se desincronizan cada vez que aparece una tabla nueva. En el backend, el borrado tiene que derivarse del modelo del ORM (o al menos existir un test que recorra `pg_constraint` y falle si hay una FK a `usuario`/`caballo` que la función no contempla). Se agregó también el bloqueo por caballos de terceros parados en un campo del vet, y el mensaje del historial ahora avisa cuántas consultas cuelgan de un plan sanitario, porque resolverlas a mano exige soltar antes `trabajo_sanitario_caballo.historial_id` y el mensaje anterior no lo decía. |
| 2026-08-18 | Carga de historial clínico por el admin (migración `20260818120000`) | Endpoints `POST /api/historial` y `PUT /api/historial/{id}`. La regla de autorización tiene dos mitades que hay que conservar separadas: **quién puede crear** una consulta sobre un caballo (el veterinario, y ahora el admin de la sociedad dueña) y **quién puede corregirla** (solo su autor, `creado_por = auth.uid()`, sin mirar el rol). El admin ve el historial completo de su empresa pero no puede editar lo que cargó un vet — hoy eso lo sostiene la RLS y el UPDATE simplemente no afecta filas; en el backend tiene que ser un 403 explícito, no un no-op silencioso. Se agregaron además las policies de DELETE de `historial_parte_afectada` / `historial_medicamento`: la edición reescribe esas dos tablas (borrar todo + reinsertar) y sin DELETE el borrado se filtraba en silencio y duplicaba filas. En el backend eso es un reemplazo transaccional de los hijos dentro del mismo endpoint de edición. |
| 2026-08-19 | Editar / eliminar / reprogramar lo programado (migración `20260819120000`) | Endpoints `PATCH /api/trabajos-sanitarios/{id}`, `DELETE /api/trabajos-sanitarios/{id}` y `DELETE /api/historial/{id}`. Tres reglas que hoy sostienen la RLS y el front: **(a)** solo se borra lo que está `pendiente` — una consulta `realizada` o un trabajo cerrado no se eliminan nunca (el trabajo cerrado tiene historial clínico colgando de `trabajo_sanitario_caballo.historial_id`); en el backend tiene que ser un 409 explícito, no un `DELETE` que no afecta filas. **(b)** Quién puede: editar/reprogramar lo puede el autor, la empresa dueña y el vet con quien se compartió; borrar, solo los dos primeros más el `vet_owner`. **(c)** `sanidadService.sincronizarCaballos()` cambia la lista de caballos de un trabajo con un `SELECT` + `DELETE` + `INSERT` sueltos desde el cliente, sin transacción: si falla el insert, los caballos quitados ya se fueron. En el backend es un reemplazo transaccional dentro del `PATCH`, y ahí conviene validar además que cada caballo agregado pertenezca al dueño del trabajo — la RLS de `trabajo_sanitario_caballo` no lo mira. La reprogramación "de una" (mover el trabajo entero a otra fecha, `sanidadService.reprogramarTrabajos`) es un `UPDATE` masivo por ids acotado a `estado = 'pendiente'`: en el backend, el filtro de estado va del lado del server, nunca solo en el query del cliente. |
| 2026-08-24 | Cierre del flushing con destino por embrión (`FlushingModal.tsx`, migración `20260823120000`) | Endpoint `POST /api/flushings` que reciba el flushing entero: `{ donante_id, fecha, padrillo_id, es_negativo, pg_given, embriones: [{tamanio, estadio, grado, zona_pelucida, destino, receptora_id}] }`. Hoy el modal hace **N+2 llamadas sueltas sin transacción**: crea el flushing, inserta el lote de embriones, y después llama `registrar_transferencia_embrionaria` una vez por cada embrión con destino `transferir`. Si falla una transferencia intermedia, el flushing y los embriones ya quedaron guardados y solo algunas transferencias existen — el front avisa y deja los embriones `disponible` para rehacerlas desde Embriones, pero es una compensación manual, no atomicidad. Además el mapeo embrión→destino depende de que el INSERT en lote devuelva las filas en el orden en que se mandaron; el backend debería devolver ids explícitos. |
| 2026-08-24 | `receptorasOvuladas()` (`utils/receptoras.ts`) | Endpoint `GET /api/receptoras/ovuladas?fecha=YYYY-MM-DD`. Hoy se calcula en el front recorriendo **todos** los registros clínicos del store: por cada receptora, la ovulación más reciente (`fecha - ov_dias`) y si ya recibió una transferencia posterior a esa ovulación. Es una query de base disfrazada de loop en memoria — no escala y obliga a tener el store entero cargado. **Falta la definición clínica**: qué ventana de días post-ovulación hace *apta* a una receptora. Hoy la lista sale completa y ordenada por `+N` sin filtro; cuando Gero defina el rango, el filtro va del lado del backend. |
| 2026-08-24 | Estado `'en_nube'` de `embrion` (migración `20260823120000`) | **Nombre provisorio.** Facu pidió el tercer destino con ese label sabiendo que el término correcto lo define Gero. Cuando se renombre hay que tocar: el `CHECK` de `embrion.estado`, el `IF v_estado NOT IN (...)` de `registrar_transferencia_embrionaria`, `EstadoEmbrion`/`DESTINO_LABEL`/`ESTADO_POR_DESTINO` en `types/crianza.ts`, y los labels de `EmbrionesPage`. Migración de datos incluida si ya hay filas cargadas. |
| 2026-08-24 | Posponer recordatorio (`crianzaStore.posponerRecordatorio`) | Endpoint `POST /api/recordatorios/{id}/posponer` con `{ dias }`. Regla que hoy vive en el store: la nueva fecha se calcula **desde hoy**, no desde `fecha_vto`, para que posponer uno vencido hace una semana caiga mañana; y el recordatorio vuelve a `'pendiente'` aunque estuviera `'vencido'`. Es lo que hace que el banner de flushing pueda pasar un flushing del día X al día X+1 sin perderlo. |
| 2026-08-24 | Preñez automática de la receptora (migración `20260824120000`) | Dos reglas de negocio que hoy viven en Postgres. (1) `registrar_transferencia_embrionaria` marca `caballo.prenada = true` con `fecha_prenez = fecha de la transferencia` — en el backend es parte del servicio de transferencia, en la misma transacción. (2) El trigger `sincronizar_prenez_ecografia` sobre `cria_ecografia` saca el tag cuando el resultado es `'abortada'` y lo confirma cuando es `'prenada'` — en el backend es lógica del servicio de ecografía, no un trigger. **Ambas son `SECURITY DEFINER` por necesidad**: la única policy de UPDATE sobre `caballo` es `es_admin(sociedad_id)` y el veterinario no la cumple, así que un UPDATE suyo desde el cliente no matchea filas y devuelve 204 sin error. Cuando exista el backend, el permiso de escribir `caballo` desde estos flujos tiene que ser una decisión explícita del servicio, no una policy que se esquiva. |
| 2026-08-24 | `ultimaInseminacion()` (`utils/inseminacion.ts`) | El padrillo de un flushing no se elige: lo determina la inseminación previa de la donante (último `cria_registro_clinico` con chip `IN` y `padrillo_id`, anterior o igual a la fecha del flushing). Hoy se resuelve en el front recorriendo el store; en el backend es una query y debería venir resuelta en el payload de apertura del flushing, o directamente derivarse server-side al guardar en vez de confiar en el `padrillo_id` que mande el cliente. |
| 2026-08-24 | `crianzaService.actualizarEstadoReproductivo()` — **bug preexistente, sin arreglar** | Hace `UPDATE caballo SET estado_reproductivo` desde el cliente. La única policy de UPDATE sobre `caballo` es `es_admin(sociedad_id)`, así que **para el veterinario no actualiza nada y no tira error** (PostgREST devuelve 204 con 0 filas). O sea: la máquina de estados reproductivos del centro de cría no se sincroniza para el rol que más la usa. No se tocó en la PR del banner de flushing para no ensanchar el alcance. Se arregla igual que la preñez: moviendo el UPDATE adentro de una función `SECURITY DEFINER` (o del backend, cuando exista). |
| 2026-08-24 | `SelectorReceptoras.tsx` — listado de receptoras compartido | El selector de receptora es el mismo en los dos caminos que terminan en transferencia (cierre de flushing y transferencia suelta de un embrión vitrificado / en nube) y se alimenta de `registros` + `transferencias` del store. Cuando exista el endpoint `GET /api/receptoras/ovuladas` (ver fila de `receptorasOvuladas()`), este componente pasa a consumirlo y deja de depender de tener el store entero cargado — hoy `EmbrionesPage` está obligada a llamar a `cargar()` solo para que el modal tenga con qué armar la lista. El grupo "sin ovulación registrada" tiene que venir del mismo endpoint, no de una lista aparte. |
| 2026-08-24 | Recordatorios de ecografía en `registrar_transferencia_embrionaria` (migración `20260824130000`) | La RPC agenda `'Eco 1'`, `'Eco 2'` y `'Eco 3'` a los 30/60/90 días de la transferencia (configurable por vet en `cria_plazo_vet.receptora_transf_a_eco1/2/3`). En el backend es lógica del servicio de transferencia, en la misma transacción. Dos cosas a resolver ahí: (1) el recordatorio no guarda a qué `cria_transferencia` corresponde, así que hoy marcar "Hecho" no puede abrir la ecografía directo como sí hace el de Flushing — falta una FK `transferencia_id` en `cria_recordatorio`; (2) si la receptora recibe una transferencia nueva, los recordatorios de eco de la anterior quedan vivos y hay que cancelarlos. |
| 2026-08-26 | Desglose por empresa del panel del vet (`PanelVetPage.tsx`) | Endpoint `GET /api/vet/panel` que devuelva el resumen ya agregado: por empresa (y por los caballos propios) la cantidad de caballos y de alertas. Hoy el front se trae **la lista entera de caballos** del vet solo para contarlos y agruparlos en memoria — Gerónimo son 186 filas con razas, pelajes, campos y tags, para pintar dos números. Es la misma clase de problema ya anotado para `receptorasOvuladas()`: una query de base disfrazada de loop en el cliente. Dos reglas a conservar cuando exista el endpoint: **(a)** el grupo "Mis caballos" se define por `caballo.vet_owner_id = auth.uid()`, no por `sociedad_id IS NULL` — el día que se pueda compartir un caballo propio con un colega, al colega le llega sin sociedad y no es suyo; **(b)** `get_alertas_vet()` filtra por `hc.creado_por = auth.uid()` sin mirar `acceso_vet`, así que puede devolver alertas de caballos que el vet ya no tiene asignados — el front las agrupa aparte bajo "Otros" para que el desglose sume igual que el total, y el endpoint tiene que decidir explícitamente si las incluye o las descarta. |
