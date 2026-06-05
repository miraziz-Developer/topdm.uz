from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.payments.order_payment_service import OrderPaymentService
from app.core.config import Settings, get_settings


class PaymentGatewayService:
    """Unified Click/Payme facade for order checkout and merchant debt recovery."""

    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._orders = OrderPaymentService(session, self._settings)

    def assert_online_enabled(self) -> None:
        if not self._settings.enable_online_checkout:
            raise ValueError("online_checkout_disabled")
        if self._settings.is_production and self._settings.payment_sandbox_mode:
            return
        if self._settings.is_production:
            has_click = bool(self._settings.click_service_id and self._settings.click_secret_key)
            has_payme = bool(self._settings.payme_merchant_id and self._settings.payme_secret_key)
            if not has_click and not has_payme:
                raise ValueError("payment_credentials_missing")

    async def create_order_checkout(
        self,
        *,
        order_ids: list[UUID],
        amount_uzs: int,
        provider: str,
        customer_phone: str | None = None,
    ) -> dict:
        self.assert_online_enabled()
        row = await self._orders.create_checkout_for_orders(
            order_ids=order_ids,
            amount_uzs=amount_uzs,
            provider=provider,
            customer_phone=customer_phone,
        )
        await self._session.commit()
        return {
            "checkout_id": str(row.id),
            "amount_uzs": int(row.amount_uzs),
            "provider": row.provider,
            "purpose": row.purpose or "order",
        }

    async def process_click_webhook(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._orders.process_click_callback(payload)

    async def process_payme_webhook(self, body: dict[str, Any]) -> dict[str, Any]:
        return await self._orders.handle_payme_rpc(body)

    def build_redirect_url(self, checkout_id: UUID, provider: str) -> str:
        base = self._settings.payment_checkout_base_url.rstrip("/")
        return f"{base}/checkout/pay?checkout_id={checkout_id}&provider={provider.strip().lower()}"
