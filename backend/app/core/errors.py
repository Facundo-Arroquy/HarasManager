"""Errores de la API con un formato estable: `{"code": "...", "message": "..."}`.

El front ya trabaja con ese formato (el de los errores de Supabase): `utils/error.ts` decide
por `code` (HM001, HM002…) y muestra `message`. Mantenerlo permite pasar un dominio de
Supabase a la API sin tocar cómo se manejan los errores en las pantallas.
"""

import logging
from collections.abc import Mapping

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError

logger = logging.getLogger(__name__)


class ErrorApi(Exception):
    """Error de negocio o de autorización que la API devuelve tal cual."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = dict(headers) if headers else None


# Códigos propios de HarasManager que las funciones de Postgres levantan con
# `RAISE EXCEPTION ... USING ERRCODE`. Se conservan tal cual: el front los usa.
#   HM001  tope del plan gratuito de caballos propios → ofrecer el checkout
#   HM002  tope de la membresía paga                  → mandar a soporte
#   HM003  falta un dato obligatorio al registrarse    → corregir el formulario
#   HM409  la baja está bloqueada por datos que dependen → ver el detalle
# Para estos, el mensaje del RAISE es texto escrito a propósito para el usuario.
CODIGOS_HM: dict[str, int] = {
    "HM001": 402,
    "HM002": 403,
    "HM003": 422,
    "HM409": 409,
}

# SQLSTATE estándar de Postgres → (status HTTP, mensaje). No se devuelve el texto de Postgres:
# trae nombres de tablas, columnas y constraints.
ERRORES_POSTGRES: dict[str, tuple[int, str]] = {
    "42501": (403, "No tenés permiso para realizar esta operación."),
    "23505": (409, "Ya existe un registro igual."),
    "23503": (
        409,
        "El registro está referenciado por otros datos o referencia algo que no existe.",
    ),
    "23502": (422, "Falta un dato obligatorio."),
    "23514": (422, "Un dato no cumple las condiciones permitidas."),
    "22P02": (422, "Un dato tiene un formato inválido."),
}

# Clases de SQLSTATE que significan "la base no puede atender ahora": error de conexión (08),
# recursos insuficientes (53) e intervención del operador, como un reinicio (57).
CLASES_SIN_SERVICIO = {"08", "53", "57"}


def traducir_error_db(exc: DBAPIError) -> ErrorApi:
    """Convierte un error de Postgres en el error HTTP que corresponde.

    Se decide por el SQLSTATE y no por la clase de la excepción: psycopg clasifica los códigos
    HM… (que no existen en el estándar) como `OperationalError`, la misma clase que una caída
    de la conexión, y mirar la clase mandaba un HM001 a "base no disponible".
    """
    original = exc.orig
    sqlstate: str | None = getattr(original, "sqlstate", None)
    diag = getattr(original, "diag", None)
    mensaje: str = getattr(diag, "message_primary", None) or str(original)

    if sqlstate in CODIGOS_HM:
        return ErrorApi(CODIGOS_HM[sqlstate], sqlstate, mensaje)
    if sqlstate == "P0001":  # RAISE EXCEPTION sin código propio: regla de negocio con mensaje
        return ErrorApi(400, "regla_de_negocio", mensaje)
    if sqlstate in ERRORES_POSTGRES:
        estado, texto = ERRORES_POSTGRES[sqlstate]
        return ErrorApi(estado, sqlstate, texto)

    if sqlstate is None and isinstance(exc, OperationalError | InterfaceError):
        # Sin SQLSTATE no hay respuesta de Postgres: la conexión misma falló.
        return ErrorApi(503, "base_no_disponible", "La base de datos no está disponible.")
    if sqlstate is not None and sqlstate[:2] in CLASES_SIN_SERVICIO:
        return ErrorApi(503, "base_no_disponible", "La base de datos no está disponible.")

    logger.error("Error de base de datos sin traducción (sqlstate=%s): %s", sqlstate, mensaje)
    return ErrorApi(500, "error_interno", "Ocurrió un error inesperado.")


def _respuesta(error: ErrorApi) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"code": error.code, "message": error.message},
        headers=error.headers,
    )


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(ErrorApi)
    async def _manejar_error_api(_: Request, exc: ErrorApi) -> JSONResponse:
        return _respuesta(exc)

    @app.exception_handler(DBAPIError)
    async def _manejar_error_db(_: Request, exc: DBAPIError) -> JSONResponse:
        return _respuesta(traducir_error_db(exc))
