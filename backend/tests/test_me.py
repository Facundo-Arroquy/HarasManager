"""GET /me: autenticación (sin base) y perfil del usuario (con la base local y el seed)."""

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from tests.constantes import ADMIN_1, SOCIEDAD_1, VET_INDEPENDIENTE
from tests.jwt_utils import ClaveEc, emitir_token, nueva_clave_ec, verificador_de_prueba


def autorizacion(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# --- Autenticación: ninguno de estos tests necesita la base --------------------------------


def test_sin_token_responde_401(app_con_verificador: FastAPI) -> None:
    respuesta = TestClient(app_con_verificador).get("/me")

    assert respuesta.status_code == 401
    assert respuesta.json() == {
        "code": "no_autenticado",
        "message": "Falta el token de autenticación.",
    }
    assert respuesta.headers["www-authenticate"] == "Bearer"


def test_con_otro_esquema_de_autorizacion_responde_401(app_con_verificador: FastAPI) -> None:
    respuesta = TestClient(app_con_verificador).get(
        "/me", headers={"Authorization": "Basic dXNlcjpwYXNz"}
    )

    assert respuesta.status_code == 401
    assert respuesta.json()["code"] == "no_autenticado"


def test_token_vencido_responde_401_con_su_propio_codigo(
    app_con_verificador: FastAPI, clave: ClaveEc
) -> None:
    """El código distinto le permite al front renovar la sesión en vez de sacar al usuario."""
    token = emitir_token(clave, sub=ADMIN_1, vence_en=-60)

    respuesta = TestClient(app_con_verificador).get("/me", headers=autorizacion(token))

    assert respuesta.status_code == 401
    assert respuesta.json()["code"] == "token_vencido"


def test_token_de_otro_proyecto_responde_401(app_con_verificador: FastAPI) -> None:
    token = emitir_token(nueva_clave_ec(), sub=ADMIN_1)

    respuesta = TestClient(app_con_verificador).get("/me", headers=autorizacion(token))

    assert respuesta.status_code == 401
    assert respuesta.json()["code"] == "token_invalido"


def test_si_supabase_no_responde_el_error_es_503_y_no_401(clave: ClaveEc) -> None:
    """Un 401 acá desloguearía a todos los usuarios por una caída de Supabase."""
    from app.core.security import get_verificador
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_verificador] = lambda: verificador_de_prueba(
        clave, jwks_caido=True
    )

    respuesta = TestClient(app).get("/me", headers=autorizacion(emitir_token(clave, sub=ADMIN_1)))

    assert respuesta.status_code == 503
    assert respuesta.json()["code"] == "auth_no_disponible"


def test_un_token_invalido_no_llega_a_abrir_una_conexion(app_con_verificador: FastAPI) -> None:
    def base_prohibida() -> Iterator[Session]:
        raise AssertionError("no debería abrirse una sesión sin un token válido")
        yield  # pragma: no cover

    app_con_verificador.dependency_overrides[get_db] = base_prohibida

    respuesta = TestClient(app_con_verificador).get("/me")

    assert respuesta.status_code == 401


# --- Perfil: con la base local ---------------------------------------------------------------


@pytest.mark.db
@pytest.mark.usefixtures("base_local")
def test_devuelve_el_perfil_y_las_membresias(app_con_verificador: FastAPI, clave: ClaveEc) -> None:
    token = emitir_token(clave, sub=ADMIN_1)

    respuesta = TestClient(app_con_verificador).get("/me", headers=autorizacion(token))

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["id"] == str(ADMIN_1)
    assert cuerpo["email"] == "admin.demo1@haras.com"
    assert cuerpo["rol"] == "admin"
    assert cuerpo["activo"] is True
    assert cuerpo["membresias"] == [
        {"sociedad_id": str(SOCIEDAD_1), "sociedad": "Haras Demo 1", "rol": "admin", "activa": True}
    ]


@pytest.mark.db
@pytest.mark.usefixtures("base_local")
def test_un_vet_sin_membresia_tiene_la_lista_vacia(
    app_con_verificador: FastAPI, clave: ClaveEc
) -> None:
    token = emitir_token(clave, sub=VET_INDEPENDIENTE)

    respuesta = TestClient(app_con_verificador).get("/me", headers=autorizacion(token))

    assert respuesta.status_code == 200
    assert respuesta.json()["rol"] == "veterinario"
    assert respuesta.json()["membresias"] == []


@pytest.mark.db
@pytest.mark.usefixtures("base_local")
def test_un_token_valido_de_alguien_sin_perfil_responde_403(
    app_con_verificador: FastAPI, clave: ClaveEc
) -> None:
    token = emitir_token(clave, sub=uuid4())

    respuesta = TestClient(app_con_verificador).get("/me", headers=autorizacion(token))

    assert respuesta.status_code == 403
    assert respuesta.json()["code"] == "usuario_no_registrado"


@pytest.mark.db
def test_un_usuario_inactivo_responde_403(
    app_con_db_transaccional: FastAPI, db_transaccional: Session, clave: ClaveEc
) -> None:
    db_transaccional.execute(
        text("UPDATE usuario SET activo = false WHERE id = :id"), {"id": ADMIN_1}
    )
    token = emitir_token(clave, sub=ADMIN_1)

    respuesta = TestClient(app_con_db_transaccional).get("/me", headers=autorizacion(token))

    assert respuesta.status_code == 403
    assert respuesta.json()["code"] == "usuario_inactivo"
