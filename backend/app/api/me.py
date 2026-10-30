from fastapi import APIRouter

from app.api.deps import ClaimsActuales, DbUsuario
from app.schemas.errores import ErrorResponse
from app.schemas.perfil import PerfilResponse
from app.services.perfil import obtener_perfil

router = APIRouter(tags=["usuario"])


@router.get(
    "/me",
    response_model=PerfilResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Falta el token, es inválido o venció"},
        403: {
            "model": ErrorResponse,
            "description": "El usuario no está registrado o está inactivo",
        },
    },
)
def me(db: DbUsuario, claims: ClaimsActuales) -> PerfilResponse:
    """Datos del usuario logueado y sus membresías. Usa el mismo token que ya tiene el front."""
    return obtener_perfil(db, claims.sub)
