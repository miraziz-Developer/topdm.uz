from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.finance.transaction_splitter import TransactionSplitterService
from app.application.payments.click_verify import verify_click_callback
from app.application.payments.payme_merchant_api import (
    parse_payme_account,
    payme_error,
    payme_result,
    payme_rpc_error,
    payme_time_ms,
)
from app.application.payments.service import PaymentService
from app.core.config import Settings, get_settings
from app.infrastructure.db.models import OrderModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.order_payment_repo import OrderPaymentRepository
from app.infrastructure.repositories.payment_repo import PaymentRepository
from app.models.order_checkout_payment import OrderCheckoutPaymentModel
from app.schemas.orders import OrderStatus


class OrderPaymentService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._checkout_repo = OrderPaymentRepository(session)
        self._coin_payments = PaymentRepository(session)
        self._marketplace = MarketplaceRepository(session)
        self._splitter = TransactionSplitterService(session, self._settings)

    async def create_checkout_for_orders(
        self,
        *,
        order_ids: list[UUID],
        amount_uzs: int,
        provider: str,
        customer_phone: str | None = None,
    ) -> OrderCheckoutPaymentModel:
        if not order_ids:
            raise ValueError("order_ids_required")
        prov = provider.strip().lower()
        if prov not in ("click", "payme"):
            raise ValueError("invalid_provider")

        total = 0
        for oid in order_ids:
            order = await self._marketplace.get_order_by_id(oid)
            if not order:
                raise ValueError("order_not_found")
            total += int(order.total_price)

        if int(amount_uzs) != total:
            raise ValueError("amount_mismatch")

        return await self._checkout_repo.create_pending(
            order_ids=order_ids,
            amount_uzs=int(amount_uzs),
            provider=prov,
            customer_phone=customer_phone,
        )

    async def resolve_payment_target(self, merchant_trans_id: UUID) -> str:
        coin_tx = await self._coin_payments.get_transaction(merchant_trans_id)
        if coin_tx:
            return "coin"
        checkout = await self._checkout_repo.get_checkout(merchant_trans_id)
        if checkout:
            return "checkout"
        order = await self._marketplace.get_order_by_id(merchant_trans_id)
        if order:
            return "order_legacy"
        raise ValueError("transaction_not_found")

    async def process_click_callback(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not verify_click_callback(payload, self._settings):
            raise ValueError("invalid_signature")

        merchant_trans_id = str(payload.get("merchant_trans_id", "")).strip()
        click_trans_id = str(payload.get("click_trans_id", "")).strip()
        action = int(payload.get("action", -1))
        error_code = int(payload.get("error", -1))

        try:
            tx_id = UUID(merchant_trans_id)
        except ValueError as exc:
            raise ValueError("invalid_merchant_trans_id") from exc

        target = await self.resolve_payment_target(tx_id)
        if target == "coin":
            return await PaymentService(self._session, self._settings).process_click_callback(payload)

        if click_trans_id:
            existing = await self._checkout_repo.get_by_provider_trans_id_for_update(
                provider="click",
                provider_trans_id=click_trans_id,
            )
            if existing and existing.status == "success":
                await self._session.commit()
                return self._click_ok(click_trans_id, merchant_trans_id, already=True)

        if action != 1 or error_code != 0:
            await self._fail_checkout_click(tx_id, target)
            raise ValueError("payment_not_successful")

        if target == "checkout":
            checkout = await self._checkout_repo.get_checkout_for_update(tx_id)
            if not checkout:
                raise ValueError("checkout_not_found")
            return await self._fulfill_checkout_click(checkout, click_trans_id, merchant_trans_id, payload)

        return await self._fulfill_legacy_order_click(tx_id, click_trans_id, merchant_trans_id, payload)

    async def handle_payme_rpc(self, body: dict[str, Any]) -> dict[str, Any]:
        req_id = body.get("id")
        method = str(body.get("method", "")).strip()
        params = body.get("params") or {}
        account = params.get("account") or {}

        try:
            account_id = parse_payme_account(account)
        except ValueError:
            return payme_rpc_error(req_id, -31050)

        checkout = await self._checkout_repo.get_checkout(account_id)
        order = None if checkout else await self._marketplace.get_order_by_id(account_id)

        if not checkout and not order:
            return payme_rpc_error(req_id, -31050)

        amount_tiyin = int(params.get("amount", 0))
        expected_tiyin = (
            int(checkout.amount_uzs) * 100
            if checkout
            else int(order.total_price) * 100  # type: ignore[union-attr]
        )

        if method == "CheckPerformTransaction":
            if amount_tiyin != expected_tiyin:
                return payme_rpc_error(req_id, -31051)
            return payme_result(req_id, {"allow": True})

        if method == "CreateTransaction":
            if amount_tiyin != expected_tiyin:
                return payme_rpc_error(req_id, -31051)
            payme_id = str(params.get("id", ""))
            if checkout:
                if checkout.status == "success" and checkout.provider_trans_id:
                    return payme_result(
                        req_id,
                        {
                            "create_time": payme_time_ms(),
                            "transaction": str(checkout.id),
                            "state": 2,
                        },
                    )
                if checkout.status == "pending":
                    checkout.meta = {**(checkout.meta or {}), "payme_create_id": payme_id}
                    checkout.provider_trans_id = payme_id
                    await self._session.flush()
                return payme_result(
                    req_id,
                    {
                        "create_time": payme_time_ms(),
                        "transaction": str(checkout.id),
                        "state": 1,
                    },
                )
            return payme_result(
                req_id,
                {
                    "create_time": payme_time_ms(),
                    "transaction": str(order.id),  # type: ignore[union-attr]
                    "state": 1,
                },
            )

        if method == "PerformTransaction":
            payme_id = str(params.get("id", ""))
            if checkout:
                if checkout.status == "success":
                    await self._session.commit()
                    return payme_result(
                        req_id,
                        {
                            "transaction": str(checkout.id),
                            "state": 2,
                            "perform_time": payme_time_ms(),
                        },
                    )
                billing = {
                    "provider": "payme",
                    "payme_trans_id": payme_id,
                    "amount": checkout.amount_uzs,
                    "idempotency_key": f"payme:{payme_id}",
                }
                await self._fulfill_checkout(checkout, provider_trans_id=payme_id, billing=billing)
                await self._session.commit()
                return payme_result(
                    req_id,
                    {
                        "transaction": str(checkout.id),
                        "state": 2,
                        "perform_time": payme_time_ms(),
                    },
                )

            billing = {
                "provider": "payme",
                "payme_trans_id": payme_id,
                "amount": int(order.total_price),  # type: ignore[union-attr]
                "idempotency_key": f"payme:{payme_id}:{order.id}",  # type: ignore[union-attr]
            }
            await self._fulfill_single_order(order, billing=billing)  # type: ignore[arg-type]
            await self._session.commit()
            return payme_result(
                req_id,
                {
                    "transaction": str(order.id),  # type: ignore[union-attr]
                    "state": 2,
                    "perform_time": payme_time_ms(),
                },
            )

        if method == "CheckTransaction":
            state = 2 if (checkout and checkout.status == "success") else 1
            tx = str(checkout.id) if checkout else str(order.id)  # type: ignore[union-attr]
            return payme_result(req_id, {"transaction": tx, "state": state, "create_time": payme_time_ms()})

        if method == "CancelTransaction":
            if checkout and checkout.status == "pending":
                await self._checkout_repo.mark_failed(checkout)
                await self._session.commit()
            return payme_result(req_id, {"transaction": str(account_id), "state": -1, "cancel_time": payme_time_ms()})

        return payme_rpc_error(req_id, -31008)

    async def _fail_checkout_click(self, tx_id: UUID, target: str) -> None:
        try:
            if target == "checkout":
                row = await self._checkout_repo.get_checkout_for_update(tx_id)
                if row and row.status == "pending":
                    await self._checkout_repo.mark_failed(row)
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            raise

    async def _fulfill_checkout_click(
        self,
        checkout: OrderCheckoutPaymentModel,
        click_trans_id: str,
        merchant_trans_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        if checkout.status == "success":
            await self._session.commit()
            return self._click_ok(click_trans_id, merchant_trans_id, already=True)

        amount = int(payload.get("amount", 0))
        if amount and int(checkout.amount_uzs) != int(amount):
            await self._session.rollback()
            raise ValueError("amount_mismatch")

        billing = {
            "provider": "click",
            "click_trans_id": click_trans_id,
            "amount": checkout.amount_uzs,
            "idempotency_key": f"click:{click_trans_id}",
            "raw": payload,
        }
        await self._fulfill_checkout(checkout, provider_trans_id=click_trans_id, billing=billing)
        await self._session.commit()
        return self._click_ok(click_trans_id, merchant_trans_id)

    async def _fulfill_legacy_order_click(
        self,
        order_id: UUID,
        click_trans_id: str,
        merchant_trans_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        order = await self._marketplace.get_order_by_id(order_id)
        if not order:
            raise ValueError("order_not_found")

        amount = int(payload.get("amount", 0))
        if amount and int(order.total_price) != int(amount):
            raise ValueError("amount_mismatch")

        billing = {
            "provider": "click",
            "click_trans_id": click_trans_id,
            "amount": int(order.total_price),
            "idempotency_key": f"click:{click_trans_id}:{order_id}",
            "raw": payload,
        }
        await self._fulfill_single_order(order, billing=billing)
        await self._session.commit()
        return self._click_ok(click_trans_id, merchant_trans_id)

    async def _fulfill_checkout(
        self,
        checkout: OrderCheckoutPaymentModel,
        *,
        provider_trans_id: str,
        billing: dict[str, Any],
    ) -> None:
        if checkout.status == "success":
            return

        order_ids = [UUID(str(x)) for x in (checkout.order_ids or [])]
        if not order_ids:
            raise ValueError("checkout_empty")

        await self._checkout_repo.mark_success(checkout, provider_trans_id=provider_trans_id)

        total = int(checkout.amount_uzs)
        for oid in order_ids:
            order = await self._marketplace.get_order_by_id(oid)
            if not order:
                continue
            share = int(order.total_price)
            order_billing = self._order_billing(order, billing)
            order_billing["idempotency_key"] = f"{billing.get('idempotency_key', 'pay')}:{oid}"
            await self._confirm_order_paid(order, order_billing)

    async def _fulfill_single_order(self, order: OrderModel, *, billing: dict[str, Any]) -> None:
        await self._confirm_order_paid(order, self._order_billing(order, billing))

    def _order_billing(self, order: OrderModel, billing: dict[str, Any]) -> dict[str, Any]:
        product_subtotal = Decimal(int(order.total_price))
        delivery_share = Decimal(int(order.delivery_cost_uzs or 0))
        total_received = product_subtotal + delivery_share
        return {
            **billing,
            "amount": int(total_received),
            "total_received": total_received,
            "product_subtotal": product_subtotal,
            "delivery_share_uzs": delivery_share,
            "yandex_quote_uzs": delivery_share,
        }

    async def _confirm_order_paid(self, order: OrderModel, billing: dict[str, Any]) -> None:
        if order.status in (OrderStatus.cancelled.value, OrderStatus.completed.value):
            return

        stmt = select(OrderModel).where(OrderModel.id == order.id).with_for_update()
        result = await self._session.execute(stmt)
        locked = result.scalar_one_or_none()
        if not locked:
            return

        if locked.status == OrderStatus.reserved.value:
            locked.status = OrderStatus.confirmed.value
            await self._session.flush()

        await self._splitter.process_order_payment_success(locked.id, billing)

        if (locked.fulfillment_type or "").lower() == "delivery":
            from app.application.delivery.delivery_dispatch_service import DeliveryDispatchService

            try:
                await DeliveryDispatchService(self._session).activate_courier_after_payment(locked.id)
            except Exception:
                logger.bind(order_id=str(locked.id)).warning("yandex_accept_after_payment_failed")

    @staticmethod
    def _click_ok(
        click_trans_id: str,
        merchant_trans_id: str,
        *,
        already: bool = False,
    ) -> dict[str, Any]:
        out: dict[str, Any] = {
            "error": 0,
            "error_note": "Success",
            "click_trans_id": click_trans_id,
            "merchant_trans_id": merchant_trans_id,
        }
        if already:
            out["already_processed"] = True
        return out
