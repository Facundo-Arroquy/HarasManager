"""Configuración del backend: todo sale de variables de entorno (o de `backend/.env`)."""

from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

from pydantic import SecretStr, model_validator
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

    # --- Autenticación: el login sigue siendo de Supabase Auth; acá solo se valida el JWT ---

    # URL del proyecto de Supabase. De acá salen el emisor (`iss`) esperado en el token y
    # la dirección donde Supabase publica sus claves públicas (JWKS).
    supabase_url: str = "http://127.0.0.1:55321"

    # Solo para proyectos que todavía firman con un secreto compartido (HS256). Los
    # proyectos con claves asimétricas (ES256, el caso de local y de producción) no lo usan.
    supabase_jwt_secret: SecretStr | None = None

    jwt_audience: str = "authenticated"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origen.strip() for origen in self.cors_origins.split(",") if origen.strip()]

    @property
    def jwt_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.jwt_issuer}/.well-known/jwks.json"

    @model_validator(mode="after")
    def _local_solo_con_servicios_locales(self) -> "Settings":
        """Red de seguridad: en local, el backend no arranca contra servicios remotos.

        Evita escribir en producción (o aceptar sus tokens) por un `.env` mal copiado.
        """
        if self.environment == "local":
            for nombre, url in (
                ("DATABASE_URL", self.database_url),
                ("SUPABASE_URL", self.supabase_url),
            ):
                host = urlparse(url).hostname
                if host not in HOSTS_LOCALES:
                    raise ValueError(
                        f"ENVIRONMENT=local solo puede usar servicios locales: el host de "
                        f"{nombre} ('{host}') no lo es. "
                        "Para otro entorno, usá ENVIRONMENT=staging o production."
                    )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
