"""La matriz de permisos: qué puede tocar cada perfil y qué le responde 403.

Cada fila es un perfil del seed y cada columna una regla aplicada a un recurso concreto, a través
de una ruta de prueba real (token, contexto, dependency, respuesta). La tabla de abajo es la
especificación: si una regla cambia de comportamiento, este archivo es el que hay que leer.

Perfiles (supabase/seeds/README.md):
  superadmin             ve todo, sin membresía
  admin_1 / admin_2      administran Haras Demo 1 / Demo 2
  vet_1                  veterinario con membresía en Demo 1: caballos propios y los de Demo 1
  vet_independiente      veterinario SIN membresía: 4 caballos de Demo 1 y toda Demo 2
  jugador_1, piloto_1, peticero_1   un rol cada uno en Demo 1

Recursos: sociedades S1 (Demo 1) y S2 (Demo 2); caballos c01 y c04 (de S1; el independiente solo
tiene acceso a c01), c13 (de S2), c26 (propio de vet_1) y c32 (propio del independiente).
"""

from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests import rutas_de_permisos
from tests.constantes import (
    ADMIN_1,
    ADMIN_2,
    JUGADOR_1,
    PETICERO_1,
    PILOTO_1,
    SOCIEDAD_1,
    SOCIEDAD_2,
    SUPERADMIN,
    VET_1,
    VET_INDEPENDIENTE,
    caballo,
)
from tests.jwt_utils import ClaveEc, emitir_token

pytestmark = [pytest.mark.db, pytest.mark.usefixtures("base_local")]

# clave de la prueba → ruta
RUTAS = {
    "usuario": "/_t/p/usuario",
    "superadmin": "/_t/p/superadmin",
    **{f"{regla}:S{n}": f"/_t/p/{ruta}/{sociedad}"
       for regla, ruta in [
           ("membresia", "membresia"),
           ("admin", "admin"),
           ("veterinario", "veterinario"),
           ("campo", "gestion-campo"),
           ("ficha", "gestion-ficha-caballo"),
       ]
       for n, sociedad in [(1, SOCIEDAD_1), (2, SOCIEDAD_2)]},
    **{f"caballo:c{n:02d}": f"/_t/p/acceso-caballo/{caballo(n)}" for n in (1, 4, 13, 26, 32)},
}  # fmt: skip

# perfil → qué pruebas deja pasar. Todo lo que no está acá tiene que dar 403.
PERMITIDO: dict[str, tuple[UUID, set[str]]] = {
    "superadmin": (SUPERADMIN, {"usuario", "superadmin"}),
    "admin_1": (ADMIN_1, {"usuario", "membresia:S1", "admin:S1", "campo:S1", "ficha:S1"}),
    "admin_2": (ADMIN_2, {"usuario", "membresia:S2", "admin:S2", "campo:S2", "ficha:S2"}),
    "vet_1": (
        VET_1,
        {
            "usuario", "membresia:S1",
            "veterinario:S1", "veterinario:S2",  # quirk: el veterinario global lo es en cualquiera
            "caballo:c01", "caballo:c04", "caballo:c26",
        },
    ),
    "vet_independiente": (
        VET_INDEPENDIENTE,
        {
            "usuario",
            "veterinario:S1", "veterinario:S2",
            "caballo:c01",  # acceso por caballo
            "caballo:c13",  # acceso por toda la sociedad Demo 2
            "caballo:c32",  # propio
        },
    ),
    "jugador_1": (JUGADOR_1, {"usuario", "membresia:S1", "campo:S1"}),
    "piloto_1": (PILOTO_1, {"usuario", "membresia:S1", "campo:S1", "ficha:S1"}),
    "peticero_1": (PETICERO_1, {"usuario", "membresia:S1", "campo:S1"}),
}  # fmt: skip


@pytest.fixture
def cliente(app_con_verificador: FastAPI) -> TestClient:
    app_con_verificador.include_router(rutas_de_permisos.router)
    return TestClient(app_con_verificador)


def con_token(clave: ClaveEc, sub: UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {emitir_token(clave, sub=sub)}"}


@pytest.mark.parametrize("perfil", list(PERMITIDO))
def test_cada_perfil_toca_solo_lo_que_le_corresponde(
    cliente: TestClient, clave: ClaveEc, perfil: str
) -> None:
    sub, permitidas = PERMITIDO[perfil]
    obtenido = {
        prueba: cliente.get(ruta, headers=con_token(clave, sub)).status_code
        for prueba, ruta in RUTAS.items()
    }

    esperado = {prueba: 200 if prueba in permitidas else 403 for prueba in RUTAS}
    assert obtenido == esperado


def test_un_403_de_permisos_tiene_siempre_la_misma_forma(
    cliente: TestClient, clave: ClaveEc
) -> None:
    respuesta = cliente.get(RUTAS["admin:S2"], headers=con_token(clave, ADMIN_1))

    assert respuesta.status_code == 403
    assert respuesta.json() == {
        "code": "sin_permiso",
        "message": "No tenés permiso para realizar esta operación.",
    }


def test_un_caballo_que_no_existe_da_lo_mismo_que_uno_ajeno(
    cliente: TestClient, clave: ClaveEc
) -> None:
    """Si no, la respuesta le contaría al usuario qué ids existen."""
    inexistente = cliente.get(
        "/_t/p/acceso-caballo/ffffffff-ffff-4fff-8fff-ffffffffffff",
        headers=con_token(clave, VET_INDEPENDIENTE),
    )
    ajeno = cliente.get(RUTAS["caballo:c04"], headers=con_token(clave, VET_INDEPENDIENTE))

    assert (inexistente.status_code, inexistente.json()) == (ajeno.status_code, ajeno.json())


@pytest.mark.parametrize("ruta", list(RUTAS.values()))
def test_sin_token_ninguna_ruta_responde(cliente: TestClient, ruta: str) -> None:
    assert cliente.get(ruta).status_code == 401


@pytest.mark.parametrize("ruta", list(RUTAS.values()))
def test_un_token_valido_sin_perfil_no_pasa_ninguna_regla(
    cliente: TestClient, clave: ClaveEc, ruta: str
) -> None:
    desconocido = UUID("99999999-9999-4999-8999-999999999999")

    respuesta = cliente.get(ruta, headers=con_token(clave, desconocido))

    assert (respuesta.status_code, respuesta.json()["code"]) == (403, "usuario_no_registrado")
