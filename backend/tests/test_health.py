from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.main import create_app


@pytest.mark.db
@pytest.mark.usefixtures("base_local")
def test_health_ok_con_la_base_local(client: TestClient) -> None:
    respuesta = client.get("/health")

    assert respuesta.status_code == 200
    assert respuesta.json() == {"status": "ok", "database": "ok", "environment": "local"}


def test_health_devuelve_503_si_la_base_no_responde() -> None:
    # Puerto 1: la conexión se rechaza al instante, sin depender de la base real.
    motor_roto = create_engine(
        "postgresql+psycopg://x:x@127.0.0.1:1/x", connect_args={"connect_timeout": 1}
    )

    def db_rota() -> Iterator[Session]:
        with Session(motor_roto) as sesion:
            yield sesion

    app = create_app()
    app.dependency_overrides[get_db] = db_rota

    with TestClient(app) as client:
        respuesta = client.get("/health")

    assert respuesta.status_code == 503
    assert respuesta.json() == {"status": "degraded", "database": "error", "environment": "local"}


def test_openapi_expone_health(client: TestClient) -> None:
    """El front genera su cliente TypeScript desde /openapi.json (F6)."""
    esquema = client.get("/openapi.json").json()

    assert "/health" in esquema["paths"]
