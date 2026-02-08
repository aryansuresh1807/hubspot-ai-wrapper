"""
Application configuration from environment variables.
Settings class using pydantic-settings with optional validation.
"""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment and .env.
    All fields optional with defaults for local dev; validate for production.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # HubSpot
    hubspot_api_key: str = Field(
        default="",
        description="HubSpot Private App access token or OAuth access token",
    )

    # Supabase
    supabase_url: str = Field(
        default="",
        description="Supabase project URL (e.g. https://xxx.supabase.co)",
    )
    supabase_service_key: str = Field(
        default="",
        description="Supabase service role key (server-side only)",
    )

    # LLM (at least one required for AI features)
    openai_api_key: str = Field(default="", description="OpenAI API key")
    anthropic_api_key: str = Field(default="", description="Anthropic API key (optional)")

    # Database (optional; Supabase client uses URL + key)
    database_url: str = Field(
        default="",
        description="Direct PostgreSQL connection string if needed",
    )

    # CORS
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        description="Comma-separated list of allowed CORS origins",
    )
    frontend_url: str = Field(
        default="http://localhost:3000",
        description="Frontend app URL for CORS and links",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @field_validator("cors_origins", "frontend_url", mode="before")
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
        if not self.supabase_url:
            missing.append("SUPABASE_URL")
        if not self.supabase_service_key:
            missing.append("SUPABASE_SERVICE_KEY")
        if not self.hubspot_api_key:
            missing.append("HUBSPOT_API_KEY")
        if not self.openai_api_key and not self.anthropic_api_key:
            missing.append("OPENAI_API_KEY or ANTHROPIC_API_KEY")
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


@lru_cache
def get_settings() -> Settings:
    return Settings()
