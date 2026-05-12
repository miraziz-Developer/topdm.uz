from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "Bozor-AI Engine"
    app_env: str = "dev"
    app_debug: bool = True
    api_prefix: str = "/api/v1"

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "bozor_ai"
    postgres_user: str = "bozor"
    postgres_password: str = "bozor"
    database_url: str = ""

    redis_url: str = "redis://localhost:6379/0"
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-70b-versatile"
    groq_vision_model: str = "llama-3.2-90b-vision-preview"
    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    external_api_timeout_seconds: float = 20.0
    user_rate_limit_per_minute: int = 10
    telegram_bot_token: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    eskiz_login: str = ""
    eskiz_password: str = ""
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60 * 24 * 7

    @property
    def async_database_url(self) -> str:
        if self.database_url:
            if self.database_url.startswith("postgresql://"):
                return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
