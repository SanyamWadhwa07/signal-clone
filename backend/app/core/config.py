from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


DEFAULT_JWT_SECRET = "dev-only-secret-change-me-in-production"


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables (or backend/.env)."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = f"sqlite+aiosqlite:///{(BACKEND_DIR / 'data' / 'signal.db').as_posix()}"
    environment: str = "development"  # "production" turns on startup safety checks
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_ttl_days: int = 7
    # Comma-separated list, e.g. "http://localhost:3000,https://signal-clone.vercel.app"
    cors_origins: str = "http://localhost:3000"
    mock_otp: str = "123456"
    upload_dir: Path = BACKEND_DIR / "uploads"
    max_upload_mb: int = 10
    seed_on_startup: bool = True
    rate_limit_enabled: bool = True
    rate_limit_auth_per_minute: int = 30  # per client IP
    rate_limit_send_per_minute: int = 120  # per user
    rate_limit_upload_per_minute: int = 30  # per user
    purge_interval_seconds: float = 5.0
    presence_grace_seconds: float = 5.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
