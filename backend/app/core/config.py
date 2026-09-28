from functools import lru_cache
from typing import Optional
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application settings
    APP_NAME: str = "StreamSignal Backend"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"
    BACKEND_PORT: int = 8000

    # PostgreSQL configuration
    POSTGRES_USER: str = "streamsignal_user"
    POSTGRES_PASSWORD: str = "streamsignal_dev_password"
    POSTGRES_DB: str = "streamsignal_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # Database URL override (optional)
    _DATABASE_URL: Optional[str] = None

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
