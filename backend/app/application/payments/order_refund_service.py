"""Bekor qilingan to'langan buyurtmalar uchun Click qaytarish + escrow reversal."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.finance.transaction_splitter import TransactionSplitterError, TransactionSplitterService
from app.application.payments.click_merchant_api import ClickMerchantAPIError, ClickMerchantClient
from app.infrastructure.db.models import OrderModel
from app.infrastructure.repositories.order_payment_repo import OrderPaymentRepository

ONLINE_REFUND_METHODS = frozenset({"click"})


class OrderRefundService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._checkout_repo = OrderPaymentRepository(session)
        self._click = ClickMerchantClient()

    async def refund_cancelled_order(self, order: OrderModel) -> dict[str, Any]:
        """Idempotent: paid Click checkout bo'lsa provider reversal + escrow qaytarish."""
        method = (order.payment_method or "").strip().lower()
        if method not in ONLINE_REFUND_METHODS:
            return {"status": "skipped", "reason": "not_online_payment"}

        checkout = await self._checkout_repo.find_latest_for_order(order.id)
        if not checkout or (checkout.status or "").lower() != "success":
            return {"status": "skipped", "reason": "checkout_not_paid"}

        meta = dict(checkout.meta or {})
        if meta.get("refunded_at"):
            return {
                "status": "ok",
                "idempotent": True,
                "provider": checkout.provider,
                "refunded_at": meta.get("refunded_at"),
            }

        payment_id = (checkout.provider_trans_id or meta.get("click_trans_id") or "").strip()
        if not payment_id:
            logger.warning(
                "order_refund_missing_payment_id",
                extra={"order_id": str(order.id), "checkout_id": str(checkout.id)},
            )
            return {"status": "error", "reason": "missing_payment_id"}

        click_result: dict[str, Any] | None = None
        if (checkout.provider or "").lower() == "click":
            try:
                click_result = await self._click.refund_payment(payment_id=payment_id)
            except ClickMerchantAPIError as exc:
                logger.exception(
                    "click_refund_failed",
                    extra={"order_id": str(order.id), "payment_id": payment_id, "detail": str(exc)},
                )
                return {"status": "error", "reason": "click_refund_failed", "detail": str(exc)}

        escrow_result: dict[str, Any] | None = None
        try:
            escrow_result = await TransactionSplitterService(self._session).refund_order_payment(order.id)
        except TransactionSplitterError as exc:
            code = str(exc)
            if "platform_transaction_not_found" in code:
                escrow_result = {"status": "skipped", "reason": "no_escrow"}
            elif "cannot_refund_after_release" in code:
                logger.error(
                    "order_refund_after_escrow_release",
                    extra={"order_id": str(order.id)},
                )
                return {"status": "error", "reason": "escrow_already_released"}
            else:
                raise

        meta["refunded_at"] = datetime.now(timezone.utc).isoformat()
        meta["refund_provider"] = checkout.provider
        meta["refund_payment_id"] = payment_id
        if click_result:
            meta["refund_click"] = click_result
        checkout.meta = meta
        checkout.status = "refunded"
        await self._session.flush()

        logger.info(
            "order_refund_completed",
            extra={
                "order_id": str(order.id),
                "checkout_id": str(checkout.id),
                "payment_id": payment_id,
                "mock": bool(click_result and click_result.get("mock")),
            },
        )
        return {
            "status": "ok",
            "provider": checkout.provider,
            "payment_id": payment_id,
            "click": click_result,
            "escrow": escrow_result,
        }
