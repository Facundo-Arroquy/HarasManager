"""El verificador de JWT: qué tokens acepta y, sobre todo, cuáles rechaza."""

import base64
import hashlib
import hmac
import json
import time
from uuid import UUID

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import TokenInvalido, ValidacionNoDisponible, VerificadorJwt
from tests.constantes import ADMIN_1
from tests.jwt_utils import ClaveEc, emitir_token, nueva_clave_ec, verificador_de_prueba

SECRETO = "un-secreto-compartido-de-prueba-de-al-menos-32-bytes"


def test_acepta_un_token_valido(clave: ClaveEc, verificador: VerificadorJwt) -> None:
    token = emitir_token(clave, sub=ADMIN_1, email="admin.demo1@haras.com")

    claims = verificador.verificar(token)

    assert claims.sub == ADMIN_1
    assert claims.role == "authenticated"
    assert claims.email == "admin.demo1@haras.com"
    assert claims.raw["aud"] == "authenticated"


def test_rechaza_un_token_vencido(clave: ClaveEc, verificador: VerificadorJwt) -> None:
    token = emitir_token(clave, sub=ADMIN_1, vence_en=-60)

    with pytest.raises(TokenInvalido) as error:
        verificador.verificar(token)

    assert error.value.vencido


def test_rechaza_un_token_firmado_por_otro_proyecto(verificador: VerificadorJwt) -> None:
    otra_clave = nueva_clave_ec()
    token = emitir_token(otra_clave, sub=ADMIN_1)

    with pytest.raises(TokenInvalido) as error:
        verificador.verificar(token)

    assert not error.value.vencido


def test_rechaza_un_token_con_la_firma_adulterada(
    clave: ClaveEc, verificador: VerificadorJwt
) -> None:
    token = emitir_token(clave, sub=ADMIN_1)
    encabezado, cuerpo, firma = token.split(".")
    adulterado = ".".join([encabezado, cuerpo, firma[:-4] + "AAAA"])

    with pytest.raises(TokenInvalido):
        verificador.verificar(adulterado)


def test_rechaza_un_token_sin_firma(clave: ClaveEc, verificador: VerificadorJwt) -> None:
    sin_firma = jwt.encode({"sub": str(ADMIN_1), "role": "authenticated"}, "", algorithm="none")

    with pytest.raises(TokenInvalido):
        verificador.verificar(sin_firma)


def test_rechaza_hs256_si_no_hay_secreto_configurado(
    clave: ClaveEc, verificador: VerificadorJwt
) -> None:
    token = emitir_token(clave, sub=ADMIN_1, algoritmo="HS256", secreto=SECRETO)

    with pytest.raises(TokenInvalido):
        verificador.verificar(token)


def test_acepta_hs256_si_hay_secreto_configurado(clave: ClaveEc) -> None:
    verificador = verificador_de_prueba(clave, secreto=SECRETO)
    token = emitir_token(clave, sub=ADMIN_1, algoritmo="HS256", secreto=SECRETO)

    assert verificador.verificar(token).sub == ADMIN_1


def test_rechaza_hs256_con_otro_secreto(clave: ClaveEc) -> None:
    verificador = verificador_de_prueba(clave, secreto=SECRETO)
    token = emitir_token(
        clave, sub=ADMIN_1, algoritmo="HS256", secreto="otro-secreto-que-no-es-el-del-proyecto"
    )

    with pytest.raises(TokenInvalido):
        verificador.verificar(token)


def hs256_a_mano(claims: dict[str, object], secreto: bytes) -> str:
    """Firma HS256 sin PyJWT: la librería se niega a usar una clave PEM como secreto."""

    def b64(datos: bytes) -> str:
        return base64.urlsafe_b64encode(datos).rstrip(b"=").decode()

    encabezado = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    cuerpo = b64(json.dumps(claims).encode())
    firma = hmac.new(secreto, f"{encabezado}.{cuerpo}".encode(), hashlib.sha256).digest()
    return f"{encabezado}.{cuerpo}.{b64(firma)}"


@pytest.mark.parametrize("con_secreto_configurado", [False, True])
def test_no_cae_en_la_confusion_de_algoritmos(
    clave: ClaveEc, con_secreto_configurado: bool
) -> None:
    """Ataque clásico: firmar con HS256 usando la clave PÚBLICA (que es pública) como secreto.

    Con un verificador que solo conoce la clave pública y con uno que además tiene un secreto
    propio, el token del atacante tiene que fallar.
    """
    verificador = verificador_de_prueba(clave, secreto=SECRETO if con_secreto_configurado else None)
    claims = {
        "sub": str(ADMIN_1),
        "role": "authenticated",
        "aud": "authenticated",
        "iss": get_settings().jwt_issuer,
        "exp": int(time.time()) + 3600,
    }
    token = hs256_a_mano(claims, clave.publica_pem)

    with pytest.raises(TokenInvalido):
        verificador.verificar(token)


def test_rechaza_otro_emisor(clave: ClaveEc, verificador: VerificadorJwt) -> None:
    token = emitir_token(clave, sub=ADMIN_1, issuer="https://otro-proyecto.supabase.co/auth/v1")

    with pytest.raises(TokenInvalido):
        verificador.verificar(token)


def test_rechaza_otra_audiencia(clave: ClaveEc, verificador: VerificadorJwt) -> None:
    token = emitir_token(clave, sub=ADMIN_1, audience="otra-app")

    with pytest.raises(TokenInvalido):
        verificador.verificar(token)


def test_rechaza_un_token_sin_sub(clave: ClaveEc, verificador: VerificadorJwt) -> None:
    token = emitir_token(clave, sub="", role="authenticated")
    sin_sub = jwt.encode(
        {
            k: v
            for k, v in jwt.decode(token, options={"verify_signature": False}).items()
            if k != "sub"
        },
        clave.privada,
        algorithm="ES256",
        headers={"kid": clave.kid},
    )

    with pytest.raises(TokenInvalido):
        verificador.verificar(sin_sub)


def test_rechaza_el_token_anonimo(clave: ClaveEc, verificador: VerificadorJwt) -> None:
    """La anon key es un JWT válido para Supabase, pero no es una persona."""
    token = emitir_token(clave, sub=ADMIN_1, role="anon")

    with pytest.raises(TokenInvalido):
        verificador.verificar(token)


def test_rechaza_un_sub_que_no_es_uuid(clave: ClaveEc, verificador: VerificadorJwt) -> None:
    token = emitir_token(clave, sub="no-soy-un-uuid")

    with pytest.raises(TokenInvalido):
        verificador.verificar(token)


@pytest.mark.parametrize("basura", ["", "abc", "a.b.c", "Bearer x"])
def test_rechaza_un_token_malformado(verificador: VerificadorJwt, basura: str) -> None:
    with pytest.raises(TokenInvalido):
        verificador.verificar(basura)


def test_si_supabase_no_responde_no_es_culpa_del_token(clave: ClaveEc) -> None:
    verificador = verificador_de_prueba(clave, jwks_caido=True)
    token = emitir_token(clave, sub=ADMIN_1)

    with pytest.raises(ValidacionNoDisponible):
        verificador.verificar(token)


def test_el_sub_se_convierte_a_uuid(clave: ClaveEc, verificador: VerificadorJwt) -> None:
    claims = verificador.verificar(emitir_token(clave, sub=str(ADMIN_1)))

    assert isinstance(claims.sub, UUID)
