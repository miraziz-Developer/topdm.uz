from __future__ import annotations

from app.core.config import Settings, get_settings

# Transient Telegram long-polling failures — aiogram logs these at ERROR but
# retries on its own and keeps working. They are pure noise in Sentry.
_TRANSIENT_TELEGRAM_EXC = {
    "TelegramRetryAfter",
    "TelegramNetworkError",
    "TelegramServerError",
    "RestartingTelegram",
}


def _before_send(event: dict, hint: dict):
    exc_info = hint.get("exc_info")
    if exc_info and exc_info[0] is not None:
        if exc_info[0].__name__ in _TRANSIENT_TELEGRAM_EXC:
            return None
    logger_name = event.get("logger", "")
    if logger_name.startswith("aiogram") and "Failed to fetch updates" in str(
        (event.get("logentry") or {}).get("message", "")
    ):
        return None
    return event


def init_sentry(*, settings: Settings | None = None, extra_integrations: list | None = None) -> None:
    cfg = settings or get_settings()
    dsn = cfg.sentry_dsn.strip()
    if not dsn:
        return
    try:
        import sentry_sdk
    except ImportError:
        return

    integrations = list(extra_integrations or [])
    if not extra_integrations:
        try:
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
            from sentry_sdk.integrations.starlette import StarletteIntegration

            integrations.extend(
                [
                    StarletteIntegration(transaction_style="endpoint"),
                    FastApiIntegration(transaction_style="endpoint"),
                    SqlalchemyIntegration(),
                ]
            )
        except ImportError:
            pass

    traces_sample_rate = 0.15 if cfg.is_production else 1.0
    sentry_sdk.init(
        dsn=dsn,
        environment=cfg.app_env,
        release=cfg.app_name,
        traces_sample_rate=traces_sample_rate,
        send_default_pii=False,
        integrations=integrations,
        before_send=_before_send,
    )

    try:
        from sentry_sdk.integrations.logging import ignore_logger

        # aiogram's polling loop retries transient failures itself; the ERROR
        # log lines it emits meanwhile should not page anyone.
        ignore_logger("aiogram.dispatcher")
    except Exception:
        pass
