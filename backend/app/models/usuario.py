from uuid import UUID

from sqlalchemy import Boolean, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Usuario(Base):
    """Perfil de la app. El `id` es el mismo que el de `auth.users` (el `sub` del JWT)."""

    __tablename__ = "usuario"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    apellido: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean)
    # 'superadmin', 'admin', 'veterinario' o NULL (jugador, peticero y piloto viven en la membresía)
    rol: Mapped[str | None] = mapped_column(String, nullable=True)
