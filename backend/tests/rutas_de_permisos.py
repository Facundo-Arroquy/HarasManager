"""Una ruta de prueba por cada dependency de autorización, para armar la matriz de permisos.

Solo existen en los tests. Cada una devuelve `{"ok": true}` si la regla deja pasar.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.permisos import (
    require_acceso_caballo,
    require_admin,
    require_gestion_campo,
    require_gestion_ficha_caballo,
    require_membresia,
    require_superadmin,
    require_usuario,
    require_veterinario,
)
from app.core.permisos import ContextoUsuario

router = APIRouter(prefix="/_t/p")

OK = {"ok": True}


@router.get("/usuario")
def usuario(_: Annotated[ContextoUsuario, Depends(require_usuario)]) -> dict[str, bool]:
    return OK


@router.get("/superadmin")
def superadmin(_: Annotated[ContextoUsuario, Depends(require_superadmin)]) -> dict[str, bool]:
    return OK


@router.get("/membresia/{sociedad_id}")
def membresia(
    sociedad_id: UUID, _: Annotated[ContextoUsuario, Depends(require_membresia)]
) -> dict[str, bool]:
    return OK


@router.get("/admin/{sociedad_id}")
def admin(
    sociedad_id: UUID, _: Annotated[ContextoUsuario, Depends(require_admin)]
) -> dict[str, bool]:
    return OK


@router.get("/veterinario/{sociedad_id}")
def veterinario(
    sociedad_id: UUID, _: Annotated[ContextoUsuario, Depends(require_veterinario)]
) -> dict[str, bool]:
    return OK


@router.get("/gestion-campo/{sociedad_id}")
def gestion_campo(
    sociedad_id: UUID, _: Annotated[ContextoUsuario, Depends(require_gestion_campo)]
) -> dict[str, bool]:
    return OK


@router.get("/gestion-ficha-caballo/{sociedad_id}")
def gestion_ficha_caballo(
    sociedad_id: UUID, _: Annotated[ContextoUsuario, Depends(require_gestion_ficha_caballo)]
) -> dict[str, bool]:
    return OK


@router.get("/acceso-caballo/{caballo_id}")
def acceso_caballo(
    caballo_id: UUID, _: Annotated[ContextoUsuario, Depends(require_acceso_caballo)]
) -> dict[str, bool]:
    return OK
