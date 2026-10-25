# Plan de migración al backend — por fases

> **Estado:** borrador para aprobar · **Fecha:** 2026-10-25 · **Se trabaja sobre:** ramas que parten de `develop`
>
> Este documento ordena **cuándo y en qué orden** se hace la migración. El detalle técnico de cada pieza (modo de auth, endpoints, riesgos) y el **Registro de pendientes de backend** siguen en `docs/BACKEND-API-TASKS.md`, que acá se usa como referencia.

---

## 1. Objetivo

Pasar de "el frontend habla directo con Supabase" a "el frontend habla con una API propia", construyendo el backend **en paralelo, en local, contra una copia de la base en Docker**, sin tocar producción hasta el momento de llevarlo.

- **Mismo producto.** Misma pantalla, mismo comportamiento, mismos permisos. Cero features nuevas.
- **Mejor estructura.** Capas (router → service → repository), contrato OpenAPI, tests por rol, lógica de negocio fuera del navegador y, cuando corresponda, fuera de plpgsql.
- **Producción intacta hasta el cutover.** Cada dominio se enciende con un flag y se puede apagar.

**No es una reescritura:** Supabase Auth, la base, el schema y RLS se quedan.

## 2. Por qué ahora

`BACKEND-API-TASKS.md` (Bloque 0) pedía un disparador objetivo antes de arrancar. Hoy se cumplen varios:

- **Lógica de negocio en plpgsql:** el disparador era "más de ~10 funciones no triviales" y en julio había 2. Hoy el front invoca **48 RPCs distintas**, entre ellas `registrar_acto_reproductivo`, `registrar_transferencia_embrionaria` y seis `eliminar_*_cria`.
- **Lógica de negocio todavía en el navegador:** `reglasParaRegistro` y `sincronizarVencidos` en `crianzaStore.ts`, la derivación de sexo en `caballoService`.
- **Jobs que no existen** (`sincronizarVencidos` solo corre si alguien abre la app) y **5 Edge Functions** con secretos y dinero real (MercadoPago), sin estructura común.

Además es una decisión de arquitectura del equipo. Esto **cambia el "Stack inamovible" y el principio 7 de `docs/SKILL.md`** ("toda regla de negocio vive en funciones SECURITY DEFINER"). La razón queda documentada acá; `SKILL.md` se actualiza en F0 (nota que apunta a este plan) y en F30 (versión definitiva).

## 3. Punto de partida (medido el 2026-10-25)

| | Hoy | Julio 2026 |
|---|---|---|
| Services en el front | 22 archivos, 4.371 líneas | 15 archivos, ~3.100 |
| RPCs distintas llamadas desde el front | 48 (medido con `grep`) | 10 |
| Edge Functions | 5 (911 líneas) | — |
| Migraciones en `supabase/migrations/` | 137, **con drift** respecto a prod | — |
| Tests en el front | 4 archivos | — |
| Migraciones aplicadas en prod | 115 (el repo tiene 137: hay drift) | — |
| Tablas / policies / funciones / triggers (`public`) | 55 / 165 / 92 / 51 (medido en F1) | 30 / 100 / 24 / 20 |

Dominios del front (carpetas de `pages/`): admin, auth, caballos, calendario, centro-cría, config, dashboard, estadísticas, historial, sanidad, superadmin, torneos, transferencias, vet.

## 4. Cómo se trabaja

```
 feat/* ───PR───►  develop  ───PR───►  main
 (local)         (integración)       (producción)
   │                  │                   │
 Supabase en       Supabase en        Supabase prod
 Docker            Docker / CI        + Vercel
```

| Ambiente | Front | Base | Backend |
|---|---|---|---|
| Local (`feat/*`) | Vite `:5173` | Supabase en Docker (`:55321` API, `:55322` Postgres, `:55323` Studio; puertos propios porque otro stack local usa el rango 543xx) | `uvicorn :8000` |
| Producción (`main`) | Vercel | Supabase prod | no existe hasta F28/F29 |

- Cada fase sale de `develop` en su propia rama y vuelve por **PR a `develop`**.
- Llevar a producción = **PR `develop` → `main`**. Recién ahí se aplican las migraciones a la base de prod (hasta que exista el Action de F27, se siguen aplicando a mano con el MCP, solo desde `main` y con aprobación explícita).
- El backend corre en local con `uvicorn`; Docker es solo para la base y para el deploy.

## 5. Reglas del juego

1. **Timebox: ninguna fase dura más de 2 días de trabajo seguidos.** Si al terminar el día 2 no está verde, se corta: lo que anda se mergea detrás del flag apagado y lo que falta pasa a una fase nueva. Nunca se estira.
2. **Una fase = un PR chico a `develop`**, con tests verdes y la app funcionando igual con todos los flags apagados.
3. **Paridad** quiere decir tres cosas, y las tres se testean:
   - *Misma respuesta:* los mismos campos y tipos que hoy consume el front. Se adapta en el backend, no en las pantallas.
   - *Mismo estado final en la base* para la misma entrada.
   - *Mismos errores:* mismo `code` (`HM001`, `HM002`, `HM003`, `HM409`…). Donde hoy hay un no-op silencioso por RLS, el backend responde 403/409 explícito.
4. **Convivencia, no reemplazo.** Un flag por dominio en el front. Apagado = camino actual (Supabase directo); prendido = API. Las RPC no se borran hasta F30.
5. **La RPC vieja es el oráculo.** Para cada operación portada, un test ejecuta la RPC y el endpoint sobre la misma base local y compara respuesta y estado final.
6. **Congelamiento de alcance.** Un cambio de negocio sobre un dominio ya portado se hace en el backend; sobre uno no portado, como hoy (SQL) más una fila en el Registro de `BACKEND-API-TASKS.md`.
7. **`main` → `develop` el mismo día.** Todo merge a `main` (hotfix, migración) se mergea a `develop`. Antes de cada PR `develop` → `main` se corre el comparador de schema de F1.
8. **Durante el desarrollo, producción es de solo lectura** desde las ramas de trabajo: ni `apply_migration` ni SQL de escritura por el MCP.
9. **Repo público:** sin secretos, sin datos reales de clientes. El seed es ficticio.

## 6. Decisiones a cerrar en F0

| # | Decisión | Recomendación | Estado |
|---|---|---|---|
| 1 | Lenguaje y framework | Python 3.12 + FastAPI (ya definido en `BACKEND-API-TASKS.md` y `CLAUDE.md`; Express descartado) | confirmada (2026-10-25) |
| 2 | Cómo accede a la base | **Modo A:** JWT del usuario, RLS sigue aplicando. **Modo B** (`service_role`) solo en endpoints puntuales: crear/eliminar usuario, webhook, jobs | confirmada (2026-10-25) |
| 3 | Quién manda en el schema | Migraciones SQL con Supabase CLI como única herramienta. SQLAlchemy solo para consultar (Alembic no entiende RLS, funciones ni triggers) | confirmada (2026-10-25) |
| 4 | Triggers y RPCs durante la migración | No se tocan: son el oráculo y la red de seguridad. Cuáles se retiran se decide en F30 | confirmada (2026-10-25) |
| 5 | Dónde queda la lógica de negocio | En services de Python; las RPC siguen vivas hasta F30 | confirmada (2026-10-25) |
| 6 | Contrato con el front | OpenAPI generado por FastAPI + cliente TypeScript generado | confirmada (2026-10-25) |
| 7 | Hosting del backend | Abierta. Candidatos: Fly.io / Railway / Render, región cercana a `us-west-1`. Se decide antes de F28 | abierta |
| 8 | ¿MercadoPago y las Edge Functions migran? | Abierta. Se decide antes de F25: es dinero real y hoy funciona | abierta |

## 7. Arquitectura objetivo

```
backend/
├── pyproject.toml
├── Dockerfile
├── .env.example
├── app/
│   ├── main.py            # FastAPI, CORS, routers
│   ├── core/              # config, seguridad (JWT), errores, logging
│   ├── api/               # routers: uno por dominio, solo HTTP
│   ├── schemas/           # Pydantic: request / response
│   ├── services/          # reglas de negocio y transacciones (casos de uso)
│   ├── repositories/      # consultas a la base
│   ├── models/            # SQLAlchemy sobre el schema existente
│   └── jobs/              # tareas programadas
└── tests/                 # permisos por rol, aislamiento multi-tenant, oráculo
```

- El router no tiene lógica. El service no conoce HTTP. El repository no decide permisos.
- Los permisos viven en *dependencies* (`require_membresia`, `require_admin`, `require_superadmin`, `require_acceso_caballo`, `require_gestion_campo`), el equivalente a los helpers RLS de `SKILL.md`.
- Ningún endpoint de negocio omite el filtro por `sociedad_id`; un test recorre los routers y falla si alguno lo hace.

---

## 8. Plan por fases

Estimación gruesa en días de trabajo (±30%). Total: **≈45 días-persona**; con dos personas, las etapas 2 a 5 se pueden repartir porque son independientes entre sí una vez hecha la F6. No es un calendario: pausar entre fases es gratis porque cada una deja el sistema entero.

### Etapa 0 — Entorno local (2,5 días)

| Fase | Qué se hace | Terminado cuando | Días | Estado |
|---|---|---|---|---|
| **F0** | Cerrar las decisiones de §6. Actualizar `CLAUDE.md` (flujo `feat/*` → `develop` → `main`, migraciones, MCP de solo lectura en prod). Nota en `SKILL.md` que apunte a este plan | Decisiones 1 a 6 confirmadas (7 y 8 abiertas a propósito); `CLAUDE.md` y nota en `SKILL.md` actualizados; PR a `develop` mergeado | 0,5 | hecha en `feat/plan-migracion-backend`; falta mergear a `develop` |
| **F1** | Supabase local en Docker: `supabase init`; dump de **solo schema** de prod (lectura); archivar las 137 migraciones y reemplazarlas por una *baseline* contrastada con `list_migrations` de prod; `supabase start`; script que compara tablas, policies, funciones, triggers y buckets entre local y prod | `supabase start` levanta y el comparador da 0 diferencias | 1 | hecha en `feat/f1-supabase-local`; falta PR. Comparador: `scripts/db-compare.sh` (ver `docs/ENTORNO-LOCAL.md`) |
| **F2** | Seed ficticio en `supabase/seeds/` (el `seed.sql` viejo usaba el modelo de marca, que nunca se aplicó en prod, y quedó archivado). Usuarios demo en el Auth local con los emails de los demo de prod (lista confirmada el 2026-10-25) más un superadmin y un vet sin membresía ficticios, y una contraseña de desarrollo. `frontend/.env.local` apuntando a local. Edge Functions locales con secretos de prueba | `supabase db reset` deja todo listo y se puede navegar la app completa contra local con cada rol | 1 | hecha en `feat/f1-supabase-local` (commits de F2 sobre la misma rama); falta PR. Verificación: `scripts/db-verificar-seed.sh` ||

### Etapa 1 — Cimientos del backend (5,5 días)

| Fase | Qué se hace | Terminado cuando | Días | Estado |
|---|---|---|---|---|
| **F3** | Esqueleto de `backend/` según §7. Python 3.12 fijado con `uv` (no depender del Python del sistema), `pydantic-settings`, `GET /health` con `SELECT 1`, ruff + mypy + pytest, `.env.example`, README con los comandos | `uvicorn` levanta contra la base local, `/health` responde ok y `pytest` pasa | 1 | pendiente |
| **F4** | Auth modo A: validar el JWT de Supabase (firma, `exp`, `aud`, `iss`; secreto simétrico y JWKS por config), `GET /me`, propagar claims a Postgres (`SET LOCAL role authenticated` + `request.jwt.claims`). Traducir errores de Postgres a HTTP con `code` estable (`HM001`, `HM002`, `HM003`, `HM409`) para que `utils/error.ts` siga funcionando | `/me` responde con el token real del front; token vencido, de otro proyecto o sin firma → 401; los cuatro códigos tienen test | 1,5 | pendiente |
| **F5** | Autorización y banco de pruebas: las *dependencies* de §7; fixtures de 5 perfiles (superadmin, admin, vet con membresía, vet sin membresía, usuario de otra sociedad) sobre el seed; test de aislamiento multi-tenant; **helper oráculo** (RPC vieja vs endpoint nuevo, misma base, compara respuesta y estado final) | La matriz de permisos corre y el oráculo tiene un ejemplo documentado | 2 | pendiente |
| **F6** | Contrato y cliente: export de OpenAPI, cliente TS generado en `frontend/src/api/`, `apiClient` que adjunta el token de Supabase, flag por dominio, CORS | Un endpoint de prueba se llama desde el front con el flag prendido y apagado; el cliente se regenera con un comando | 1 | pendiente |

### Etapa 2 — Base y caballos (6,5 días)

| Fase | Qué se hace | Terminado cuando | Días | Estado |
|---|---|---|---|---|
| **F7** | Catálogos, perfil, módulos de acceso (`get_mis_accesos_modulo`, `set_*_modulo`), empresas visibles, sociedades activas. Primer dominio completo siguiendo la receta de §9 | Flag prendido en local sin diferencias visibles; oráculo y matriz verdes | 1 | pendiente |
| **F8** | Campos, tags, empresa y marca (`campoService`, `tagService`, `empresaService`, `marcaService`) | Ídem | 1 | pendiente |
| **F9** | Caballos I, lectura: `get_caballos_veterinario` / `_sociedad` / `_propios_vet` / inactivos / pedigree, parentesco (`ancestros_caballo`, `get_padrillos_familiares`) | Listados idénticos con y sin flag para cada rol | 1,5 | pendiente |
| **F10** | Caballos II, vet y límite freemium: crear (`HM001`/`HM002`, lock por vet), baja y reactivación en lote (acceso **o** propiedad), `vet_estado_limite`, `toggle_prenada` | Test de concurrencia del cupo; los dos códigos distinguidos | 1,5 | pendiente |
| **F11** | Caballos III, resto: actualizar (vet y admin), edición masiva, transferir a sociedad y entre empresas, derivación de sexo desde la categoría, regla de campo del mismo dueño | Oráculo verde en todas las operaciones | 1,5 | pendiente |

### Etapa 3 — Clínico (4 días)

| Fase | Qué se hace | Terminado cuando | Días | Estado |
|---|---|---|---|---|
| **F12** | Historial clínico: crear, editar, anular. Inmutabilidad (403 explícito), reemplazo transaccional de los hijos, toda lectura excluye anuladas por defecto | Un admin no puede editar lo que cargó un vet; las anuladas no aparecen en ningún listado | 1,5 | pendiente |
| **F13** | Sanidad I, trabajos individuales: listar, editar/reprogramar, borrar (409 si no está pendiente), cambiar caballos de un trabajo en una transacción | Oráculo verde | 1 | pendiente |
| **F14** | Sanidad II, planes: `crear_plan_sanitario_compartido`, `compartir_trabajos_con_vet`, `caballos_sin_acceso_vet`, `cerrar_plan_sanitario`, `completar_trabajo_sanitario`; la notificación va en la misma transacción | Oráculo verde; si falla a mitad no queda nada creado | 1,5 | pendiente |

### Etapa 4 — Centro de cría (9 días) · el dominio más delicado

| Fase | Qué se hace | Terminado cuando | Días | Estado |
|---|---|---|---|---|
| **F15** | Configuración y lectura: `get_configuracion_cria_efectiva`, plazos y acciones del vet, reglas propias, listados de registros / flushings / embriones / transferencias / ecografías / recordatorios, receptoras ovuladas | Listados idénticos para vet con y sin membresía (el caso que rompió `embrion_select`) | 1,5 | pendiente |
| **F16** | `POST /registros-cria` (port de `registrar_acto_reproductivo`): reglas fijas y propias **del vet que firma**, `review_dias`, `1PG`, inseminación reciente, duplicados de revisión, bloqueo de familiar directo | Oráculo verde sobre una tabla de casos por chip | 2 | pendiente |
| **F17** | `POST /flushings` atómico (cierre de ciclo + embriones con destino + transferencias), embrión vitrificado manual, cierre de recordatorios resueltos | Si falla una transferencia no queda nada guardado | 2 | pendiente |
| **F18** | Transferencia y ecografías: `POST /transferencias` (lock del embrión, `en_nube`, agenda Eco 1/2/3), `registrar_resultado_ecografia`, vigencia de la transferencia, reversión de aborto. El trigger de preñez sigue siendo el que sincroniza (decisión 4) | Doble transferencia concurrente del mismo embrión rechazada | 2 | pendiente |
| **F19** | Los 6 `eliminar_*_cria` (cascada, 409, reapertura de recordatorios), `PATCH` de cada entidad, resolver y posponer recordatorio como una sola operación | Oráculo verde, incluida la cascada | 1,5 | pendiente |

### Etapa 5 — Resto de la app (9,5 días)

| Fase | Qué se hace | Terminado cuando | Días | Estado |
|---|---|---|---|---|
| **F20** | Torneos: `guardar_asignaciones_torneo`, `guardar_ranking_padrillos`, `torneoService` | Oráculo verde | 1 | pendiente |
| **F21** | Dashboard y avisos: `get_dashboard_stats`, `get_alertas_vet`, `get_consultas_recientes_vet`, notificaciones, leads, términos | Oráculo verde | 1 | pendiente |
| **F22** | Admin y superadmin (datos): `adminService`, `superAdminService`, `superadmin_actividad_usuarios`, activación manual de suscripción | Restricción a superadmin verificada del lado del server | 1,5 | pendiente |
| **F23** | Usuarios (modo B puntual): `create-user`, `eliminar-usuario` como saga con compensación explícita, registro de vet revalidando rol y DNI en el servidor, `buscar_usuario_por_email` | El autoregistro público nunca puede otorgar `admin` ni `superadmin` | 1,5 | pendiente |
| **F24** | Storage: URLs firmadas de corta duración para fotos de caballos y fichas históricas, permiso validado antes de firmar | Subir y ver foto y ficha funciona vía API | 1 | pendiente |
| **F25** | MercadoPago: checkout, cancelación, webhook (firma HMAC), `mp_*`; probado con sandbox. **Se omite** si la decisión 8 deja las Edge Functions | Ciclo completo en sandbox: alta, cobro, cancelación | 2 | pendiente |
| **F26** | Jobs: `sincronizarVencidos`, vencimiento de membresías y estado de límite del vet, log de cada corrida, endpoint protegido por secreto | Los estados se recalculan sin que nadie abra la app | 1,5 | pendiente |

### Etapa 6 — Producción (8 días)

| Fase | Qué se hace | Terminado cuando | Días | Estado |
|---|---|---|---|---|
| **F27** | CI/CD: GitHub Actions con lint y tests del backend, typecheck y tests del front, `supabase db reset` en CI. Action que aplica las migraciones a prod al mergear `develop` → `main`. Protección de ramas | Un PR rojo no se puede mergear; el merge a `main` migra la base de prod | 1,5 | pendiente |
| **F28** | Deploy y observabilidad: hosting (decisión 7), Dockerfile, pooler (Supavisor), logs JSON, Sentry, `/health` para el orquestador, ambiente de staging con su propia base | La API responde en staging con HTTPS y alertas | 1,5 | pendiente |
| **F29** | Cutover, **una repetición por dominio**: prender su flag en producción, de menor a mayor riesgo (orden de las etapas 2 → 5), y monitorear errores y latencia. Rollback = apagar el flag | Todos los dominios en la API. Entre repetición y repetición hay días de espera de monitoreo que no cuentan como esfuerzo | 0,5 c/u (≈3) | pendiente |
| **F30** | Cierre: borrar los caminos viejos de los services del front, decidir qué triggers y RPCs se retiran (decisión 4), actualizar `SKILL.md` (Stack y principio 7) y `CLAUDE.md`, archivar `BACKEND-API-TASKS.md`, rotar la anon key si el front ya no habla directo | El front no tiene llamadas directas a Supabase salvo auth (y storage, si se eligió así) | 2 | pendiente |

---

## 9. Receta por dominio (F7 a F26)

Cada fase de dominio cumple esta lista; no hace falta repetirla en cada una.

1. Leer las filas del **Registro de pendientes** de `BACKEND-API-TASKS.md` y la sección del dominio en `SKILL.md`. Son la especificación: nombres de endpoint, reglas a conservar, huecos conocidos.
2. Inventariar las llamadas del service del front y las RPC que se reemplazan. Definir endpoints y schemas Pydantic.
3. Implementar router → service → repository, sin lógica en el router.
4. Tests: matriz de permisos por rol, aislamiento multi-tenant, códigos de error y **oráculo** contra la RPC o consulta vieja.
5. Front: el service del dominio usa el cliente generado detrás del flag. Páginas y componentes no cambian.
6. Documentar: mapa policy → endpoint en `SKILL.md` y tachar las filas resueltas del Registro.
7. PR chico a `develop` con el checklist de paridad (§5, regla 3) completo.

## 10. Fuera de alcance

- Cambios de UI y funcionalidades nuevas.
- Reemplazar Supabase Auth o apagar RLS.
- Realtime a través del backend (si algún día se usa, va directo).
- Mejoras que el Registro anota como futuras: avisos de parto, auditoría por middleware, cola de mails con reintentos, endpoint agregado del panel del vet, retención de notificaciones y auditoría. Van después de F30, una por una.
- Retirar triggers o RPCs antes de F30.

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| La lógica de la RPC y la de Python se desincronizan mientras conviven | Oráculo en cada operación portada; regla 6 de congelamiento |
| Drift entre local, `develop` y prod | Regla 7 y comparador de schema de F1 antes de cada PR a `main` |
| Subestimar el centro de cría (`crianzaService` 972 líneas, `crianzaStore` 554) | Cuatro fases propias con tope de 2 días; si no cierra, se corta y se divide |
| Dispersión: dos personas, y el producto sigue evolucionando | Timebox, PRs chicos, fases independientes a partir de F6 |
| Plata real en MercadoPago | F25 va casi al final, con sandbox, y puede omitirse (decisión 8) |
| Local no se parece a prod (extensiones, pooler, config de Auth) | El comparador cubre extensiones; todo se prueba en staging (F28) antes del cutover |
| Latencia del salto extra y límite de conexiones del plan | Hosting en la región de la DB, pooler, pool dimensionado |
| Un endpoint sin filtro de `sociedad_id` filtra datos entre haras | Modo A + test automático que recorre los routers |
