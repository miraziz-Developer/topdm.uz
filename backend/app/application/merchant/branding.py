from __future__ import annotations

from app.core.config import get_settings

POWERED_BY_TAGLINE = "O'z onlayn do'koningizni 5 daqiqada tekin oching"


def powered_by_line(*, html: bool = False) -> str:
    settings = get_settings()
    base = settings.site_url.rstrip("/")
    if html:
        return (
            f'<a href="{base}/register" style="color:#6366f1;text-decoration:none;">'
            f"Powered by Bozorliii — {POWERED_BY_TAGLINE}</a>"
        )
    return f"Powered by Bozorliii — {POWERED_BY_TAGLINE}\n{base}/register"


def powered_by_telegram_footer() -> str:
    return f"\n\n—\n{powered_by_line()}"
