"""La auditoría de rutas: la real tiene que estar limpia, y el auditor tiene que saber ladrar."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI

from app.api.permisos import (
    require_acceso_caballo,
    require_admin,
    require_membresia,
    require_superadmin,
    require_usuario,
)
from app.core.permisos import ContextoUsuario
from app.main import create_app
from tests.auditoria_rutas import auditar


def test_todas_las_rutas_de_la_api_declaran_una_regla_de_acceso() -> None:
    """Si falla, hay un endpoint nuevo sin regla: agregarle un `require_*` (ver api/permisos.py)."""
    assert auditar(create_app()) == []


# --- El auditor mismo: con apps de juguete -----------------------------------------------------


def test_detecta_una_ruta_sin_ninguna_regla() -> None:
    app = FastAPI()

    @app.get("/caballos")
    def listar() -> list[str]:
        return []

    problemas = auditar(app)

    assert len(problemas) == 1
    assert "GET /caballos" in problemas[0]


def test_detecta_una_ruta_de_sociedad_protegida_solo_con_require_usuario() -> None:
    """El olvido más fácil: parece protegida, pero cualquier usuario entra a cualquier sociedad."""
    app = FastAPI()

    @app.get("/sociedades/{sociedad_id}/campos")
    def campos(
        sociedad_id: UUID, _: Annotated[ContextoUsuario, Depends(require_usuario)]
    ) -> list[str]:
        return []

    problemas = auditar(app)

    assert len(problemas) == 1
    assert "sociedad_id" in problemas[0]


def test_detecta_un_caballo_protegido_con_una_regla_de_sociedad() -> None:
    app = FastAPI()

    @app.get("/caballos/{caballo_id}")
    def caballo(
        caballo_id: UUID, _: Annotated[ContextoUsuario, Depends(require_membresia)]
    ) -> dict[str, str]:
        return {}

    assert "caballo_id" in auditar(app)[0]


def test_detecta_el_parametro_en_el_query_y_no_solo_en_el_path() -> None:
    app = FastAPI()

    @app.get("/campos")
    def campos(
        sociedad_id: UUID, _: Annotated[ContextoUsuario, Depends(require_usuario)]
    ) -> list[str]:
        return []

    assert "sociedad_id" in auditar(app)[0]


def test_acepta_las_rutas_bien_protegidas() -> None:
    app = FastAPI()

    @app.get("/sociedades/{sociedad_id}/campos")
    def campos(
        sociedad_id: UUID, _: Annotated[ContextoUsuario, Depends(require_admin)]
    ) -> list[str]:
        return []

    @app.get("/caballos/{caballo_id}")
    def caballo(
        caballo_id: UUID, _: Annotated[ContextoUsuario, Depends(require_acceso_caballo)]
    ) -> dict[str, str]:
        return {}

    @app.get("/admin/usuarios")
    def usuarios(_: Annotated[ContextoUsuario, Depends(require_superadmin)]) -> list[str]:
        return []

    @app.get("/sociedades/{sociedad_id}/resumen")
    def resumen(
        sociedad_id: UUID, _: Annotated[ContextoUsuario, Depends(require_superadmin)]
    ) -> dict[str, str]:
        return {}

    assert auditar(app) == []


def test_las_rutas_publicas_estan_en_una_lista_explicita() -> None:
    app = FastAPI()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {}

    @app.get("/otra-publica")
    def otra() -> dict[str, str]:
        return {}

    assert [p.split(":")[0] for p in auditar(app)] == ["GET /otra-publica"]
