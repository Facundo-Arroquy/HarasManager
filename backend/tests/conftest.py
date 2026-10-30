from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db, get_engine
from app.core.security import VerificadorJwt, get_verificador
from app.main import create_app
from tests.jwt_utils import ClaveEc, nueva_clave_ec, verificador_de_prueba


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


@pytest.fixture(scope="session")
def clave() -> ClaveEc:
    return nueva_clave_ec()


@pytest.fixture
def verificador(clave: ClaveEc) -> VerificadorJwt:
    return verificador_de_prueba(clave)


@pytest.fixture
def app_con_verificador(verificador: VerificadorJwt) -> FastAPI:
    """La app con un verificador que acepta los tokens firmados con la clave de prueba."""
    app = create_app()
    app.dependency_overrides[get_verificador] = lambda: verificador
    return app


@pytest.fixture
def db_transaccional(base_local: None) -> Iterator[Session]:
    """Una sesión cuyos cambios se descartan al terminar el test (no toca el seed)."""
    conexion = get_engine().connect()
    externa = conexion.begin()
    sesion = Session(bind=conexion, join_transaction_mode="create_savepoint", autoflush=False)
    try:
        yield sesion
    finally:
        sesion.close()
        externa.rollback()
        conexion.close()


@pytest.fixture
def app_con_db_transaccional(app_con_verificador: FastAPI, db_transaccional: Session) -> FastAPI:
    app_con_verificador.dependency_overrides[get_db] = lambda: db_transaccional
    return app_con_verificador
