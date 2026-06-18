"""SQLAdmin panelni FastAPI ilovasiga ulash."""
from __future__ import annotations

from fastapi import FastAPI
from loguru import logger
from sqladmin import Admin

from app.core.config import Settings
from app.infrastructure.db.session import engine
from app.interfaces.admin_panel.auth import AdminPanelAuth
from app.interfaces.admin_panel.views import ALL_CUSTOM_VIEWS, ALL_MODEL_VIEWS


def setup_admin_panel(app: FastAPI, settings: Settings) -> None:
    """`/admin` ostida web panelni o'rnatadi (faqat parol o'rnatilgan bo'lsa)."""
    if not settings.admin_panel_enabled:
        return
    if not (settings.admin_panel_password or "").strip():
        logger.warning(
            "Admin panel o'chirilgan: ADMIN_PANEL_PASSWORD o'rnatilmagan. "
            "Yoqish uchun ADMIN_PANEL_PASSWORD ni belgilang."
        )
        return

    auth_backend = AdminPanelAuth(settings)
    admin = Admin(
        app=app,
        engine=engine,
        title=f"{settings.app_name} — Admin",
        base_url="/admin",
        authentication_backend=auth_backend,
    )
    for view in ALL_MODEL_VIEWS:
        admin.add_view(view)
    for view in ALL_CUSTOM_VIEWS:
        admin.add_view(view)
    logger.info("Admin panel /admin da ulandi ({} jadval).", len(ALL_MODEL_VIEWS))
