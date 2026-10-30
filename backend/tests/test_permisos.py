"""Los predicados de acceso, sobre contextos armados a mano (sin base)."""

from uuid import UUID, uuid4

import pytest

from app.core.permisos import (
    ContextoUsuario,
    MembresiaCtx,
    es_admin,
    es_superadmin,
    es_veterinario,
    es_veterinario_activo,
    puede_gestionar_campo,
    puede_gestionar_ficha_caballo,
    tiene_membresia,
)
from tests.constantes import SOCIEDAD_1, SOCIEDAD_2


def contexto(
    *membresias: tuple[UUID, str, bool], rol: str | None = None, activo: bool = True
) -> ContextoUsuario:
    return ContextoUsuario(
        id=uuid4(),
        email="x@haras.com",
        nombre="X",
        apellido="Y",
        rol=rol,
        activo=activo,
        membresias=tuple(MembresiaCtx(s, "Haras", r, a) for s, r, a in membresias),
    )


@pytest.mark.parametrize(
    ("regla", "roles_que_pasan"),
    [
        (tiene_membresia, {"admin", "veterinario", "piloto", "jugador", "peticero"}),
        (es_admin, {"admin"}),
        (puede_gestionar_campo, {"admin", "jugador", "piloto", "peticero"}),
        (puede_gestionar_ficha_caballo, {"admin", "piloto"}),
    ],
)
@pytest.mark.parametrize("rol", ["admin", "veterinario", "piloto", "jugador", "peticero"])
def test_cada_regla_deja_pasar_solo_a_sus_roles(
    regla: object, roles_que_pasan: set[str], rol: str
) -> None:
    ctx = contexto((SOCIEDAD_1, rol, True))

    assert regla(ctx, SOCIEDAD_1) is (rol in roles_que_pasan)  # type: ignore[operator]


@pytest.mark.parametrize(
    "regla",
    [tiene_membresia, es_admin, puede_gestionar_campo, puede_gestionar_ficha_caballo],
)
def test_la_membresia_de_otra_sociedad_no_cuenta(regla: object) -> None:
    ctx = contexto((SOCIEDAD_1, "admin", True))

    assert regla(ctx, SOCIEDAD_2) is False  # type: ignore[operator]


@pytest.mark.parametrize(
    "regla",
    [tiene_membresia, es_admin, puede_gestionar_campo, puede_gestionar_ficha_caballo],
)
def test_una_membresia_inactiva_no_cuenta(regla: object) -> None:
    ctx = contexto((SOCIEDAD_1, "admin", False))

    assert regla(ctx, SOCIEDAD_1) is False  # type: ignore[operator]


def test_un_usuario_con_varios_roles_en_la_misma_sociedad_suma_sus_permisos() -> None:
    ctx = contexto((SOCIEDAD_1, "jugador", True), (SOCIEDAD_1, "piloto", True))

    assert puede_gestionar_ficha_caballo(ctx, SOCIEDAD_1)
    assert not es_admin(ctx, SOCIEDAD_1)


def test_el_superadmin_sin_membresia_no_pasa_las_reglas_de_sociedad() -> None:
    """La base lo resuelve con `is_superadmin() OR ...`: cada endpoint lo combina a propósito."""
    ctx = contexto(rol="superadmin")

    assert es_superadmin(ctx)
    assert not tiene_membresia(ctx, SOCIEDAD_1)
    assert not es_admin(ctx, SOCIEDAD_1)


def test_es_superadmin_no_mira_si_esta_activo_igual_que_la_funcion_de_postgres() -> None:
    """SKILL.md dice lo contrario; manda la función que corre. El 403 por inactivo va antes."""
    assert es_superadmin(contexto(rol="superadmin", activo=False))


def test_el_veterinario_global_es_veterinario_en_cualquier_sociedad() -> None:
    """Quirk de `es_veterinario`: su segunda mitad (usuario.rol) no mira la sociedad."""
    ctx = contexto(rol="veterinario")

    assert es_veterinario(ctx, SOCIEDAD_1)
    assert es_veterinario(ctx, SOCIEDAD_2)


def test_el_veterinario_global_inactivo_ya_no_lo_es() -> None:
    assert not es_veterinario(contexto(rol="veterinario", activo=False), SOCIEDAD_1)
    assert not es_veterinario_activo(contexto(rol="veterinario", activo=False))


def test_el_veterinario_por_membresia_lo_es_solo_en_esa_sociedad() -> None:
    ctx = contexto((SOCIEDAD_1, "veterinario", True))

    assert es_veterinario(ctx, SOCIEDAD_1)
    assert not es_veterinario(ctx, SOCIEDAD_2)
    assert not es_veterinario_activo(ctx)  # usuario.rol no es 'veterinario'
