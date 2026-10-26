"""Modo A: las consultas corren con la identidad del usuario y RLS sigue aplicando.

El backend se conecta a Postgres con un usuario con privilegios de administrador, que se
saltea RLS. Para que cada request vea solo lo que vería ese usuario, se hacen dos cosas
dentro de la transacción de la sesión:

  1. `role = authenticated`: pasa a ser el rol que usan las políticas RLS.
  2. `request.jwt.claims = <claims del token>`: de ahí lee `auth.uid()`.

Los dos valores son locales a la transacción. Si algún código hace `commit()` y arranca una
transacción nueva, el rol volvería a ser el administrador y RLS dejaría de aplicar sin
avisar: por eso se reaplican en cada comienzo de transacción, no una sola vez.
"""

import json
from collections.abc import Mapping
from typing import Any

from sqlalchemy import Connection, event, text
from sqlalchemy.orm import Session, SessionTransaction

ROL_POSTGRES = "authenticated"

_CLAVE_CLAIMS = "rls_claims_json"
_CLAVE_ESCUCHA = "rls_escucha_registrada"

_APLICAR_CONTEXTO = text(
    "SELECT set_config('role', :rol, true), set_config('request.jwt.claims', :claims, true)"
)


def _aplicar(conexion: Connection, claims_json: str) -> None:
    conexion.execute(_APLICAR_CONTEXTO, {"rol": ROL_POSTGRES, "claims": claims_json})


def _al_empezar(sesion: Session, _transaccion: SessionTransaction, conexion: Connection) -> None:
    claims_json = sesion.info.get(_CLAVE_CLAIMS)
    if claims_json is not None:
        _aplicar(conexion, claims_json)


def enlazar_contexto_rls(db: Session, claims: Mapping[str, Any]) -> None:
    """Deja la sesión corriendo como el usuario del token, ahora y en cada transacción nueva.

    Se puede volver a llamar con otros claims: queda un solo listener por sesión y gana el último.
    """
    claims_json = json.dumps(dict(claims))
    db.info[_CLAVE_CLAIMS] = claims_json
    if not db.info.get(_CLAVE_ESCUCHA):
        event.listen(db, "after_begin", _al_empezar)
        db.info[_CLAVE_ESCUCHA] = True

    if db.in_transaction():
        _aplicar(db.connection(), claims_json)  # la transacción ya había empezado
    else:
        db.connection()  # fuerza el comienzo ahora, antes de cualquier consulta
