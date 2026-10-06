"""App configuration, loaded from environment variables (or a .env file
in local development). See .env.example for the full list.
"""

from __future__ import annotations

import secrets
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database. Defaults to a local SQLite file for zero-config development;
    # in production this is a managed Postgres URL, e.g.
    #   postgresql+psycopg2://user:pass@host/dbname
    database_url: str = "sqlite:///./stocktaker.db"

    @field_validator("database_url")
    @classmethod
    def _normalize_postgres_scheme(cls, url: str) -> str:
        # Hosted Postgres providers (Neon, Render, Heroku) hand out
        # "postgres://" or "postgresql://" URLs; pin SQLAlchemy to the
        # psycopg2 driver that requirements.txt installs.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg2://" + url[len(prefix):]
        return url

    # Password for the `admin` account created on first startup (only when
    # the users table is empty). Fine as-is locally; on any public deploy
    # set INITIAL_ADMIN_PASSWORD so the server never starts with a
    # well-known password.
    initial_admin_password: str = "admin123"

    # JWT auth. ALWAYS override jwt_secret in production (env var JWT_SECRET) -
    # this random default is only safe for local development, since it's
    # regenerated (invalidating every token) each time the process restarts.
    jwt_secret: str = secrets.token_urlsafe(48)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # Path prefix for every API route. Empty for local development (API at
    # http://localhost:8000/items); "/api" in the combined deploy, where the
    # web dashboard owns "/" and its own /items, /reports pages.
    api_prefix: str = ""

    @field_validator("api_prefix")
    @classmethod
    def _check_api_prefix(cls, prefix: str) -> str:
        prefix = prefix.rstrip("/")
        if prefix and not prefix.startswith("/"):
            raise ValueError(f"API_PREFIX must be empty or start with '/', got {prefix!r}")
        return prefix

    # Built web dashboard (stocktaker-web/dist). When set, the API also
    # serves the dashboard, so one service at one URL hosts everything.
    web_dist_dir: Path | None = None

    # CORS - which origins the web dashboard / mobile dev server may call
    # this API from. Comma-separated in the env var.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://localhost:19006"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
