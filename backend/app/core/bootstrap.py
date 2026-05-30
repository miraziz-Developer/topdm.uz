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

    if errors:
        raise RuntimeError("Production configuration invalid:\n- " + "\n- ".join(errors))
