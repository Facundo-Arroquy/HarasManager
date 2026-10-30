"""Conexión a Postgres (SQLAlchemy síncrono + psycopg 3).

Las rutas son `def` normales: FastAPI las corre en un pool de hilos. Para esta escala
(unas decenas de sociedades) es más simple que el modo async y alcanza.
"""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    return create_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,
    )


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependency de FastAPI: una sesión por request, cerrada al terminar."""
    with _session_factory()() as db:
        yield db
