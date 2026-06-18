from __future__ import annotations

from app.core.config import Settings

_INSECURE_JWT_SECRETS = frozenset(
    {
        "",
        "change-me",
        "change-me-in-production",
        "changeme",
        "secret",
    }
)


def validate_settings(settings: Settings) -> None:
    """Fail fast when production env is misconfigured."""
    if not settings.is_production:
        return

    errors: list[str] = []

    if settings.app_debug:
        errors.append("APP_DEBUG must be false in production")

    secret = settings.jwt_secret.strip()
    if secret.lower() in _INSECURE_JWT_SECRETS or len(secret) < 32:
        errors.append("JWT_SECRET must be set and at least 32 characters")

    if not settings.cors_origins.strip():
        errors.append("CORS_ORIGINS must list your HTTPS site URLs (comma-separated)")

    if not settings.telegram_bot_token.strip():
        errors.append("TELEGRAM_BOT_TOKEN is required for Telegram OTP auth")

    if not settings.admin_api_key.strip():
        errors.append("ADMIN_API_KEY must be set in production")

    if not settings.groq_api_key.strip():
        errors.append("GROQ_API_KEY is required for AI chat and stylist in production")

    has_text_embed = bool(settings.openai_api_key.strip() or settings.google_api_key.strip())
    if not has_text_embed:
        errors.append(
            "OPENAI_API_KEY or GOOGLE_API_KEY is required for catalog embeddings in production"
        )

    if settings.allow_dev_mocks:
        errors.append("ALLOW_DEV_MOCKS must be false in production")

    if settings.tdb_bts_api_mock or settings.bts_api_mock:
        errors.append("BTS mock flags must be false in production")

    has_bts_creds = bool(
        (settings.bts_api_token or settings.tdb_bts_api_token or "").strip()
    ) or (
        (settings.bts_api_login or "").strip() and (settings.bts_api_password or "").strip()
    )
    if has_bts_creds and not (settings.bts_webhook_secret or "").strip():
        errors.append("BTS_WEBHOOK_SECRET required when BTS API credentials are configured")

    if settings.enable_online_checkout and not settings.payment_sandbox_mode:
        has_click = bool(settings.click_service_id and settings.click_secret_key)
        if not has_click:
            errors.append(
                "CLICK_* credentials required when ENABLE_ONLINE_CHECKOUT=true"
            )

    backend = (settings.media_storage_backend or "local").strip().lower()
    if backend == "s3":
        if not settings.s3_bucket or not settings.s3_access_key_id or not settings.s3_secret_access_key:
            errors.append("S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY required for media_storage_backend=s3")

    if errors:
        raise RuntimeError("Production configuration invalid:\n- " + "\n- ".join(errors))
