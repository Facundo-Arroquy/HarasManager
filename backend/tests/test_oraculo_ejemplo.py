"""Ejemplo documentado del oráculo: así se compara una función de Postgres con su endpoint.

Es la plantilla para las fases de dominio (F7 en adelante). Para cada operación que se migra:

    1. Escribir el endpoint nuevo.
    2. Escribir, en los tests del dominio, un `comparar(...)` por cada caso: el camino feliz, cada
       rechazo y cada regla de negocio de la función original.
    3. Si la comparación da distinto, `diferencias` dice en qué.

Acá se usa `set_sociedad_modulo(sociedad, codigo, habilitado)`, una función real de producción:
el superadmin habilita o deshabilita un módulo para una sociedad. Es `SECURITY INVOKER`: la que
autoriza es RLS (solo el superadmin escribe en `sociedad_modulo`). El endpoint de abajo es de
juguete: existe solo en este archivo, para mostrar el oráculo funcionando. El real llega en la F7.

Cosas a notar:
  - La función vieja rechaza con un error de Postgres y la nueva con un 403: `normalizar_*` los
    llevan a la misma palabra ("denegado"). Lo que importa es que coincidan en QUÉ se rechaza.
  - `estado` lee toda la tabla, así también se detecta un efecto colateral.
  - Cada corrida se deshace: el seed queda intacto y las dos parten del mismo estado.
"""

from typing import Annotated, Any
from uuid import UUID

import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient
from httpx2 import Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import DbUsuario
from app.api.permisos import require_superadmin
from app.core.permisos import ContextoUsuario
from tests.constantes import ADMIN_1, SOCIEDAD_1, SUPERADMIN
from tests.jwt_utils import ClaveEc, emitir_token
from tests.oraculo import Comparacion, comparar

pytestmark = [pytest.mark.db, pytest.mark.usefixtures("base_local")]

router = APIRouter(prefix="/_t/ejemplo")


class CuerpoModulo(BaseModel):
    habilitado: bool


@router.put("/sociedades/{sociedad_id}/modulos/{codigo}", status_code=204)
def fijar_modulo(
    sociedad_id: UUID,
    codigo: str,
    cuerpo: CuerpoModulo,
    _: Annotated[ContextoUsuario, Depends(require_superadmin)],
    db: DbUsuario,
) -> None:
    """Versión correcta: hace lo mismo que `set_sociedad_modulo`."""
    db.execute(
        text(
            "INSERT INTO sociedad_modulo (sociedad_id, modulo_id, habilitado) "
            "SELECT :sociedad, id, :habilitado FROM cat_modulo WHERE codigo = :codigo "
            "ON CONFLICT (sociedad_id, modulo_id) DO UPDATE SET habilitado = EXCLUDED.habilitado"
        ),
        {"sociedad": sociedad_id, "codigo": codigo, "habilitado": cuerpo.habilitado},
    )


@router.put("/incompleto/sociedades/{sociedad_id}/modulos/{codigo}", status_code=204)
def fijar_modulo_incompleto(
    sociedad_id: UUID,
    codigo: str,
    cuerpo: CuerpoModulo,
    _: Annotated[ContextoUsuario, Depends(require_superadmin)],
    db: DbUsuario,
) -> None:
    """Versión con un olvido: si el módulo ya estaba cargado, no lo actualiza (DO NOTHING)."""
    db.execute(
        text(
            "INSERT INTO sociedad_modulo (sociedad_id, modulo_id, habilitado) "
            "SELECT :sociedad, id, :habilitado FROM cat_modulo WHERE codigo = :codigo "
            "ON CONFLICT (sociedad_id, modulo_id) DO NOTHING"
        ),
        {"sociedad": sociedad_id, "codigo": codigo, "habilitado": cuerpo.habilitado},
    )


def estado_de_los_modulos(sesion: Session) -> list[tuple[str, int, bool]]:
    filas = sesion.execute(
        text(
            "SELECT sociedad_id::text, modulo_id, habilitado FROM sociedad_modulo "
            "ORDER BY sociedad_id, modulo_id"
        )
    )
    return [(f[0], f[1], f[2]) for f in filas]


def normalizar_vieja(salida: Any) -> str:
    return "denegado" if isinstance(salida, BaseException) else "ok"


def normalizar_nueva(salida: Any) -> str:
    if isinstance(salida, Response):
        if salida.status_code == 204:
            return "ok"
        return "denegado" if salida.status_code == 403 else f"inesperado {salida.status_code}"
    return "inesperado"


@pytest.fixture
def app_de_ejemplo(app_con_db_transaccional: FastAPI) -> FastAPI:
    app_con_db_transaccional.include_router(router)
    return app_con_db_transaccional


def comparar_modulo(
    app: FastAPI,
    sesion: Session,
    clave: ClaveEc,
    *,
    usuario: UUID,
    habilitado: bool,
    version_incompleta: bool = False,
) -> Comparacion:
    cliente = TestClient(app)
    prefijo = "/_t/ejemplo/incompleto" if version_incompleta else "/_t/ejemplo"
    ruta = f"{prefijo}/sociedades/{SOCIEDAD_1}/modulos/centro_cria"
    token = {"Authorization": f"Bearer {emitir_token(clave, sub=usuario)}"}
    return comparar(
        sesion,
        usuario=usuario,
        vieja=lambda s: s.execute(
            text("SELECT set_sociedad_modulo(:sociedad, 'centro_cria', :habilitado)"),
            {"sociedad": SOCIEDAD_1, "habilitado": habilitado},
        ),
        nueva=lambda: cliente.put(ruta, json={"habilitado": habilitado}, headers=token),
        estado=estado_de_los_modulos,
        normalizar_vieja=normalizar_vieja,
        normalizar_nueva=normalizar_nueva,
    )


def habilitado_en(estado: list[tuple[str, int, bool]], sociedad: UUID, modulo: int = 1) -> bool:
    return {(s, m): h for s, m, h in estado}[(str(sociedad), modulo)]


def test_el_superadmin_deshabilita_un_modulo_igual_por_las_dos_vias(
    app_de_ejemplo: FastAPI, db_transaccional: Session, clave: ClaveEc
) -> None:
    resultado = comparar_modulo(
        app_de_ejemplo, db_transaccional, clave, usuario=SUPERADMIN, habilitado=False
    )

    assert resultado.iguales, resultado.diferencias
    assert resultado.vieja.resultado == "ok"
    # y de verdad cambió algo: el seed lo tiene habilitado
    assert habilitado_en(resultado.nueva.estado, SOCIEDAD_1) is False


def test_un_admin_es_rechazado_igual_por_las_dos_vias(
    app_de_ejemplo: FastAPI, db_transaccional: Session, clave: ClaveEc
) -> None:
    """La vieja lo rechaza RLS (solo el superadmin escribe); la nueva, `require_superadmin`."""
    resultado = comparar_modulo(
        app_de_ejemplo, db_transaccional, clave, usuario=ADMIN_1, habilitado=False
    )

    assert resultado.iguales, resultado.diferencias
    assert resultado.vieja.resultado == "denegado"
    assert habilitado_en(resultado.nueva.estado, SOCIEDAD_1) is True  # nada cambió


def test_el_oraculo_detecta_un_endpoint_que_olvida_actualizar(
    app_de_ejemplo: FastAPI, db_transaccional: Session, clave: ClaveEc
) -> None:
    """Las dos responden "ok", pero la nueva no actualiza lo que ya existía: el estado difiere."""
    resultado = comparar_modulo(
        app_de_ejemplo,
        db_transaccional,
        clave,
        usuario=SUPERADMIN,
        habilitado=False,
        version_incompleta=True,
    )

    assert not resultado.iguales
    assert resultado.vieja.resultado == resultado.nueva.resultado == "ok"
    assert any(d.startswith("estado") for d in resultado.diferencias)
