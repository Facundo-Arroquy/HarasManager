"""Dependencies de FastAPI compartidas por los routers: identidad, sesión y, luego, permisos."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rls import enlazar_contexto_rls
from app.core.security import Claims, get_claims

ClaimsActuales = Annotated[Claims, Depends(get_claims)]


def get_db_usuario(
    claims: ClaimsActuales,
    db: Annotated[Session, Depends(get_db)],
) -> Session:
    """Sesión que corre con la identidad del usuario del token: RLS aplica (modo A).

    Si el token es inválido no se llega a abrir ninguna conexión: `claims` se resuelve primero.
    """
    enlazar_contexto_rls(db, claims.raw)
    return db


DbUsuario = Annotated[Session, Depends(get_db_usuario)]
