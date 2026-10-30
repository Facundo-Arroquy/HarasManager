"""El oráculo de permisos: cada regla de Python contra su función de Postgres, sobre todo el seed.

Es la defensa contra el riesgo número uno de tener las reglas escritas dos veces (en la base y en
el backend): que se desincronicen sin que nadie lo note. Para cada uno de los 12 usuarios del seed
y cada recurso (2 sociedades, 34 caballos) se evalúa la regla de `app/core/permisos.py` y la función
de Postgres que portó, esta última corriendo como ese usuario, y tienen que coincidir.

Después se repite sobre estados que el seed no tiene (membresía inactiva, acceso revocado, usuario
desactivado, veterinario que deja de serlo…): ahí es donde las dos implementaciones suelen
separarse.
"""

from collections.abc import Callable
from uuid import UUID

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import permisos
from app.core.permisos import ContextoUsuario
from app.repositories.permisos import vet_tiene_acceso_a_caballo
from app.services.contexto import leer_contexto
from tests.constantes import (
    ADMIN_1,
    CABALLOS,
    SOCIEDAD_1,
    SOCIEDADES,
    TODOS_LOS_USUARIOS,
    VET_1,
    VET_INDEPENDIENTE,
    caballo,
)
from tests.oraculo import como_usuario

pytestmark = [pytest.mark.db, pytest.mark.usefixtures("base_local")]

# (nombre de la regla, regla en Python, función de Postgres)
REGLAS_DE_SOCIEDAD: list[tuple[str, Callable[[ContextoUsuario, UUID], bool], str]] = [
    ("tiene_membresia", permisos.tiene_membresia, "tiene_membresia"),
    ("es_admin", permisos.es_admin, "es_admin"),
    ("es_veterinario", permisos.es_veterinario, "es_veterinario"),
    ("puede_gestionar_campo", permisos.puede_gestionar_campo, "puede_gestionar_campo"),
    ("ficha_caballo", permisos.puede_gestionar_ficha_caballo, "puede_gestionar_ficha_caballo"),
]  # fmt: skip


def en_postgres(sesion: Session, funcion: str, argumento: UUID | None = None) -> bool:
    if argumento is None:
        return bool(sesion.scalar(text(f"SELECT {funcion}()")))
    return bool(sesion.scalar(text(f"SELECT {funcion}(:a)"), {"a": argumento}))


def discrepancias(sesion: Session, usuario: UUID) -> list[str]:
    """Todas las reglas del usuario, contra Postgres. Devuelve lo que no coincide."""
    with como_usuario(sesion, usuario):
        ctx = leer_contexto(sesion, usuario)
        assert ctx is not None
        problemas: list[str] = []

        for nombre, python, funcion in REGLAS_DE_SOCIEDAD:
            for sociedad in SOCIEDADES:
                esperado = en_postgres(sesion, funcion, sociedad)
                obtenido = python(ctx, sociedad)
                if obtenido != esperado:
                    problemas.append(f"{nombre}({sociedad}): python={obtenido} postgres={esperado}")

        esperado = en_postgres(sesion, "is_superadmin")
        if permisos.es_superadmin(ctx) != esperado:
            problemas.append(
                f"is_superadmin(): python={permisos.es_superadmin(ctx)} postgres={esperado}"
            )

        for c in CABALLOS:
            esperado = en_postgres(sesion, "vet_tiene_acceso", c)
            obtenido = permisos.es_veterinario_activo(ctx) and vet_tiene_acceso_a_caballo(
                sesion, usuario, c
            )
            if obtenido != esperado:
                problemas.append(f"vet_tiene_acceso({c}): python={obtenido} postgres={esperado}")
        return problemas


@pytest.mark.parametrize("usuario", TODOS_LOS_USUARIOS, ids=lambda u: f"usuario-{str(u)[-2:]}")
def test_cada_regla_coincide_con_postgres_en_el_seed(
    db_transaccional: Session, usuario: UUID
) -> None:
    assert discrepancias(db_transaccional, usuario) == []


# Estados que el seed no tiene. Cada uno es una sentencia que se aplica como administrador.
ESTADOS: dict[str, str] = {
    "la membresía del admin pasa a inactiva":
        f"UPDATE membresia SET activa = false WHERE usuario_id = '{ADMIN_1}'",
    "se revoca el acceso del vet a un caballo":
        f"UPDATE acceso_vet SET activo = false "
        f"WHERE vet_id = '{VET_1}' AND caballo_id = '{caballo(1)}'",
    "se revoca el acceso por sociedad del vet independiente":
        f"UPDATE acceso_vet_sociedad SET activo = false WHERE vet_id = '{VET_INDEPENDIENTE}'",
    "el vet independiente deja de ser veterinario":
        f"UPDATE usuario SET rol = NULL WHERE id = '{VET_INDEPENDIENTE}'",
    "el vet con membresía se desactiva":
        f"UPDATE usuario SET activo = false WHERE id = '{VET_1}'",
    "el superadmin se desactiva":
        "UPDATE usuario SET activo = false WHERE rol = 'superadmin'",
    "se desactivan todas las membresías":
        "UPDATE membresia SET activa = false",
    "se revocan todos los accesos de veterinarios":
        "UPDATE acceso_vet SET activo = false; UPDATE acceso_vet_sociedad SET activo = false",
    "el vet independiente recibe acceso a Demo 1 completa":
        f"INSERT INTO acceso_vet_sociedad (vet_id, sociedad_id) "
        f"VALUES ('{VET_INDEPENDIENTE}', '{SOCIEDAD_1}')",
}  # fmt: skip


@pytest.mark.parametrize("descripcion", list(ESTADOS))
def test_las_reglas_siguen_coincidiendo_cuando_el_estado_cambia(
    db_transaccional: Session, descripcion: str
) -> None:
    for sentencia in ESTADOS[descripcion].split(";"):
        db_transaccional.execute(text(sentencia))

    problemas = [
        f"usuario {str(u)[-2:]}: {p}"
        for u in TODOS_LOS_USUARIOS
        for p in discrepancias(db_transaccional, u)
    ]

    assert problemas == [], descripcion
