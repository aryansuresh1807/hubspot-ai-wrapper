"""
Application configuration from environment variables.
Settings class using pydantic-settings with optional validation.
"""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from backend root so it loads when running from backend/ or project root
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    """
    Application settings loaded from environment and .env.
    All fields optional with defaults for local dev; validate for production.
    """

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_KEY: str

    # Application
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> List[str]:
        """Accept comma-separated string or list for local/production env."""
        if isinstance(v, list):
            return [x.strip() for x in v if isinstance(x, str) and x.strip()]
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE if _ENV_FILE.exists() else ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # HubSpot (explicit env names so .env / Railway HUBSPOT_* are always read)
    hubspot_api_key: str = Field(
        default="",
        description="HubSpot Private App access token (legacy)",
        validation_alias="HUBSPOT_API_KEY",
    )
    hubspot_access_token: str = Field(
        default="",
        description="HubSpot OAuth or Private App access token (Bearer auth)",
        validation_alias="HUBSPOT_ACCESS_TOKEN",
    )

    # LLM (at least one required for AI features)
    openai_api_key: str = Field(default="", description="OpenAI API key")
    anthropic_api_key: str = Field(default="", description="Anthropic API key (optional)")

    # Database (optional; Supabase client uses URL + key)
    database_url: str = Field(
        default="",
        description="Direct PostgreSQL connection string if needed",
    )

    # CORS (legacy / fallback)
    frontend_url: str = Field(
        default="http://localhost:3000",
        description="Frontend app URL for CORS and links",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return list(self.CORS_ORIGINS)

    @field_validator("frontend_url", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v

    def validate_for_production(self) -> None:
        """
        Call to validate that required env vars are set (e.g. on startup in production).
        Raises ValueError with missing keys.
        """
        missing: List[str] = []
        if not self.SUPABASE_URL:
            missing.append("SUPABASE_URL")
        if not self.SUPABASE_ANON_KEY:
            missing.append("SUPABASE_ANON_KEY")
        if not self.SUPABASE_SERVICE_KEY:
            missing.append("SUPABASE_SERVICE_KEY")
        if not self.hubspot_api_key and not self.hubspot_access_token:
            missing.append("HUBSPOT_ACCESS_TOKEN or HUBSPOT_API_KEY")
        if not self.openai_api_key and not self.anthropic_api_key:
            missing.append("OPENAI_API_KEY or ANTHROPIC_API_KEY")
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
