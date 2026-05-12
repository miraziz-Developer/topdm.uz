from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "BOZOR-AI ENGINE"
    app_env: str = "dev"
    app_debug: bool = True
    api_prefix: str = "/api/v1"

    postgres_dsn: str = "postgresql+asyncpg://user:pass@localhost:5432/bozor_ai"
    redis_url: str = "redis://localhost:6379/0"

    anthropic_api_key: str = ""
    gemini_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
