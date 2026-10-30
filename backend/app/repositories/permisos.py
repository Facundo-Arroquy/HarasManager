from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.acceso import AccesoVet, AccesoVetSociedad, Caballo


def vet_tiene_acceso_a_caballo(db: Session, vet_id: UUID, caballo_id: UUID) -> bool:
    """Segunda condición de `vet_tiene_acceso`: acceso al caballo o a toda su sociedad.

    La primera (que el usuario sea veterinario activo) se resuelve con el contexto, sin consulta.
    Un caballo que no existe, o que RLS no deja ver, da False: el que pregunta no se entera.
    """
    por_caballo = (
        select(AccesoVet.id)
        .where(
            AccesoVet.vet_id == vet_id,
            AccesoVet.caballo_id == caballo_id,
            AccesoVet.activo.is_(True),
        )
        .exists()
    )
    por_sociedad = (
        select(AccesoVetSociedad.id)
        .join(Caballo, Caballo.sociedad_id == AccesoVetSociedad.sociedad_id)
        .where(
            AccesoVetSociedad.vet_id == vet_id,
            AccesoVetSociedad.activo.is_(True),
            Caballo.id == caballo_id,
        )
        .exists()
    )
    return bool(db.scalar(select(or_(por_caballo, por_sociedad))))
