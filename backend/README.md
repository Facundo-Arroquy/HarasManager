# Backend — HarasManager API

API en Python (FastAPI) que va a reemplazar, dominio por dominio, las llamadas directas del
frontend a Supabase. Plan completo y orden de las fases: [`docs/PLAN-MIGRACION-BACKEND.md`](../docs/PLAN-MIGRACION-BACKEND.md).

**Estado: F5 (autorización).** Expone `GET /health` y `GET /me`. Valida el JWT de Supabase,
corre cada request con la identidad del usuario (RLS aplica), tiene las reglas de acceso
portadas de Postgres con un banco de pruebas y devuelve los errores con los mismos códigos que
hoy ve el front. Todavía no hay endpoints de negocio (F7 en adelante) y el frontend no la usa.

## Requisitos

- [`uv`](https://docs.astral.sh/uv/) (`brew install uv`). Fija e instala Python 3.12 solo: no
  depende del Python del sistema.
- La base local de Docker arriba: `supabase start` desde la raíz (ver [`docs/ENTORNO-LOCAL.md`](../docs/ENTORNO-LOCAL.md)).

## Comandos

Todos desde `backend/`:

```bash
uv sync                                   # instala las dependencias (crea .venv)
uv run uvicorn app.main:app --reload      # API en http://127.0.0.1:8000 · documentación en /docs
uv run pytest                             # tests (los marcados `db` usan la base local y se saltean si no está)
uv run ruff check . && uv run ruff format --check .   # lint y formato
uv run mypy                               # tipos (modo estricto)
```

`uv run ruff format .` aplica el formato; `uv run ruff check . --fix` arregla lo que se puede.

## Estructura

```
backend/
├── pyproject.toml / uv.lock     dependencias y herramientas (ruff, mypy, pytest)
├── .env.example                 variables de entorno (opcionales en local)
├── app/
│   ├── main.py                  crea la app FastAPI: CORS, errores y routers
│   ├── core/
│   │   ├── config.py            configuración por variables de entorno
│   │   ├── database.py          conexión a la base y `get_db`
│   │   ├── security.py          validación del JWT de Supabase
│   │   ├── rls.py               corre la sesión con la identidad del usuario (modo A)
│   │   ├── permisos.py          reglas de acceso (puras), portadas de las funciones de Postgres
│   │   └── errors.py            formato de errores y traducción de los de Postgres
│   ├── api/                     routers (uno por dominio, solo HTTP), `deps.py` y `permisos.py`
│   ├── schemas/                 modelos Pydantic de entrada y salida
│   ├── services/                reglas de negocio y transacciones
│   ├── repositories/            consultas a la base
│   ├── models/                  modelos SQLAlchemy (parciales: solo las columnas que se usan)
│   └── jobs/                    tareas programadas
└── tests/
```

Reglas de capas (se respetan desde la primera línea para no tener que desarmarlas después):
el router no tiene lógica; el service no conoce HTTP; el repository no decide permisos; los
permisos viven en *dependencies* de FastAPI.

## Autenticación

El login, el registro y el reseteo de contraseña **siguen siendo de Supabase Auth**: el front se
autentica contra él igual que hoy. El backend solo valida el token que ya existe.

1. `Authorization: Bearer <jwt>` → `core/security.py` verifica firma, `exp`, `aud`, `iss` y que
   haya `sub`; rechaza el token anónimo. Las claves públicas las baja de Supabase (JWKS,
   con caché); si el proyecto todavía firma con secreto compartido (HS256), se acepta solo
   con `SUPABASE_JWT_SECRET` configurado. Nunca se usa una clave pública como secreto, y `alg: none` se rechaza.
2. `api/deps.py → get_db_usuario` entrega una sesión que corre **como el usuario**: `role =
   authenticated` y `request.jwt.claims = <token>`, de donde Postgres saca `auth.uid()`. Las
   políticas RLS aplican igual que cuando el front consulta directo. Se reaplica en cada
   transacción: sin eso, un `commit()` dejaría la sesión corriendo como administrador.
3. Los endpoints usan `ClaimsActuales` (quién es) y `DbUsuario` (sesión con RLS).

`GET /me` devuelve el perfil y las membresías del usuario logueado.

| Respuesta | Cuándo |
|---|---|
| `401 no_autenticado` | Falta el header `Authorization` o no es `Bearer` |
| `401 token_vencido` | El token venció: el front tiene que renovar la sesión |
| `401 token_invalido` | Firma mala, de otro proyecto, otro emisor o audiencia, malformado, sin firma… |
| `403 usuario_no_registrado` / `usuario_inactivo` | Token válido, pero no hay perfil en `usuario` o está desactivado |
| `503 auth_no_disponible` | No se pudieron bajar las claves de Supabase: no es culpa del token, y un 401 desloguearía a todos |

## Autorización

Quién es el usuario lo resuelve la sección anterior; **qué puede tocar** lo resuelven las reglas de
`app/core/permisos.py`, portadas 1 a 1 de las funciones auxiliares de Postgres, y las dependencies
`require_*` de `app/api/permisos.py`. Las políticas RLS siguen aplicando: esto es la segunda red, y
la que devuelve un `403` claro en vez de una lista vacía.

| Postgres | Regla (`core/permisos.py`) | Dependency (`api/permisos.py`) | Ámbito |
|---|---|---|---|
| — (cualquier usuario activo) | — | `require_usuario` | usuario |
| `is_superadmin()` | `es_superadmin` | `require_superadmin` | superadmin |
| `tiene_membresia(sociedad)` | `tiene_membresia` | `require_membresia` | sociedad |
| `es_admin(sociedad)` | `es_admin` | `require_admin` | sociedad |
| `es_veterinario(sociedad)` | `es_veterinario` | `require_veterinario` | sociedad |
| `puede_gestionar_campo(sociedad)` | `puede_gestionar_campo` | `require_gestion_campo` | sociedad |
| `puede_gestionar_ficha_caballo(sociedad)` | `puede_gestionar_ficha_caballo` | `require_gestion_ficha_caballo` | sociedad |
| `vet_tiene_acceso(caballo)` | `es_veterinario_activo` + `vet_tiene_acceso_a_caballo` | `require_acceso_caballo` | caballo |

Cada dependency devuelve el `ContextoUsuario` o responde `403 sin_permiso`. El contexto (usuario y
membresías) se carga **una vez por request**; solo `require_acceso_caballo` hace una consulta más.
Un caballo que no existe da el mismo `403` que uno ajeno, para no contar qué ids existen.

```python
@router.get("/sociedades/{sociedad_id}/campos")
def listar(sociedad_id: UUID, ctx: Annotated[ContextoUsuario, Depends(require_gestion_campo)]): ...
```

**Todo endpoint declara al menos una regla.** `tests/test_auditoria_rutas.py` recorre las rutas de la
app y falla si alguna no tiene (salvo `RUTAS_PUBLICAS`: hoy solo `/health`), o si recibe
`sociedad_id`/`caballo_id` y ninguna de sus reglas es de ese ámbito. `require_usuario` es una
elección explícita ("cualquier usuario activo; el filtro lo hace RLS"), no un olvido.

### Banco de pruebas

- **Matriz de permisos** (`tests/test_matriz_permisos.py`): 8 perfiles del seed (superadmin, los
  dos admins, vet con membresía, vet **sin** membresía, jugador, piloto, peticero) contra 17 pruebas
  (cada regla sobre cada recurso), por HTTP real. Es la especificación legible de las reglas.
- **Oráculo de permisos** (`tests/test_oraculo_permisos.py`): cada regla de Python contra su función
  de Postgres corriendo como ese usuario, para los 12 usuarios y todos los recursos del seed, y
  otra vez sobre 9 estados que el seed no tiene (membresía inactiva, acceso revocado, usuario
  desactivado, veterinario que deja de serlo…). Es lo que impide que las dos implementaciones se
  separen sin que nadie lo note. Verificado por mutación: si se rompe una regla en Python, falla.
- **Oráculo para operaciones** (`tests/oraculo.py`, ejemplo en `tests/test_oraculo_ejemplo.py`):
  corre la función vieja y el endpoint nuevo sobre la misma base y el mismo usuario, y compara la
  respuesta y el estado final. Es la plantilla de las fases de dominio.

## Errores

Todos los errores tienen la forma `{"code": "...", "message": "..."}`, la misma que los de
Supabase, así `frontend/src/utils/error.ts` (que decide por `code`) sigue funcionando sin cambios.

| SQLSTATE de Postgres | HTTP | `code` | Significado |
|---|---|---|---|
| `HM001` | 402 | `HM001` | Tope del plan gratuito de caballos propios: se ofrece el checkout |
| `HM002` | 403 | `HM002` | Tope de la membresía paga: se manda a soporte |
| `HM003` | 422 | `HM003` | Falta el DNI al registrarse como veterinario |
| `HM409` | 409 | `HM409` | La baja está bloqueada por datos que dependen del usuario |
| `P0001` (`RAISE` común) | 400 | `regla_de_negocio` | Regla de negocio, con el mensaje del `RAISE` |
| `42501` | 403 | `42501` | Sin permiso (RLS o grants) |
| `23505` / `23503` | 409 | igual al SQLSTATE | Duplicado / referencia |
| `23502` / `23514` / `22P02` | 422 | igual al SQLSTATE | Dato faltante, inválido o con mal formato |
| clases `08`, `53`, `57` | 503 | `base_no_disponible` | La base no puede atender |
| cualquier otro | 500 | `error_interno` | Se loguea; no se devuelve nada interno |

Para los códigos `HM…` el mensaje es el del `RAISE` (texto escrito para el usuario). Para los
estándar se devuelve uno genérico: el de Postgres trae nombres de tablas y constraints.

## Configuración

Todo sale de variables de entorno o de `backend/.env` (no se versiona; copiar `.env.example`).
En local no hace falta nada: los valores por defecto apuntan a los servicios de Docker.

| Variable | Por defecto | Qué es |
|---|---|---|
| `ENVIRONMENT` | `local` | `local`, `staging` o `production` |
| `DATABASE_URL` | `postgresql+psycopg://postgres:postgres@127.0.0.1:55322/postgres` | Conexión a Postgres (driver psycopg 3) |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `5` / `5` | Pool de conexiones (Supabase tiene un tope bajo) |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Orígenes del front permitidos, separados por coma |
| `SUPABASE_URL` | `http://127.0.0.1:55321` | Proyecto de Supabase: de acá salen el emisor del token y sus claves públicas |
| `SUPABASE_JWT_SECRET` | *(vacío)* | Solo si el proyecto firma con secreto compartido (HS256). Local y producción usan ES256: no hace falta |

**Red de seguridad:** con `ENVIRONMENT=local` el backend **se niega a arrancar** si `DATABASE_URL`
o `SUPABASE_URL` apuntan a un host que no sea tu máquina. Así un `.env` mal copiado no puede
escribir en producción ni aceptar sus tokens.

## Tests

`uv run pytest` corre todo; los marcados `db` necesitan la base local con el seed y se saltean
si no responde. Los tests de autenticación fabrican sus propios tokens con una clave de prueba:
no dependen de Supabase. Dos pruebas usan Supabase Auth local de verdad (el caso del front):
toman la anon key de `SUPABASE_ANON_KEY` o de `supabase status`.

Los tests que miran Postgres por dentro (rol, `auth.uid()`, errores) montan unas rutas
`/_t/...` que existen solo en `tests/`, nunca en la API.

## Decisiones

**F3**
- **SQLAlchemy síncrono + psycopg 3.** Las rutas son `def` y FastAPI las corre en un pool de
  hilos. Para esta escala es más simple que async y evita trampas con las transacciones y el
  contexto RLS. Se puede revisar si hace falta.
- **`httpx2` como cliente de tests.** Starlette 1.x dejó `httpx` como deprecado.
- **Sin Dockerfile todavía.** El contenedor llega con el deploy (F28).

**F5**
- **Las reglas se portan a Python y se prueban contra Postgres.** La alternativa era llamar a las
  funciones de la base desde el backend, pero entonces la "segunda red" sería la misma lógica que
  RLS. Con el oráculo, tener la regla escrita dos veces deja de ser un riesgo.
- **Las funciones de la base mandan sobre `docs/SKILL.md`.** `is_superadmin()` no chequea `activo`
  (SKILL.md decía que sí): se porta tal cual. No es un hueco: un usuario inactivo ya queda afuera
  con `403 usuario_inactivo` antes de evaluar ninguna regla.
- **`es_veterinario(sociedad)` da True para cualquier sociedad si el usuario es veterinario
  global** (su segunda mitad mira `usuario.rol`, no la sociedad). Se porta tal cual y la matriz lo
  documenta; quien use la regla tiene que saberlo.
- **Aviso para los dominios: las operaciones `SECURITY DEFINER` no se pueden copiar como un
  `UPDATE` común.** Por ejemplo, `anular_consulta` pone `anulada_at`, y como la política de lectura
  oculta las consultas anuladas, el `UPDATE` del propio autor falla con "new row violates
  row-level security policy". En modo A esas operaciones necesitan validar en Python y ejecutar
  con privilegios elevados solo en ese endpoint (el "modo B puntual" de la decisión 2 del plan).
  Cada caso se resuelve en su fase y se anotó en el Registro de pendientes.

**F4**
- **Se decide por SQLSTATE, no por la clase de la excepción.** psycopg clasifica los códigos
  `HM…` como `OperationalError`, la misma clase que un corte de conexión: mirar la clase mandaba
  un `HM001` a "base no disponible". Tiene un test de regresión.
- **`HM001` → 402 y `HM002` → 403.** Son una decisión de este backend (el front decide por
  `code`, no por el status). Se pueden cambiar sin tocar el front.
- **Los modelos SQLAlchemy son parciales** (`usuario`, `sociedad`, `membresia`, `cat_rol`): cada
  dominio agrega los suyos en su fase.
