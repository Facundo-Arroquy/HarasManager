from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.schemas.health import HealthResponse

router = APIRouter(tags=["salud"])


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse, "description": "La base no responde"}},
)
def health(response: Response, db: Annotated[Session, Depends(get_db)]) -> HealthResponse:
    """Estado del servicio y de su conexión a la base. Es público: no devuelve datos."""
    environment = get_settings().environment
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="degraded", database="error", environment=environment)
    return HealthResponse(status="ok", database="ok", environment=environment)
