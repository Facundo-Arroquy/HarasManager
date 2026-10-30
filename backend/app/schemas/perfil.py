from uuid import UUID

from pydantic import BaseModel


class MembresiaPerfil(BaseModel):
    sociedad_id: UUID
    sociedad: str
    rol: str
    activa: bool


class PerfilResponse(BaseModel):
    id: UUID
    email: str
    nombre: str
    apellido: str
    # 'superadmin', 'admin', 'veterinario' o null
    rol: str | None
    activo: bool
    membresias: list[MembresiaPerfil]
