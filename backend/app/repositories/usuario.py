from typing import NamedTuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sociedad import CatRol, Membresia, Sociedad
from app.models.usuario import Usuario


class MembresiaDetalle(NamedTuple):
    sociedad_id: UUID
    sociedad: str
    rol: str
    activa: bool


def obtener_usuario(db: Session, usuario_id: UUID) -> Usuario | None:
    return db.get(Usuario, usuario_id)


def listar_membresias(db: Session, usuario_id: UUID) -> list[MembresiaDetalle]:
    consulta = (
        select(Sociedad.id, Sociedad.nombre, CatRol.nombre, Membresia.activa)
        .select_from(Membresia)
        .join(Sociedad, Sociedad.id == Membresia.sociedad_id)
        .join(CatRol, CatRol.id == Membresia.rol_id)
        .where(Membresia.usuario_id == usuario_id)
        .order_by(Sociedad.nombre, CatRol.nombre)
    )
    return [MembresiaDetalle(*fila) for fila in db.execute(consulta)]
