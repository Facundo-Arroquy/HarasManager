"""Dependencies de FastAPI compartidas por los routers: identidad y sesión.

Los permisos (`require_*`) están en `app/api/permisos.py`.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permisos import ContextoUsuario
from app.core.rls import enlazar_contexto_rls
from app.core.security import Claims, get_claims
from app.services.contexto import cargar_contexto

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


def get_contexto(claims: ClaimsActuales, db: DbUsuario) -> ContextoUsuario:
    """Quién es el usuario y a qué pertenece. 403 si no tiene perfil o está desactivado."""
    return cargar_contexto(db, claims.sub)


ContextoActual = Annotated[ContextoUsuario, Depends(get_contexto)]
