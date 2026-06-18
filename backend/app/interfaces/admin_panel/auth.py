"""Admin panel uchun login/parol autentifikatsiyasi (sessiyaga asoslangan)."""
from __future__ import annotations

import hmac

from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from app.core.config import Settings


class AdminPanelAuth(AuthenticationBackend):
    def __init__(self, settings: Settings) -> None:
        secret = (settings.admin_panel_secret or settings.admin_api_key or "change-me").strip()
        super().__init__(secret_key=secret)
        self._username = (settings.admin_panel_username or "admin").strip()
        self._password = (settings.admin_panel_password or "").strip()

    def _check(self, username: str, password: str) -> bool:
        if not self._password:
            return False
        user_ok = hmac.compare_digest(username.strip(), self._username)
        pass_ok = hmac.compare_digest(password, self._password)
        return user_ok and pass_ok

    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = str(form.get("username") or "")
        password = str(form.get("password") or "")
        if self._check(username, password):
            request.session.update({"admin_panel": "ok"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return request.session.get("admin_panel") == "ok"
