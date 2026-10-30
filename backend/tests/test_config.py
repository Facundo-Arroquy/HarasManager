from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings

BASE_REMOTA = "postgresql+psycopg://postgres:secreto@db.abcdefgh.supabase.co:5432/postgres"


def crear_settings(**valores: Any) -> Settings:
    """Settings sin leer el `.env` del desarrollador, para que el test no dependa de él."""
    return Settings(**{"_env_file": None, **valores})


def test_por_defecto_apunta_a_la_base_local() -> None:
    settings = crear_settings()

    assert settings.environment == "local"
    assert "127.0.0.1:55322" in settings.database_url


def test_local_rechaza_una_base_remota() -> None:
    """Red de seguridad: un .env mal copiado no puede apuntar a producción en local."""
    with pytest.raises(ValidationError, match="ENVIRONMENT=local"):
        crear_settings(environment="local", database_url=BASE_REMOTA)


def test_local_rechaza_un_supabase_remoto() -> None:
    """Si no, el backend local aceptaría tokens de producción."""
    with pytest.raises(ValidationError, match="SUPABASE_URL"):
        crear_settings(environment="local", supabase_url="https://abcdefgh.supabase.co")


@pytest.mark.parametrize("entorno", ["staging", "production"])
def test_staging_y_produccion_pueden_usar_una_base_remota(entorno: str) -> None:
    settings = crear_settings(environment=entorno, database_url=BASE_REMOTA)

    assert settings.environment == entorno


def test_el_emisor_y_las_claves_salen_de_la_url_de_supabase() -> None:
    settings = crear_settings(
        environment="production",
        database_url=BASE_REMOTA,
        supabase_url="https://abcdefgh.supabase.co/",
    )

    assert settings.jwt_issuer == "https://abcdefgh.supabase.co/auth/v1"
    assert settings.jwks_url == "https://abcdefgh.supabase.co/auth/v1/.well-known/jwks.json"


def test_cors_origins_se_separa_por_coma_y_ignora_espacios() -> None:
    settings = crear_settings(cors_origins=" https://a.com , http://localhost:5173,, ")

    assert settings.cors_origins_list == ["https://a.com", "http://localhost:5173"]


def test_cors_permite_el_front_local(client: TestClient) -> None:
    respuesta = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert respuesta.status_code == 200
    assert respuesta.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_no_permite_otros_origenes(client: TestClient) -> None:
    respuesta = client.options(
        "/health",
        headers={"Origin": "https://sitio-ajeno.com", "Access-Control-Request-Method": "GET"},
    )

    assert "access-control-allow-origin" not in respuesta.headers
