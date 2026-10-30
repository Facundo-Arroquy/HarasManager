"""Validación del JWT que emite Supabase Auth.

El login, el registro y el reseteo de contraseña siguen siendo de Supabase: el front se
autentica contra él igual que hoy. Acá solo se **valida** el token que ya tiene.

Supabase firma con claves asimétricas (ES256) y publica la clave pública en un endpoint
JWKS; los proyectos viejos firman con un secreto compartido (HS256). Se aceptan los dos,
cada uno solo con su propia clave: nunca se usa una clave pública como secreto simétrico
(el ataque clásico de confusión de algoritmos) y se rechaza `alg: none`.
"""

from functools import lru_cache
from typing import Annotated, Any, Protocol
from uuid import UUID

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientConnectionError
from pydantic import BaseModel, ConfigDict

from app.core.config import get_settings
from app.core.errors import ErrorApi

ALGORITMOS_ASIMETRICOS = ("ES256", "RS256", "EdDSA")
ENCABEZADO_BEARER = {"WWW-Authenticate": "Bearer"}


class TokenInvalido(Exception):
    """El token no se puede aceptar (malformado, firma mala, vencido, de otro proyecto…)."""

    def __init__(self, mensaje: str, *, vencido: bool = False) -> None:
        super().__init__(mensaje)
        self.vencido = vencido


class ValidacionNoDisponible(Exception):
    """No se pudo consultar a Supabase por sus claves: no es culpa del token."""


class Claims(BaseModel):
    """Lo que el backend usa del token. `raw` son los claims completos, tal cual vinieron."""

    model_config = ConfigDict(frozen=True)

    sub: UUID
    role: str
    email: str | None = None
    raw: dict[str, Any]


class ClienteJwks(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> Any: ...


class VerificadorJwt:
    def __init__(
        self,
        *,
        issuer: str,
        audience: str,
        jwks: ClienteJwks | None = None,
        secreto: str | None = None,
    ) -> None:
        self._issuer = issuer
        self._audience = audience
        self._jwks = jwks
        self._secreto = secreto

    def verificar(self, token: str) -> Claims:
        try:
            clave, algoritmo = self._clave_para(token)
            datos = jwt.decode(
                token,
                clave,
                algorithms=[algoritmo],
                audience=self._audience,
                issuer=self._issuer,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise TokenInvalido("El token venció.", vencido=True) from exc
        except PyJWKClientConnectionError as exc:
            raise ValidacionNoDisponible(str(exc)) from exc
        except jwt.PyJWTError as exc:
            raise TokenInvalido("El token no es válido.") from exc

        if datos.get("role") != "authenticated":
            # El token anónimo (la anon key) es válido para Supabase pero no es un usuario.
            raise TokenInvalido("El token no corresponde a un usuario autenticado.")
        try:
            return Claims(sub=datos["sub"], role=datos["role"], email=datos.get("email"), raw=datos)
        except ValueError as exc:  # `sub` que no es un UUID
            raise TokenInvalido("El token no es válido.") from exc

    def _clave_para(self, token: str) -> tuple[Any, str]:
        algoritmo = jwt.get_unverified_header(token).get("alg")
        if algoritmo == "HS256" and self._secreto:
            return self._secreto, "HS256"
        if algoritmo in ALGORITMOS_ASIMETRICOS and self._jwks is not None:
            return self._jwks.get_signing_key_from_jwt(token).key, str(algoritmo)
        raise jwt.InvalidAlgorithmError("Algoritmo de firma no permitido")


@lru_cache
def get_verificador() -> VerificadorJwt:
    settings = get_settings()
    secreto = settings.supabase_jwt_secret
    return VerificadorJwt(
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
        jwks=PyJWKClient(settings.jwks_url, cache_keys=True, lifespan=600, timeout=5),
        secreto=secreto.get_secret_value() if secreto else None,
    )


_bearer = HTTPBearer(auto_error=False)


def get_claims(
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    verificador: Annotated[VerificadorJwt, Depends(get_verificador)],
) -> Claims:
    """Dependency: exige `Authorization: Bearer <jwt>` válido y devuelve sus claims."""
    if credenciales is None:
        raise ErrorApi(401, "no_autenticado", "Falta el token de autenticación.", ENCABEZADO_BEARER)
    try:
        return verificador.verificar(credenciales.credentials)
    except TokenInvalido as exc:
        codigo = "token_vencido" if exc.vencido else "token_invalido"
        raise ErrorApi(401, codigo, str(exc), ENCABEZADO_BEARER) from exc
    except ValidacionNoDisponible as exc:
        raise ErrorApi(
            503, "auth_no_disponible", "No se pudo validar el token en este momento."
        ) from exc
