from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        populate_by_name=True,
        extra="ignore",
    )

    app_name: str = "Bozor-AI Engine"
    app_env: str = "dev"
    app_debug: bool = True
    api_prefix: str = "/api/v1"
    uvicorn_workers: int = 1

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "bozor_ai"
    postgres_user: str = "bozor"
    postgres_password: str = "bozor"
    database_url: str = ""

    redis_url: str = "redis://localhost:6379/0"
    groq_api_key: str = ""
    """Required for Bozor-AI stylist — Groq Cloud 70B (see app.ai.config)."""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_agent_model: str = ""
    groq_vision_model: str = "llama-3.2-11b-vision-preview"
    usd_to_uzs_rate: int = 13_000
    eur_to_uzs_rate: int = 14_000
    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    gemini_embedding_model: str = "models/gemini-embedding-2"
    visual_search_use_gemini: bool = True
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-20241022"
    embedding_model: str = "text-embedding-3-small"
    site_url: str = "https://topdim.uz"
    external_api_timeout_seconds: float = 20.0
    user_rate_limit_per_minute: int = 10
    order_reserve_rate_limit_per_minute: int = 8
    order_lookup_rate_limit_per_minute: int = 12
    session_cookie_name: str = "bozor_session"
    enable_online_checkout: bool = False
    telegram_bot_token: str = ""
    telegram_bot_username: str = ""
    resend_api_key: str = ""
    resend_from_email: str = "Bozor AI <onboarding@resend.dev>"
    openai_api_key: str = ""
    openai_whisper_model: str = "whisper-1"
    merchant_alert_idle_days: int = 3
    merchant_alert_lead_hours: int = 24
    merchant_crm_webapp_url: str = "http://localhost:3003"

    payment_checkout_base_url: str = "http://localhost:3002"
    click_service_id: str = ""
    click_secret_key: str = ""
    click_merchant_id: str = ""
    payme_merchant_id: str = ""
    payme_secret_key: str = ""
    payment_callback_ip_whitelist: str = ""
    payment_callback_max_age_seconds: int = 900

    # Order settlement splitter (UZS)
    finance_order_commission_rate_pct: float = 5.0
    finance_delivery_fallback_uzs: int = 25_000
    finance_delivery_base_uzs: int = 12_000
    finance_delivery_uzs_per_km: int = 3_500
    yandex_router_api_key: str = ""
    yandex_delivery_token: str = Field(
        default="",
        validation_alias=AliasChoices("YANDEX_DELIVERY_TOKEN", "YANDEX_DELIVERY_API_TOKEN"),
    )
    yandex_delivery_base_url: str = Field(
        default="https://b2b.taxi.yandex.net",
        validation_alias=AliasChoices("YANDEX_DELIVERY_BASE_URL", "YANDEX_API_URL"),
    )
    yandex_delivery_rub_to_uzs: int = 150
    is_delivery_sandbox: bool = Field(default=False, validation_alias=AliasChoices("IS_DELIVERY_SANDBOX", "YANDEX_DELIVERY_SANDBOX"))

    @property
    def yandex_delivery_api_token(self) -> str:
        """Backward-compatible alias."""
        return self.yandex_delivery_token

    admin_api_key: str = ""
    price_outlier_multiplier: float = 20.0
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "products"
    media_storage_backend: str = "local"
    s3_endpoint_url: str = ""
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_base_url: str = ""
    s3_region: str = "auto"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60 * 24 * 7
    cors_origins: str = ""

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() in {"production", "prod"}

    @property
    def cors_origin_list(self) -> list[str]:
        raw = [x.strip() for x in self.cors_origins.split(",") if x.strip()]
        if raw:
            return raw
        if self.is_production:
            return []
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:3002",
            "http://127.0.0.1:3002",
            "http://localhost:3003",
            "http://127.0.0.1:3003",
        ]

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
