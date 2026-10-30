"""El caso del front: un token que emitió Supabase Auth de verdad, validado contra su JWKS."""

import json
import os
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from tests.constantes import ADMIN_1, VET_INDEPENDIENTE
from tests.jwt_utils import emitir_token, nueva_clave_ec

CONTRASENA_DEL_SEED = "Local-dev-2026"  # supabase/seeds/README.md

pytestmark = [pytest.mark.db, pytest.mark.usefixtures("base_local")]


@pytest.fixture(scope="session")
def anon_key() -> str:
    """La anon key local: de `SUPABASE_ANON_KEY` o, si no está, de `supabase status`."""
    clave = os.environ.get("SUPABASE_ANON_KEY", "")
    if not clave:
        try:
            salida = subprocess.run(
                ["supabase", "status", "-o", "env"],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
                cwd=Path(__file__).resolve().parents[2],
            ).stdout
        except (OSError, subprocess.TimeoutExpired):
            salida = ""
        for linea in salida.splitlines():
            if linea.startswith("ANON_KEY="):
                clave = linea.split("=", 1)[1].strip('"')
    if not clave:
        pytest.skip("No pude obtener la anon key local (exportá SUPABASE_ANON_KEY)")
    return clave


def iniciar_sesion(anon_key: str, email: str) -> str:
    """Hace lo mismo que el front: login con email y contraseña contra Supabase Auth."""
    pedido = urllib.request.Request(
        f"{get_settings().supabase_url}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": CONTRASENA_DEL_SEED}).encode(),
        headers={"apikey": anon_key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(pedido, timeout=10) as respuesta:
            return str(json.load(respuesta)["access_token"])
    except (urllib.error.URLError, OSError):
        pytest.skip("Supabase Auth local no responde (supabase start)")


def test_me_con_el_token_que_emite_supabase(client: TestClient, anon_key: str) -> None:
    token = iniciar_sesion(anon_key, "admin.demo1@haras.com")

    respuesta = client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert respuesta.status_code == 200
    assert respuesta.json()["id"] == str(ADMIN_1)
    assert respuesta.json()["membresias"][0]["sociedad"] == "Haras Demo 1"


def test_me_de_un_vet_sin_membresia_con_su_token_real(client: TestClient, anon_key: str) -> None:
    token = iniciar_sesion(anon_key, "vet.independiente.demo@haras.com")

    respuesta = client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert respuesta.status_code == 200
    assert respuesta.json()["id"] == str(VET_INDEPENDIENTE)


def test_un_token_real_con_la_firma_tocada_se_rechaza(client: TestClient, anon_key: str) -> None:
    token = iniciar_sesion(anon_key, "admin.demo1@haras.com")
    adulterado = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")

    respuesta = client.get("/me", headers={"Authorization": f"Bearer {adulterado}"})

    assert respuesta.status_code == 401


def test_un_token_de_otro_proyecto_se_rechaza_con_las_claves_reales(client: TestClient) -> None:
    ajeno = emitir_token(nueva_clave_ec(), sub=ADMIN_1)

    respuesta = client.get("/me", headers={"Authorization": f"Bearer {ajeno}"})

    assert respuesta.status_code == 401
    assert respuesta.json()["code"] == "token_invalido"
