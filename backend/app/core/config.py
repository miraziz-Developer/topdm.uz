from functools import lru_cache

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        populate_by_name=True,
        extra="ignore",
    )

    app_name: str = "Bozorliii Engine"
    app_env: str = "dev"
    production: bool = Field(default=False, validation_alias=AliasChoices("PRODUCTION", "production"))
    app_debug: bool = True
    allow_dev_mocks: bool = True
    sentry_dsn: str = ""
    groq_api_key_backup: str = ""
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
    """Required for Bozorliii stylist — Groq Cloud 70B (see app.ai.config)."""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_agent_model: str = ""
    groq_vision_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    usd_to_uzs_rate: int = 13_000
    eur_to_uzs_rate: int = 14_000
    rapidapi_key: str = ""
    taobao_datahub_host: str = "taobao-datahub.p.rapidapi.com"
    taobao_datahub_base_url: str = "https://taobao-datahub.p.rapidapi.com"
    premium_cny_to_uzs_rate: float = 1_950.0
    premium_margin_pct: float = 15.0
    premium_margin_multiplier: float = 1.15
    premium_cargo_rate_usd_per_kg: float = 8.0
    premium_price_round_uzs: int = 1_000
    premium_local_courier_base_uzs: int = 25_000
    """Vergul bilan Taobao item ID — bo'sh bo'lsa showcase ro'yxati ishlatiladi."""
    premium_china_catalog_ids: str = ""
    """true = Taobao API bo'lmasa ham demo vitrina (BTS/uchrashuv). Productionda o'chiring."""
    premium_china_demo_mode: bool = False
    """Xitoy (Taobao) market API — hozircha o'chiq, faqat mahalliy bozor."""
    enable_china_market: bool = False
    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    gemini_embedding_model: str = "models/gemini-embedding-2"
    """clip = local FastEmbed (free, no quota); gemini = Google API; signature = color histogram fallback."""
    visual_search_backend: str = "clip"
    """yolos = YOLOS Fashionpedia crop; heuristic = body zones fallback."""
    fashion_detect_backend: str = "yolos"
    yolos_fashion_model: str = "valentinafevu/yolos-fashionpedia"
    clip_image_model: str = "Qdrant/Unicom-ViT-B-16"
    clip_cache_dir: str = "/app/.cache/fastembed"
    visual_search_use_gemini: bool = False
    """Telegram/CRM publish — CLIP model VPS da OOM qiladi; signature ishlatiladi."""
    publish_visual_embed_lightweight: bool = True
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-20241022"
    embedding_model: str = "text-embedding-3-small"
    site_url: str = "https://bozorliii.uz"
    external_api_timeout_seconds: float = 20.0
    user_rate_limit_per_minute: int = 10
    order_reserve_rate_limit_per_minute: int = 8
    order_lookup_rate_limit_per_minute: int = 12
    eskiz_email: str = ""
    eskiz_password: str = ""
    eskiz_api_token: str = ""
    eskiz_from: str = "4546"
    session_cookie_name: str = "bozor_session"
    enable_online_checkout: bool = False
    telegram_bot_token: str = ""
    telegram_bot_username: str = ""
    """Platforma admini — AI hal qila olmasa CRM da ko'rsatiladi (@username, t.me/...)."""
    platform_support_telegram_username: str = ""
    resend_api_key: str = ""
    resend_from_email: str = "Bozorliii <onboarding@resend.dev>"
    openai_api_key: str = ""
    openai_whisper_model: str = "whisper-1"
    merchant_alert_idle_days: int = 3
    merchant_alert_lead_hours: int = 24
    merchant_crm_webapp_url: str = "http://localhost:3003"

    payment_checkout_base_url: str = "http://localhost:3002"
    click_service_id: str = ""
    click_secret_key: str = ""
    click_merchant_id: str = ""
    """Click Business (o'zini o'zi band qilgan ham) — Merchant API + hosted to'lov sahifasi."""
    click_merchant_user_id: str = ""
    click_api_base_url: str = "https://api.click.uz/v2/merchant"
    click_pay_base_url: str = "https://my.click.uz/services/pay"
    """True bo'lsa checkout rasmiy my.click.uz sahifasiga yo'naltiriladi (self-employed uchun ham)."""
    click_hosted_checkout: bool = True
    payment_callback_ip_whitelist: str = ""
    payment_callback_max_age_seconds: int = 900
    payment_sandbox_mode: bool = False
    """Staging/demo: productionda ham sandbox Click (haqiqiy kalitsiz test)."""
    allow_payment_sandbox_in_production: bool = False
    payment_sandbox_click_service_id: str = "sandbox-service"
    payment_sandbox_click_secret_key: str = "sandbox-click-secret"

    # Q-PAY / PLUM (myuzcard) — self-employed host-to-host (Uzcard/Humo + OTP).
    # Aniq endpoint/maydonlar PLUM biznes kabinetidan (business.plum.uz) olinadi.
    qpay_base_url: str = ""
    qpay_service_id: str = ""
    qpay_merchant_id: str = ""
    qpay_secret_key: str = ""
    qpay_api_key: str = ""

    # Order settlement splitter (UZS)
    finance_order_commission_rate_pct: float = 5.0
    # Mahsulot: do'konchi bazaviy narx + ustama (mijoz narxi). Obuna o'rniga.
    platform_product_markup_pct: float = 15.0
    subscriptions_enabled: bool = False
    """Naqd/terminal pickup: qarz shu limitdan oshsa do'kon avtomatik bloklanadi (UZS)."""
    merchant_debt_block_threshold_uzs: int = 100_000
    finance_delivery_fallback_uzs: int = 25_000
    finance_delivery_base_uzs: int = 12_000
    finance_delivery_uzs_per_km: int = 3_500
    """Xarita geokoder (Yandex Maps) — yetkazish emas."""
    yandex_router_api_key: str = ""

    # BTS Express yetkazish (asosiy logistika)
    bts_api_base_url: str = Field(
        default="https://api.bts.uz",
        validation_alias=AliasChoices("BTS_API_BASE_URL", "TDB_BTS_API_BASE_URL"),
    )
    bts_api_login: str = Field(default="", validation_alias=AliasChoices("BTS_API_LOGIN", "BTS_LOGIN"))
    bts_api_password: str = Field(default="", validation_alias=AliasChoices("BTS_API_PASSWORD", "BTS_PASSWORD"))
    bts_api_token: str = Field(default="", validation_alias=AliasChoices("BTS_API_TOKEN", "TDB_BTS_API_TOKEN"))
    bts_api_mock: bool = Field(default=True, validation_alias=AliasChoices("BTS_API_MOCK", "TDB_BTS_API_MOCK"))
    bts_default_city_code: str = "0101"
    bts_package_id: int = 4
    bts_post_type_id: int = 26
    bts_poll_interval_seconds: int = Field(
        default=1800,
        validation_alias=AliasChoices("BTS_POLL_INTERVAL_SECONDS", "TDB_BTS_POLL_INTERVAL_SECONDS"),
    )
    bts_webhook_secret: str = ""

    # BTS legacy env fallbacks (TDB_BTS_* — asosiy bts_client uchun)
    tdb_bts_api_base_url: str = "https://api.bts.uz"
    tdb_bts_api_token: str = ""
    tdb_bts_api_mock: bool = True
    tdb_bts_poll_interval_seconds: int = 2700

    admin_api_key: str = ""
    # SQLAdmin web panel (faqat platforma egasi uchun — Django-admin uslubidagi panel)
    admin_panel_enabled: bool = True
    admin_panel_username: str = "admin"
    admin_panel_password: str = ""
    admin_panel_secret: str = ""
    # Do'konchilarga to'lov (payout):
    #   batch — reestr fayl + qo'lda tasdiq (self-employed uchun, default)
    #   auto  — payout API orqali to'liq avtomatik (YaTT/MChJ + provayder shartnomasi kerak)
    payout_mode: str = "batch"
    payout_provider: str = "multicard"
    multicard_payout_base_url: str = "https://dev.multicard.uz"
    multicard_payout_app_id: str = ""
    multicard_payout_secret: str = ""
    multicard_payout_mock: bool = True
    price_outlier_multiplier: float = 20.0
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "products"
    media_storage_backend: str = "local"
    """Merchant story ko'rinish muddati (soat)."""
    story_ttl_hours: int = 24
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

    # 4GB split / past VPS — OOM oldini olish
    ai_warmup_on_start: bool = True
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout: int = 30

    @property
    def is_production(self) -> bool:
        if self.production:
            return True
        return self.app_env.strip().lower() in {"production", "prod"}

    @model_validator(mode="after")
    def _enforce_production_safety(self) -> "Settings":
        if self.is_production:
            object.__setattr__(self, "allow_dev_mocks", False)
            if self.premium_china_demo_mode:
                object.__setattr__(self, "premium_china_demo_mode", False)
            object.__setattr__(self, "tdb_bts_api_mock", False)
            object.__setattr__(self, "bts_api_mock", False)
            # publish_visual_embed_lightweight — CLIP merchant-bot da OOM; .env da True qoldiring
            if not self.allow_payment_sandbox_in_production:
                object.__setattr__(self, "payment_sandbox_mode", False)
        return self

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
