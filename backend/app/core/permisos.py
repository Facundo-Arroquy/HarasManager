"""Reglas de acceso de HarasManager, portadas de las funciones auxiliares de Postgres.

Cada predicado tiene el mismo nombre y la misma lógica que su función en la base
(`tiene_membresia`, `es_admin`, `es_veterinario`, `is_superadmin`, `puede_gestionar_campo`,
`puede_gestionar_ficha_caballo`). Son funciones puras sobre un `ContextoUsuario` que se carga
una sola vez por request; la única que necesita la base es `vet_tiene_acceso`
(ver `repositories/permisos.py`).

Las políticas RLS siguen aplicando (modo A): esto es la segunda red, y la que devuelve un 403
claro en vez de una lista vacía. Para que las dos no se desincronicen, los tests comparan cada
predicado contra su función de Postgres sobre todo el seed (`tests/test_oraculo_permisos.py`).

Ojo: una función de Postgres puede decir algo distinto de lo que dice `docs/SKILL.md`. Mandan
las funciones de la base (son las que corren). Ver la nota de `es_superadmin`.
"""

from dataclasses import dataclass
from uuid import UUID

ROL_ADMIN = "admin"
ROL_VETERINARIO = "veterinario"
ROL_SUPERADMIN = "superadmin"


@dataclass(frozen=True)
class MembresiaCtx:
    sociedad_id: UUID
    sociedad: str
    rol: str  # nombre en cat_rol: admin, veterinario, piloto, jugador o peticero
    activa: bool


@dataclass(frozen=True)
class ContextoUsuario:
    """Quién es el usuario del request y a qué pertenece. Es lo único que miran los predicados."""

    id: UUID
    email: str
    nombre: str
    apellido: str
    rol: str | None  # usuario.rol: superadmin, admin, veterinario o None (jugador, piloto…)
    activo: bool
    # Todas, activas o no: las inactivas las filtra cada regla.
    membresias: tuple[MembresiaCtx, ...]

    def roles_activos_en(self, sociedad_id: UUID) -> set[str]:
        return {m.rol for m in self.membresias if m.activa and m.sociedad_id == sociedad_id}


def es_superadmin(ctx: ContextoUsuario) -> bool:
    """`is_superadmin()`.

    La función de Postgres solo mira `usuario.rol = 'superadmin'`, aunque SKILL.md dice que
    también exige `activo`. Se porta tal cual. No es un hueco acá: un usuario inactivo ya queda
    afuera con un 403 antes de llegar a ninguna regla (`services/contexto.py`).
    """
    return ctx.rol == ROL_SUPERADMIN


def tiene_membresia(ctx: ContextoUsuario, sociedad_id: UUID) -> bool:
    """`tiene_membresia(sociedad_id)`: membresía activa, con cualquier rol.

    Un superadmin sin membresía da False: la base lo resuelve con `is_superadmin() OR ...`.
    """
    return bool(ctx.roles_activos_en(sociedad_id))


def es_admin(ctx: ContextoUsuario, sociedad_id: UUID) -> bool:
    """`es_admin(sociedad_id)`: membresía activa con rol admin."""
    return ROL_ADMIN in ctx.roles_activos_en(sociedad_id)


def es_veterinario(ctx: ContextoUsuario, sociedad_id: UUID) -> bool:
    """`es_veterinario(sociedad_id)`: veterinario en esa sociedad **o** veterinario global.

    La segunda mitad (`usuario.rol = 'veterinario'`) no mira la sociedad: un veterinario
    independiente da True para cualquier sociedad. Es lo que hace la función de la base.
    """
    return ROL_VETERINARIO in ctx.roles_activos_en(sociedad_id) or (
        ctx.rol == ROL_VETERINARIO and ctx.activo
    )


def puede_gestionar_campo(ctx: ContextoUsuario, sociedad_id: UUID) -> bool:
    """`puede_gestionar_campo(sociedad_id)`: admin, jugador, piloto o peticero activos."""
    return bool(ctx.roles_activos_en(sociedad_id) & {"admin", "jugador", "piloto", "peticero"})


def puede_gestionar_ficha_caballo(ctx: ContextoUsuario, sociedad_id: UUID) -> bool:
    """`puede_gestionar_ficha_caballo(sociedad_id)`: admin o piloto activos."""
    return bool(ctx.roles_activos_en(sociedad_id) & {"admin", "piloto"})


def es_veterinario_activo(ctx: ContextoUsuario) -> bool:
    """Primera condición de `vet_tiene_acceso`: usuario.rol = 'veterinario' y activo."""
    return ctx.rol == ROL_VETERINARIO and ctx.activo
