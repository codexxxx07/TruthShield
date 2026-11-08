"""Runtime settings, read once from the environment (and an optional .env)."""
import logging
import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"

load_dotenv(BASE_DIR / ".env")
log = logging.getLogger("truthshield")


def _flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    return default if value is None or value == "" else value.strip().lower() in {"1", "true", "yes", "on"}


def _jwt_secret() -> str:
    value = os.getenv("JWT_SECRET", "")
    if value:
        return value
    log.warning("JWT_SECRET is not set; generated a random one. Sessions end when the server restarts.")
    return secrets.token_urlsafe(48)


@dataclass(frozen=True)
class Settings:
    mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    mongo_db: str = os.getenv("MONGO_DB", "truthshield")
    allow_mock_db: bool = _flag("ALLOW_MOCK_DB", True)
    jwt_secret: str = field(default_factory=_jwt_secret)
    jwt_ttl_hours: int = int(os.getenv("JWT_TTL_HOURS", "24"))
    cors_origins: tuple = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    )
    cache_ttl_seconds: int = int(os.getenv("CACHE_TTL_SECONDS", "600"))
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    enable_browser: bool = _flag("ENABLE_BROWSER", True)
    enable_ct_watch: bool = _flag("ENABLE_CT_WATCH", True)
    certspotter_api_key: str = os.getenv("CERTSPOTTER_API_KEY", "")
    seed_demo_data: bool = _flag("SEED_DEMO_DATA", True)
    fetch_timeout: float = float(os.getenv("FETCH_TIMEOUT", "8"))
    max_body_bytes: int = int(os.getenv("MAX_BODY_BYTES", str(2 * 1024 * 1024)))
    max_redirects: int = int(os.getenv("MAX_REDIRECTS", "10"))


settings = Settings()
