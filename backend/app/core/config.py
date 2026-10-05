from functools import lru_cache
from typing import Optional, Union, List
from pydantic import computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application metadata
    APP_NAME: str = "StreamSignal Backend"
    APP_TITLE: str = "StreamSignal API"
    DESCRIPTION: str = "StreamSignal backend API foundation with FastAPI, PostgreSQL 17, PostGIS, and pgvector."
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"
    BACKEND_PORT: int = 8000

    # API Versioning and Documentation
    API_V1_STR: str = "/api/v1"
    DOCS_URL: str = "/docs"
    REDOC_URL: str = "/redoc"
    OPENAPI_URL: str = "/openapi.json"

    # CORS configuration
    CORS_ORIGINS: Union[str, List[str]] = ["*"]

    # Media Evidence Storage configuration
    MEDIA_STORAGE_PATH: str = "media_storage"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB limit
    MAX_MEDIA_FILES_PER_REPORT: int = 5
    ALLOWED_IMAGE_FORMATS: List[str] = ["JPEG", "PNG", "WEBP"]
    MAX_IMAGE_PIXELS: int = 25_000_000  # 25 MP decompression bomb safeguard

    # OIDC access-token validation. Empty values fail closed outside development.
    OIDC_ISSUER: str = ""
    OIDC_AUDIENCE: str = ""
    OIDC_JWKS_URL: str = ""
    OIDC_ROLE_CLAIM: str = "https://streamsignal.app/roles"
    OIDC_RESEARCHER_ROLE: str = "RESEARCHER"

    # PostgreSQL configuration
    POSTGRES_USER: str = "streamsignal_user"
    POSTGRES_PASSWORD: str = "streamsignal_dev_password"
    POSTGRES_DB: str = "streamsignal_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # Database URL override (optional)
    _DATABASE_URL: Optional[str] = None

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return v
        raise ValueError(f"Invalid CORS_ORIGINS value: {v}")

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        """Construct standard SQLAlchemy connection URI if not explicitly provided."""
        if self._DATABASE_URL:
            return self._DATABASE_URL
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
