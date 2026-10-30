"""Rutas que solo existen en los tests: dejan ver qué pasa adentro de Postgres.

No forman parte de la API; los tests las montan en una app aparte.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import DbUsuario
from app.core.database import get_db

router = APIRouter(prefix="/_t")

SinRls = Annotated[Session, Depends(get_db)]


def _identidad(db: Session) -> dict[str, str | None]:
    fila = db.execute(text("SELECT current_user, auth.uid()::text")).one()
    return {"rol": fila[0], "uid": fila[1]}


def _caballos(db: Session) -> int:
    return int(db.execute(text("SELECT count(*) FROM caballo")).scalar_one())


@router.get("/identidad")
def identidad(db: DbUsuario) -> dict[str, str | None]:
    return _identidad(db)


@router.get("/identidad-sin-rls")
def identidad_sin_rls(db: SinRls) -> dict[str, str | None]:
    return _identidad(db)


@router.get("/caballos")
def caballos(db: DbUsuario) -> dict[str, int]:
    return {"caballos": _caballos(db)}


@router.get("/caballos-sin-rls")
def caballos_sin_rls(db: SinRls) -> dict[str, int]:
    return {"caballos": _caballos(db)}


@router.get("/commit")
def despues_de_un_commit(db: DbUsuario) -> dict[str, str | int | None]:
    """Un commit cierra la transacción: la siguiente tiene que seguir corriendo como el usuario."""
    db.commit()
    return {**_identidad(db), "caballos": _caballos(db)}


@router.get("/error/{sqlstate}")
def error_con_codigo(sqlstate: Annotated[str, Path(pattern=r"^[A-Z0-9]{5}$")], db: SinRls) -> None:
    db.execute(
        text(
            f"DO $$ BEGIN RAISE EXCEPTION 'Mensaje de prueba' USING ERRCODE = '{sqlstate}'; END $$"
        )
    )


CASOS_POSTGRES = {
    "unico": "INSERT INTO cat_raza (nombre) VALUES ('Criollo')",
    "referencia": (
        "INSERT INTO membresia (usuario_id, sociedad_id, rol_id) "
        "VALUES (gen_random_uuid(), gen_random_uuid(), 1)"
    ),
    "obligatorio": "INSERT INTO cat_raza (nombre) VALUES (NULL)",
    "formato": "SELECT 'no-es-un-uuid'::uuid",
    "desconocido": "SELECT 1/0",
}


@router.get("/pg/{caso}")
def error_de_postgres(
    caso: Literal["unico", "referencia", "obligatorio", "formato", "desconocido"], db: SinRls
) -> None:
    db.execute(text(CASOS_POSTGRES[caso]))


@router.get("/pg-permiso")
def error_de_permiso(db: DbUsuario) -> None:
    """Como `authenticated`, los catálogos son de solo lectura."""
    db.execute(text("INSERT INTO cat_raza (nombre) VALUES ('Raza inventada')"))
