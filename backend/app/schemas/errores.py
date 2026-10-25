from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Forma de todos los errores de la API (la misma que los de Supabase: `code` y `message`)."""

    code: str
    message: str
