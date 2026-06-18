from __future__ import annotations

from app.core.config import Settings, get_settings


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
    )
