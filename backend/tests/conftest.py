from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.database import get_engine
from app.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def base_local() -> None:
    """Saltea el test si la base local de Docker no responde (`supabase start`)."""
    try:
        with get_engine().connect() as conexion:
            conexion.execute(text("SELECT 1"))
    except Exception:
        pytest.skip("La base local no responde: levantala con `supabase start`")
