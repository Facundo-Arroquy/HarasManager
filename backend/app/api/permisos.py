"""Autorización: una dependency `require_*` por cada función auxiliar de Postgres.

| Postgres                           | Dependency                       | Ámbito     |
|------------------------------------|----------------------------------|------------|
| (cualquier usuario activo)         | `require_usuario`                | usuario    |
| `is_superadmin()`                  | `require_superadmin`             | superadmin |
| `tiene_membresia(sociedad)`        | `require_membresia`              | sociedad   |
| `es_admin(sociedad)`               | `require_admin`                  | sociedad   |
| `es_veterinario(sociedad)`         | `require_veterinario`            | sociedad   |
| `puede_gestionar_campo(sociedad)`  | `require_gestion_campo`          | sociedad   |
| `puede_gestionar_ficha_caballo(…)` | `require_gestion_ficha_caballo`  | sociedad   |
| `vet_tiene_acceso(caballo)`        | `require_acceso_caballo`         | caballo    |

Cada una devuelve el `ContextoUsuario` o responde 403. Se usan como dependencies del endpoint:

    @router.get("/sociedades/{sociedad_id}/campos")
    def listar(
        sociedad_id: UUID,
        ctx: Annotated[ContextoUsuario, Depends(require_gestion_campo)],
    ) -> list[CampoResponse]: ...

**Todo endpoint tiene que declarar al menos una** (salvo los públicos de `RUTAS_PUBLICAS`):
`tests/test_auditoria_rutas.py` recorre las rutas de la app y falla si alguna no lo hace, o si
tiene `{sociedad_id}` o `{caballo_id}` y no lo resuelve una regla de ese ámbito. `usuario` quiere
decir "cualquier usuario activo: el filtro por sociedad lo hace RLS" y es una elección explícita,
no un olvido.

Las reglas que no coinciden con ninguna función de la base (por ejemplo "admin o superadmin")
se arman combinando estas en la dependency del endpoint, y se prueban en la matriz de permisos.
"""

from collections.abc import Callable
from typing import Annotated, Any, Literal, TypeVar
from uuid import UUID

from fastapi import Depends

from app.api.deps import ContextoActual, DbUsuario
from app.core.errors import ErrorApi
from app.core.permisos import (
    ContextoUsuario,
    es_admin,
    es_superadmin,
    es_veterinario,
    es_veterinario_activo,
    puede_gestionar_campo,
    puede_gestionar_ficha_caballo,
    tiene_membresia,
)
from app.repositories.permisos import vet_tiene_acceso_a_caballo

Ambito = Literal["usuario", "sociedad", "caballo", "superadmin"]

# Rutas que no piden token. Todo lo demás tiene que declarar una dependency `@permiso`.
RUTAS_PUBLICAS: frozenset[tuple[str, str]] = frozenset({("GET", "/health")})

# Qué ámbito resuelve cada dependency de autorización; lo lee el test que audita las rutas.
AMBITO_DE_PERMISO: dict[Callable[..., Any], Ambito] = {}

F = TypeVar("F", bound=Callable[..., Any])


def permiso(ambito: Ambito) -> Callable[[F], F]:
    """Marca una función como dependency de autorización de ese ámbito."""

    def marcar(funcion: F) -> F:
        AMBITO_DE_PERMISO[funcion] = ambito
        return funcion

    return marcar


def sin_permiso() -> ErrorApi:
    return ErrorApi(403, "sin_permiso", "No tenés permiso para realizar esta operación.")


@permiso("usuario")
def require_usuario(ctx: ContextoActual) -> ContextoUsuario:
    return ctx


@permiso("superadmin")
def require_superadmin(ctx: ContextoActual) -> ContextoUsuario:
    if not es_superadmin(ctx):
        raise sin_permiso()
    return ctx


@permiso("sociedad")
def require_membresia(sociedad_id: UUID, ctx: ContextoActual) -> ContextoUsuario:
    if not tiene_membresia(ctx, sociedad_id):
        raise sin_permiso()
    return ctx


@permiso("sociedad")
def require_admin(sociedad_id: UUID, ctx: ContextoActual) -> ContextoUsuario:
    if not es_admin(ctx, sociedad_id):
        raise sin_permiso()
    return ctx


@permiso("sociedad")
def require_veterinario(sociedad_id: UUID, ctx: ContextoActual) -> ContextoUsuario:
    if not es_veterinario(ctx, sociedad_id):
        raise sin_permiso()
    return ctx


@permiso("sociedad")
def require_gestion_campo(sociedad_id: UUID, ctx: ContextoActual) -> ContextoUsuario:
    if not puede_gestionar_campo(ctx, sociedad_id):
        raise sin_permiso()
    return ctx


@permiso("sociedad")
def require_gestion_ficha_caballo(sociedad_id: UUID, ctx: ContextoActual) -> ContextoUsuario:
    if not puede_gestionar_ficha_caballo(ctx, sociedad_id):
        raise sin_permiso()
    return ctx


@permiso("caballo")
def require_acceso_caballo(caballo_id: UUID, ctx: ContextoActual, db: DbUsuario) -> ContextoUsuario:
    """`vet_tiene_acceso(caballo_id)`: veterinario activo con acceso al caballo o a su sociedad.

    Los dos caminos del vet: por `acceso_vet` (caballo puntual) y por `acceso_vet_sociedad` (toda
    la sociedad). Es el que rompió `embrion_select` en julio de 2026 cuando una policy se olvidó
    del veterinario sin membresía. Un caballo que no existe da 403, igual que uno ajeno.
    """
    if not (es_veterinario_activo(ctx) and vet_tiene_acceso_a_caballo(db, ctx.id, caballo_id)):
        raise sin_permiso()
    return ctx


# Atajos para anotar los parámetros del endpoint
Usuario = Annotated[ContextoUsuario, Depends(require_usuario)]
Superadmin = Annotated[ContextoUsuario, Depends(require_superadmin)]
