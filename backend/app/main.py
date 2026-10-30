from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="HarasManager API",
        version="0.1.0",
        description="Backend de HarasManager. Plan: docs/PLAN-MIGRACION-BACKEND.md",
    )

    # El front manda el JWT de Supabase en `Authorization`: no hay cookies, así que
    # no hace falta `allow_credentials`.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(health.router)
    return app


app = create_app()
