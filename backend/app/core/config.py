"""Configuración del backend: todo sale de variables de entorno (o de `backend/.env`)."""

from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Hosts que cuentan como "base local" (la de Docker, sola o vista desde un contenedor).
HOSTS_LOCALES = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["local", "staging", "production"] = "local"

    # Por defecto apunta a la base de Docker (`supabase start`), nunca a producción.
    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:55322/postgres"

    # Supabase tiene un tope bajo de conexiones: el pool se dimensiona a propósito.
    db_pool_size: int = 5
    db_max_overflow: int = 5

    # Orígenes del front permitidos por CORS, separados por coma.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origen.strip() for origen in self.cors_origins.split(",") if origen.strip()]

    @model_validator(mode="after")
    def _local_solo_con_base_local(self) -> "Settings":
        """Red de seguridad: en local, el backend no arranca contra una base remota.

        Evita escribir en producción por un `.env` mal copiado.
        """
        if self.environment == "local":
            host = urlparse(self.database_url).hostname
            if host not in HOSTS_LOCALES:
                raise ValueError(
                    f"ENVIRONMENT=local solo puede usar una base local (host '{host}' no lo es). "
                    "Para otra base, usá ENVIRONMENT=staging o production."
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
