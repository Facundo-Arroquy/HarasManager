"""Traducción de errores de Postgres: mismos códigos que ve hoy el front (HM001, HM002…)."""

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import DBAPIError, OperationalError

from app.core.errors import traducir_error_db
from tests import rutas_de_prueba
from tests.constantes import ADMIN_1
from tests.jwt_utils import ClaveEc, emitir_token


class OrigFalso(Exception):
    def __init__(self, sqlstate: str | None, mensaje: str) -> None:
        super().__init__(mensaje)
        self.sqlstate = sqlstate
        self.diag = SimpleNamespace(message_primary=mensaje)


# --- Unitarios: sin base -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("sqlstate", "status", "code"),
    [
        ("HM001", 402, "HM001"),
        ("HM002", 403, "HM002"),
        ("HM003", 422, "HM003"),
        ("HM409", 409, "HM409"),
        ("P0001", 400, "regla_de_negocio"),
        ("42501", 403, "42501"),
        ("23505", 409, "23505"),
        ("23503", 409, "23503"),
        ("23502", 422, "23502"),
        ("22P02", 422, "22P02"),
        ("22012", 500, "error_interno"),
        (None, 500, "error_interno"),
    ],
)
def test_traduce_cada_sqlstate(sqlstate: str | None, status: int, code: str) -> None:
    error = traducir_error_db(
        DBAPIError("SELECT 1", None, OrigFalso(sqlstate, "texto de Postgres"))
    )

    assert (error.status_code, error.code) == (status, code)


def test_los_codigos_de_negocio_conservan_el_mensaje_del_raise() -> None:
    mensaje = "Alcanzaste el límite de 5 caballos propios del plan gratuito."

    error = traducir_error_db(DBAPIError("SELECT 1", None, OrigFalso("HM001", mensaje)))

    assert error.message == mensaje


def test_los_errores_comunes_no_filtran_nombres_internos() -> None:
    interno = 'duplicate key value violates unique constraint "cat_raza_nombre_key"'

    error = traducir_error_db(DBAPIError("SELECT 1", None, OrigFalso("23505", interno)))

    assert "cat_raza" not in error.message


def test_un_corte_de_conexion_es_503() -> None:
    error = traducir_error_db(OperationalError("SELECT 1", None, OrigFalso(None, "se cayó")))

    assert (error.status_code, error.code) == (503, "base_no_disponible")


@pytest.mark.parametrize("sqlstate", ["08006", "53300", "57P01"])
def test_los_sqlstate_de_servicio_caido_son_503(sqlstate: str) -> None:
    error = traducir_error_db(OperationalError("SELECT 1", None, OrigFalso(sqlstate, "caída")))

    assert (error.status_code, error.code) == (503, "base_no_disponible")


def test_un_codigo_hm_no_se_confunde_con_una_caida_aunque_psycopg_lo_clasifique_asi() -> None:
    """Regresión: psycopg convierte HM… en `OperationalError`, igual que un corte de conexión."""
    error = traducir_error_db(OperationalError("SELECT 1", None, OrigFalso("HM001", "límite")))

    assert (error.status_code, error.code) == (402, "HM001")


# --- Con Postgres de verdad --------------------------------------------------------------


@pytest.fixture
def cliente(app_con_verificador: FastAPI) -> TestClient:
    app_con_verificador.include_router(rutas_de_prueba.router)
    return TestClient(app_con_verificador)


@pytest.mark.db
@pytest.mark.usefixtures("base_local")
@pytest.mark.parametrize(
    ("codigo", "status"), [("HM001", 402), ("HM002", 403), ("HM003", 422), ("HM409", 409)]
)
def test_los_cuatro_codigos_de_negocio_llegan_al_front_intactos(
    cliente: TestClient, codigo: str, status: int
) -> None:
    respuesta = cliente.get(f"/_t/error/{codigo}")

    assert respuesta.status_code == status
    assert respuesta.json() == {"code": codigo, "message": "Mensaje de prueba"}


@pytest.mark.db
@pytest.mark.usefixtures("base_local")
def test_un_raise_comun_es_una_regla_de_negocio(cliente: TestClient) -> None:
    respuesta = cliente.get("/_t/error/P0001")

    assert respuesta.status_code == 400
    assert respuesta.json() == {"code": "regla_de_negocio", "message": "Mensaje de prueba"}


@pytest.mark.db
@pytest.mark.usefixtures("base_local")
@pytest.mark.parametrize(
    ("caso", "status", "code"),
    [
        ("unico", 409, "23505"),
        ("referencia", 409, "23503"),
        ("obligatorio", 422, "23502"),
        ("formato", 422, "22P02"),
        ("desconocido", 500, "error_interno"),
    ],
)
def test_los_errores_de_postgres_se_traducen(
    cliente: TestClient, caso: str, status: int, code: str
) -> None:
    respuesta = cliente.get(f"/_t/pg/{caso}")

    assert respuesta.status_code == status
    assert respuesta.json()["code"] == code
    assert "division" not in respuesta.text and "cat_raza" not in respuesta.text


@pytest.mark.db
@pytest.mark.usefixtures("base_local")
def test_escribir_donde_rls_o_los_permisos_no_dejan_es_403(
    cliente: TestClient, clave: ClaveEc
) -> None:
    respuesta = cliente.get(
        "/_t/pg-permiso", headers={"Authorization": f"Bearer {emitir_token(clave, sub=ADMIN_1)}"}
    )

    assert respuesta.status_code == 403
    assert respuesta.json()["code"] == "42501"
