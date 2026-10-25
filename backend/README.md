# Backend — HarasManager API

API en Python (FastAPI) que va a reemplazar, dominio por dominio, las llamadas directas del
frontend a Supabase. Plan completo y orden de las fases: [`docs/PLAN-MIGRACION-BACKEND.md`](../docs/PLAN-MIGRACION-BACKEND.md).

**Estado: F3 (esqueleto).** Hoy solo expone `GET /health`. No hay autenticación ni endpoints
de negocio todavía (F4 en adelante), y el frontend no la usa.

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
│   ├── main.py                  crea la app FastAPI: CORS y routers
│   ├── core/                    configuración (config.py) y conexión a la base (database.py)
│   ├── api/                     routers: uno por dominio, solo HTTP
│   ├── schemas/                 modelos Pydantic de entrada y salida
│   ├── services/                reglas de negocio y transacciones
│   ├── repositories/            consultas a la base
│   ├── models/                  modelos SQLAlchemy sobre el schema existente
│   └── jobs/                    tareas programadas
└── tests/
```

Reglas de capas (se respetan desde la primera línea para no tener que desarmarlas después):
el router no tiene lógica; el service no conoce HTTP; el repository no decide permisos; los
permisos viven en *dependencies* de FastAPI.

## Configuración

Todo sale de variables de entorno o de `backend/.env` (no se versiona; copiar `.env.example`).
En local no hace falta nada: los valores por defecto apuntan a la base de Docker.

| Variable | Por defecto | Qué es |
|---|---|---|
| `ENVIRONMENT` | `local` | `local`, `staging` o `production` |
| `DATABASE_URL` | `postgresql+psycopg://postgres:postgres@127.0.0.1:55322/postgres` | Conexión a Postgres (driver psycopg 3) |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `5` / `5` | Pool de conexiones (Supabase tiene un tope bajo) |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Orígenes del front permitidos, separados por coma |

**Red de seguridad:** con `ENVIRONMENT=local` el backend **se niega a arrancar** si `DATABASE_URL`
apunta a un host que no sea tu máquina. Así un `.env` mal copiado no puede escribir en producción.

## Decisiones de la F3

- **SQLAlchemy síncrono + psycopg 3.** Las rutas son `def` y FastAPI las corre en un pool de
  hilos. Para esta escala es más simple que async y evita trampas con `SET LOCAL` y las
  transacciones que vienen con la autenticación (F4). Se puede revisar si hace falta.
- **`httpx2` como cliente de tests.** Starlette 1.x dejó `httpx` como deprecado.
- **Sin Dockerfile todavía.** El backend corre con `uvicorn` en local; el contenedor llega con el
  deploy (F28).
