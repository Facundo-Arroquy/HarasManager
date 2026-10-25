from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import ErrorApi
from app.repositories import usuario as repo
from app.schemas.perfil import MembresiaPerfil, PerfilResponse


def obtener_perfil(db: Session, usuario_id: UUID) -> PerfilResponse:
    """Perfil del usuario logueado. La sesión ya corre con su identidad (RLS aplica)."""
    usuario = repo.obtener_usuario(db, usuario_id)
    if usuario is None:
        # Token válido, pero el usuario no tiene perfil en la app (o RLS no se lo deja ver).
        raise ErrorApi(
            403, "usuario_no_registrado", "Tu usuario no está registrado en la aplicación."
        )
    if not usuario.activo:
        raise ErrorApi(403, "usuario_inactivo", "Tu usuario está desactivado.")

    return PerfilResponse(
        id=usuario.id,
        email=usuario.email,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        rol=usuario.rol,
        activo=usuario.activo,
        membresias=[MembresiaPerfil(**m._asdict()) for m in repo.listar_membresias(db, usuario.id)],
    )
