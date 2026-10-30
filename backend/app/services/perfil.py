from app.core.permisos import ContextoUsuario
from app.schemas.perfil import MembresiaPerfil, PerfilResponse


def perfil_desde_contexto(ctx: ContextoUsuario) -> PerfilResponse:
    """Perfil del usuario logueado, a partir del contexto que ya se cargó para el request."""
    return PerfilResponse(
        id=ctx.id,
        email=ctx.email,
        nombre=ctx.nombre,
        apellido=ctx.apellido,
        rol=ctx.rol,
        activo=ctx.activo,
        membresias=[
            MembresiaPerfil(
                sociedad_id=m.sociedad_id, sociedad=m.sociedad, rol=m.rol, activa=m.activa
            )
            for m in ctx.membresias
        ],
    )
