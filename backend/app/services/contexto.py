from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import ErrorApi
from app.core.permisos import ContextoUsuario, MembresiaCtx
from app.repositories import usuario as repo


def leer_contexto(db: Session, usuario_id: UUID) -> ContextoUsuario | None:
    """Lee al usuario y sus membresías, sin juzgar si puede entrar. None si no tiene perfil.

    Existe aparte de `cargar_contexto` para poder evaluar las reglas de acceso de un usuario
    desactivado (los tests comparan cada regla con la función de Postgres en ese estado).
    """
    usuario = repo.obtener_usuario(db, usuario_id)
    if usuario is None:
        return None
    return ContextoUsuario(
        id=usuario.id,
        email=usuario.email,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        rol=usuario.rol,
        activo=usuario.activo,
        membresias=tuple(
            MembresiaCtx(m.sociedad_id, m.sociedad, m.rol, m.activa)
            for m in repo.listar_membresias(db, usuario.id)
        ),
    )


def cargar_contexto(db: Session, usuario_id: UUID) -> ContextoUsuario:
    """Arma el contexto del usuario del request. La sesión ya corre con su identidad (RLS aplica).

    Es el filtro previo a toda regla de acceso: sin perfil o con el usuario desactivado no se
    llega a evaluar ningún permiso.
    """
    contexto = leer_contexto(db, usuario_id)
    if contexto is None:
        # Token válido, pero el usuario no tiene perfil en la app (o RLS no se lo deja ver).
        raise ErrorApi(
            403, "usuario_no_registrado", "Tu usuario no está registrado en la aplicación."
        )
    if not contexto.activo:
        raise ErrorApi(403, "usuario_inactivo", "Tu usuario está desactivado.")
    return contexto
