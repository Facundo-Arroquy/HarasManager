from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Sociedad(Base):
    __tablename__ = "sociedad"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(200))
    activa: Mapped[bool] = mapped_column(Boolean)


class CatRol(Base):
    """Rol dentro de una sociedad: admin, veterinario, piloto, jugador o peticero."""

    __tablename__ = "cat_rol"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50))


class Membresia(Base):
    __tablename__ = "membresia"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    usuario_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("usuario.id"))
    sociedad_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("sociedad.id"))
    rol_id: Mapped[int] = mapped_column(Integer, ForeignKey("cat_rol.id"))
    activa: Mapped[bool] = mapped_column(Boolean)
