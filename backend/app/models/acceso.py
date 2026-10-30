from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Caballo(Base):
    """Modelo parcial: por ahora solo lo que hace falta para resolver permisos."""

    __tablename__ = "caballo"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    # NULL en los caballos propios de un veterinario (no pertenecen a una sociedad)
    sociedad_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("sociedad.id"), nullable=True)


class AccesoVet(Base):
    """Acceso de un veterinario a un caballo puntual."""

    __tablename__ = "acceso_vet"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    vet_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("usuario.id"))
    caballo_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("caballo.id"))
    activo: Mapped[bool] = mapped_column(Boolean)


class AccesoVetSociedad(Base):
    """Acceso de un veterinario a todos los caballos de una sociedad."""

    __tablename__ = "acceso_vet_sociedad"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    vet_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("usuario.id"))
    sociedad_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("sociedad.id"))
    activo: Mapped[bool] = mapped_column(Boolean)
