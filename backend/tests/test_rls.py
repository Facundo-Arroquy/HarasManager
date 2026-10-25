"""Modo A: el backend corre cada request con la identidad del usuario y RLS aplica."""

from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests import rutas_de_prueba
from tests.constantes import ADMIN_1, CABALLOS_VISIBLES
from tests.jwt_utils import ClaveEc, emitir_token

pytestmark = [pytest.mark.db, pytest.mark.usefixtures("base_local")]


@pytest.fixture
def app_de_prueba(app_con_verificador: FastAPI) -> FastAPI:
    app_con_verificador.include_router(rutas_de_prueba.router)
    return app_con_verificador


def con_token(clave: ClaveEc, sub: UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {emitir_token(clave, sub=sub)}"}


@pytest.mark.parametrize(("sub", "esperados"), list(CABALLOS_VISIBLES.items()))
def test_cada_usuario_ve_solo_los_caballos_que_le_corresponden(
    app_de_prueba: FastAPI, clave: ClaveEc, sub: UUID, esperados: int
) -> None:
    cliente = TestClient(app_de_prueba)

    respuesta = cliente.get("/_t/caballos", headers=con_token(clave, sub))

    assert respuesta.json() == {"caballos": esperados}


def test_la_sesion_corre_como_authenticated_con_el_uid_del_token(
    app_de_prueba: FastAPI, clave: ClaveEc
) -> None:
    respuesta = TestClient(app_de_prueba).get("/_t/identidad", headers=con_token(clave, ADMIN_1))

    assert respuesta.json() == {"rol": "authenticated", "uid": str(ADMIN_1)}


def test_sin_el_contexto_se_ve_todo_lo_que_prueba_que_hace_falta(app_de_prueba: FastAPI) -> None:
    """La conexión del backend es de administrador y se saltea RLS: por eso el contexto importa."""
    cliente = TestClient(app_de_prueba)

    assert cliente.get("/_t/caballos-sin-rls").json() == {"caballos": 34}
    assert cliente.get("/_t/identidad-sin-rls").json() == {"rol": "postgres", "uid": None}


def test_el_contexto_no_se_filtra_al_request_siguiente(
    app_de_prueba: FastAPI, clave: ClaveEc
) -> None:
    """El pool reutiliza conexiones: lo que se fija para un usuario no puede quedarse pegado."""
    cliente = TestClient(app_de_prueba)

    for _ in range(3):
        cliente.get("/_t/caballos", headers=con_token(clave, ADMIN_1))
        assert cliente.get("/_t/identidad-sin-rls").json() == {"rol": "postgres", "uid": None}


def test_despues_de_un_commit_rls_sigue_aplicando(app_de_prueba: FastAPI, clave: ClaveEc) -> None:
    """Sin reaplicar el contexto, la transacción nueva correría como administrador (vería 34)."""
    respuesta = TestClient(app_de_prueba).get("/_t/commit", headers=con_token(clave, ADMIN_1))

    assert respuesta.json() == {"rol": "authenticated", "uid": str(ADMIN_1), "caballos": 12}
