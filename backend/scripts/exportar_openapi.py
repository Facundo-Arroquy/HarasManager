"""Exporta el contrato OpenAPI de la API a un archivo JSON estable.

De ese archivo sale el cliente TypeScript del front (`scripts/generar-cliente-api.sh`). Se
versiona en `backend/openapi.json` para poder generar el cliente sin levantar el backend, y un
test (`tests/test_openapi.py`) falla si el archivo quedó desactualizado respecto del código.

Uso, desde `backend/`:

    uv run python -m scripts.exportar_openapi            # escribe backend/openapi.json
    uv run python -m scripts.exportar_openapi otra.json  # o en otra ruta
"""

import json
import sys
from pathlib import Path

from app.main import create_app

DESTINO_POR_DEFECTO = Path(__file__).resolve().parents[1] / "openapi.json"


def contrato() -> str:
    """El OpenAPI de la app como texto: ordenado y con salto de línea final, para que el diff
    de git muestre solo cambios reales."""
    return json.dumps(create_app().openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main() -> None:
    destino = Path(sys.argv[1]) if len(sys.argv) > 1 else DESTINO_POR_DEFECTO
    destino.write_text(contrato(), encoding="utf-8")
    print(f"Contrato escrito en {destino}")


if __name__ == "__main__":
    main()
