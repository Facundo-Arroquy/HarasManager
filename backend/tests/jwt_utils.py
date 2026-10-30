"""Herramientas para fabricar tokens de prueba y un verificador que los acepta."""

import time
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from jwt import PyJWKClientConnectionError

from app.core.config import get_settings
from app.core.security import VerificadorJwt


@dataclass(frozen=True)
class ClaveEc:
    privada: ec.EllipticCurvePrivateKey
    kid: str = "clave-de-prueba"

    @property
    def publica(self) -> ec.EllipticCurvePublicKey:
        return self.privada.public_key()

    @property
    def publica_pem(self) -> bytes:
        return self.publica.public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        )


def nueva_clave_ec() -> ClaveEc:
    return ClaveEc(privada=ec.generate_private_key(ec.SECP256R1()))


class JwksFalso:
    """Reemplaza al cliente que baja las claves de Supabase: devuelve siempre la misma."""

    def __init__(self, clave: ClaveEc) -> None:
        self._clave = clave

    def get_signing_key_from_jwt(self, token: str) -> Any:
        return SimpleNamespace(key=self._clave.publica)


class JwksCaido:
    def get_signing_key_from_jwt(self, token: str) -> Any:
        raise PyJWKClientConnectionError("Supabase no responde")


def emitir_token(
    clave: ClaveEc,
    *,
    sub: UUID | str,
    role: str | None = "authenticated",
    audience: str | None = "authenticated",
    issuer: str | None = None,
    vence_en: int = 3600,
    email: str | None = None,
    algoritmo: str = "ES256",
    secreto: str | bytes | None = None,
) -> str:
    """Fabrica un token como los de Supabase. Un valor `None` omite ese claim."""
    ahora = int(time.time())
    claims: dict[str, Any] = {
        "sub": str(sub),
        "role": role,
        "aud": audience,
        "iss": issuer if issuer is not None else get_settings().jwt_issuer,
        "iat": ahora,
        "exp": ahora + vence_en,
        "email": email,
    }
    claims = {k: v for k, v in claims.items() if v is not None}
    if algoritmo == "ES256":
        return jwt.encode(claims, clave.privada, algorithm="ES256", headers={"kid": clave.kid})
    return jwt.encode(claims, secreto or "", algorithm=algoritmo)


def verificador_de_prueba(
    clave: ClaveEc, *, secreto: str | None = None, jwks_caido: bool = False
) -> VerificadorJwt:
    settings = get_settings()
    return VerificadorJwt(
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
        jwks=JwksCaido() if jwks_caido else JwksFalso(clave),
        secreto=secreto,
    )
