"""El contrato versionado (`backend/openapi.json`) tiene que reflejar el código."""

import json
from pathlib import Path

from scripts.exportar_openapi import DESTINO_POR_DEFECTO, contrato


def test_el_contrato_versionado_esta_al_dia() -> None:
    """Si falla: se cambió la API sin regenerar el cliente (`./scripts/generar-cliente-api.sh`)."""
    versionado = Path(DESTINO_POR_DEFECTO).read_text(encoding="utf-8")

    assert versionado == contrato()


def test_el_contrato_declara_la_autenticacion_y_la_forma_de_los_errores() -> None:
    esquema = json.loads(contrato())

    assert "HTTPBearer" in esquema["components"]["securitySchemes"]
    assert set(esquema["components"]["schemas"]["ErrorResponse"]["properties"]) == {
        "code",
        "message",
    }
    assert "/me" in esquema["paths"] and "/health" in esquema["paths"]
