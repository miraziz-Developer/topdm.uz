from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.finance.transaction_splitter import TransactionSplitterService
from app.application.payments.click_shop_api import (
    CLICK_ALREADY_PAID,
    CLICK_BAD_REQUEST,
    CLICK_CANCELLED,
    CLICK_INVALID_AMOUNT,
    CLICK_OK,
    CLICK_SIGN_FAILED,
    CLICK_TRANSACTION_NOT_FOUND,
    click_amount_uzs,
    click_response,
    parse_merchant_trans_id,
    stable_prepare_id,
    verify_click_shop_signature,
)
from app.application.payments.checkout_cancel import cancel_checkout_reserved_orders
from app.application.payments.service import PaymentService
from app.core.config import Settings, get_settings
from app.infrastructure.db.models import OrderModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.order_payment_repo import OrderPaymentRepository
from app.infrastructure.repositories.payment_repo import PaymentRepository
from app.models.order_checkout_payment import OrderCheckoutPaymentModel
from app.schemas.orders import OrderStatus


class OrderPaymentService:
    @staticmethod
    def checkout_url(*, checkout_id: UUID, amount_uzs: int, settings: Settings | None = None) -> str:
        cfg = settings or get_settings()
        base = (cfg.payment_checkout_base_url or cfg.site_url or "https://bozorliii.online").rstrip("/")
        return f"{base}/checkout/click?checkout_id={checkout_id}&amount={int(amount_uzs)}"

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
        extra_amount_uzs: int = 0,
    ) -> OrderCheckoutPaymentModel:
        if not order_ids:
            raise ValueError("order_ids_required")
        prov = provider.strip().lower()
        if prov not in ("click",):
            raise ValueError("invalid_provider")

        product_total = 0
        delivery_surcharge = 0
        for oid in order_ids:
            order = await self._marketplace.get_order_by_id(oid)
            if not order:
                raise ValueError("order_not_found")
            product_total += int(order.total_price)
            delivery_surcharge += int(order.delivery_cost_uzs or 0)

        expected = product_total + max(int(extra_amount_uzs), delivery_surcharge)
        if int(amount_uzs) != expected:
            raise ValueError("amount_mismatch")

        checkout = await self._checkout_repo.create_pending(
            order_ids=order_ids,
            amount_uzs=int(amount_uzs),
            provider=prov,
            customer_phone=customer_phone,
        )
        if int(extra_amount_uzs) > 0 and delivery_surcharge <= 0:
            checkout.meta = {**(checkout.meta or {}), "delivery_surcharge_uzs": int(extra_amount_uzs)}
            await self._session.flush()
        return checkout

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
        """Click SHOP API — action 0 Prepare, action 1 Complete."""
        if not verify_click_shop_signature(payload, self._settings):
            return click_response(
                click_trans_id=str(payload.get("click_trans_id") or ""),
                merchant_trans_id=str(payload.get("merchant_trans_id") or ""),
                error=CLICK_SIGN_FAILED,
                error_note="SIGN CHECK FAILED!",
            )

        click_trans_id = str(payload.get("click_trans_id") or "").strip()
        merchant_trans_id = str(payload.get("merchant_trans_id") or "").strip()
        action = int(payload.get("action", -1))

        tx_id = parse_merchant_trans_id(payload)
        if tx_id is None:
            return click_response(
                click_trans_id=click_trans_id,
                merchant_trans_id=merchant_trans_id,
                error=CLICK_TRANSACTION_NOT_FOUND,
                error_note="Transaction not found",
            )

        target = await self.resolve_payment_target(tx_id)
        if target == "coin":
            return await PaymentService(self._session, self._settings).process_click_callback(payload)

        if action == 0:
            return await self._click_prepare(tx_id, target, payload)
        if action == 1:
            return await self._click_complete(tx_id, target, payload)

        return click_response(
            click_trans_id=click_trans_id,
            merchant_trans_id=merchant_trans_id,
            error=CLICK_BAD_REQUEST,
            error_note="Action not found",
        )

    async def _click_prepare(self, tx_id: UUID, target: str, payload: dict[str, Any]) -> dict[str, Any]:
        click_trans_id = str(payload.get("click_trans_id") or "")
        merchant_trans_id = str(payload.get("merchant_trans_id") or "")
        amount = click_amount_uzs(payload)
        prepare_id = stable_prepare_id(tx_id)

        if target == "checkout":
            checkout = await self._checkout_repo.get_checkout_for_update(tx_id)
            if not checkout:
                return click_response(
                    click_trans_id=click_trans_id,
                    merchant_trans_id=merchant_trans_id,
                    error=CLICK_TRANSACTION_NOT_FOUND,
                    error_note="Checkout not found",
                )
            if checkout.status == "success":
                return click_response(
                    click_trans_id=click_trans_id,
                    merchant_trans_id=merchant_trans_id,
                    merchant_prepare_id=prepare_id,
                    error=CLICK_ALREADY_PAID,
                    error_note="Already paid",
                )
            if int(checkout.amount_uzs) != amount:
                return click_response(
                    click_trans_id=click_trans_id,
                    merchant_trans_id=merchant_trans_id,
                    error=CLICK_INVALID_AMOUNT,
                    error_note="Invalid amount",
                )
            meta = dict(checkout.meta or {})
            meta["click_prepare_id"] = prepare_id
            meta["click_trans_id"] = click_trans_id
            checkout.meta = meta
            await self._session.flush()
            await self._session.commit()
            return click_response(
                click_trans_id=click_trans_id,
                merchant_trans_id=merchant_trans_id,
                merchant_prepare_id=prepare_id,
                error=CLICK_OK,
                error_note="Success",
            )

        order = await self._marketplace.get_order_by_id(tx_id)
        if not order:
            return click_response(
                click_trans_id=click_trans_id,
                merchant_trans_id=merchant_trans_id,
                error=CLICK_TRANSACTION_NOT_FOUND,
                error_note="Order not found",
            )
        if order.status in (OrderStatus.completed.value, OrderStatus.confirmed.value):
            return click_response(
                click_trans_id=click_trans_id,
                merchant_trans_id=merchant_trans_id,
                merchant_prepare_id=prepare_id,
                error=CLICK_ALREADY_PAID,
                error_note="Already paid",
            )
        expected = int(order.total_price) + int(order.delivery_cost_uzs or 0)
        if amount and expected != amount:
            return click_response(
                click_trans_id=click_trans_id,
                merchant_trans_id=merchant_trans_id,
                error=CLICK_INVALID_AMOUNT,
                error_note="Invalid amount",
            )
        await self._session.commit()
        return click_response(
            click_trans_id=click_trans_id,
            merchant_trans_id=merchant_trans_id,
            merchant_prepare_id=prepare_id,
            error=CLICK_OK,
            error_note="Success",
        )

    async def _click_complete(self, tx_id: UUID, target: str, payload: dict[str, Any]) -> dict[str, Any]:
        click_trans_id = str(payload.get("click_trans_id") or "").strip()
        merchant_trans_id = str(payload.get("merchant_trans_id") or "").strip()
        error_code = int(payload.get("error", -1))
        prepare_id_raw = str(payload.get("merchant_prepare_id") or "").strip()
        amount = click_amount_uzs(payload)

        if error_code != 0:
            await self._fail_checkout_click(tx_id, target)
            return click_response(
                click_trans_id=click_trans_id,
                merchant_trans_id=merchant_trans_id,
                merchant_confirm_id=int(prepare_id_raw) if prepare_id_raw.isdigit() else None,
                error=CLICK_CANCELLED,
                error_note="Payment cancelled",
            )

        if click_trans_id:
            existing = await self._checkout_repo.get_by_provider_trans_id_for_update(
                provider="click",
                provider_trans_id=click_trans_id,
            )
            if existing and existing.status == "success":
                await self._session.commit()
                return self._click_ok(click_trans_id, merchant_trans_id, already=True)

        if target == "checkout":
            checkout = await self._checkout_repo.get_checkout_for_update(tx_id)
            if not checkout:
                raise ValueError("checkout_not_found")
            expected_prepare = str((checkout.meta or {}).get("click_prepare_id") or stable_prepare_id(tx_id))
            if prepare_id_raw and prepare_id_raw != expected_prepare:
                await self._session.rollback()
                return click_response(
                    click_trans_id=click_trans_id,
                    merchant_trans_id=merchant_trans_id,
                    error=CLICK_BAD_REQUEST,
                    error_note="Invalid prepare id",
                )
            return await self._fulfill_checkout_click(checkout, click_trans_id, merchant_trans_id, payload)

        return await self._fulfill_legacy_order_click(tx_id, click_trans_id, merchant_trans_id, payload)

    async def _fail_checkout_click(self, tx_id: UUID, target: str) -> None:
        try:
            if target == "checkout":
                row = await self._checkout_repo.get_checkout_for_update(tx_id)
                if row and row.status == "pending":
                    await self._checkout_repo.mark_failed(row)
                    released = await cancel_checkout_reserved_orders(
                        self._session,
                        row,
                        reason="Click to'lov bekor qilindi",
                    )
                    if released:
                        await self._notify_merchant_checkout_cancelled(row, "Click to'lov bekor qilindi")
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            raise

    async def _notify_merchant_checkout_paid(self, checkout: OrderCheckoutPaymentModel, order_ids: list[UUID]) -> None:
        from app.application.merchant.merchant_order_notify import notify_merchant_payment_received
        from app.infrastructure.db.models import ProductModel, ShopModel
        from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway

        notifier = TelegramNotifierGateway(self._settings.telegram_bot_token)
        for oid in order_ids:
            order = await self._marketplace.get_order_by_id(oid)
            if not order:
                continue
            product = await self._session.get(ProductModel, order.product_id)
            shop = await self._session.get(ShopModel, order.shop_id)
            if not shop or not product:
                continue
            pickup = ""
            if order.pickup_date:
                pickup = f"Olib ketish · {order.pickup_date.isoformat()}"
                if order.pickup_time:
                    pickup += f" {order.pickup_time}"
            try:
                await notify_merchant_payment_received(
                    notifier,
                    shop=shop,
                    order=order,
                    product_name=product.name,
                    fulfillment_label=pickup or "Olib ketish",
                )
            except Exception:
                logger.exception("merchant_payment_notify_failed order_id={}", oid)

    async def _notify_merchant_checkout_cancelled(
        self,
        checkout: OrderCheckoutPaymentModel,
        reason: str,
    ) -> None:
        from app.application.merchant.merchant_order_notify import notify_merchant_order_cancelled
        from app.infrastructure.db.models import ProductModel, ShopModel
        from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway

        notifier = TelegramNotifierGateway(self._settings.telegram_bot_token)
        for oid_raw in checkout.order_ids or []:
            try:
                oid = UUID(str(oid_raw))
            except ValueError:
                continue
            order = await self._marketplace.get_order_by_id(oid)
            if not order:
                continue
            product = await self._session.get(ProductModel, order.product_id)
            shop = await self._session.get(ShopModel, order.shop_id)
            if not shop or not product:
                continue
            try:
                await notify_merchant_order_cancelled(
                    notifier,
                    shop=shop,
                    order=order,
                    product_name=product.name,
                    reason=reason,
                )
            except Exception:
                logger.exception("merchant_cancel_notify_failed order_id={}", oid)

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
        order_total = int(order.total_price) + int(order.delivery_cost_uzs or 0)
        if amount and order_total != int(amount):
            raise ValueError("amount_mismatch")

        billing = {
            "provider": "click",
            "click_trans_id": click_trans_id,
            "amount": order_total,
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

        if (checkout.purpose or "order") == "merchant_debt":
            await self._fulfill_debt_checkout(checkout, provider_trans_id=provider_trans_id, billing=billing)
            return

        if (checkout.purpose or "order") == "banner":
            await self._fulfill_banner_checkout(checkout, provider_trans_id=provider_trans_id, billing=billing)
            return

        order_ids = [UUID(str(x)) for x in (checkout.order_ids or [])]
        if not order_ids:
            raise ValueError("checkout_empty")

        await self._checkout_repo.mark_success(checkout, provider_trans_id=provider_trans_id)

        dispatch_order_id: UUID | None = None
        for oid in order_ids:
            order = await self._marketplace.get_order_by_id(oid)
            if not order:
                continue
            if (order.fulfillment_type or "").lower() == "delivery" and dispatch_order_id is None:
                dispatch_order_id = oid
            order_billing = {
                **billing,
                "idempotency_key": f"{billing.get('idempotency_key', 'pay')}:{oid}",
            }
            await self._confirm_order_paid(order, order_billing, dispatch_courier=False)

        if dispatch_order_id is not None:
            from app.application.delivery.delivery_dispatch_service import DeliveryDispatchService

            try:
                await DeliveryDispatchService(self._session).activate_courier_after_payment(dispatch_order_id)
            except Exception:
                logger.bind(order_id=str(dispatch_order_id)).warning("bts_dispatch_after_payment_failed")

        await self._notify_merchant_checkout_paid(checkout, order_ids)

    async def _fulfill_single_order(self, order: OrderModel, *, billing: dict[str, Any]) -> None:
        await self._confirm_order_paid(order, billing)

    def _order_billing(
        self,
        order: OrderModel,
        billing: dict[str, Any],
        *,
        merchant_base_unit_uzs: int,
    ) -> dict[str, Any]:
        from app.application.pricing.product_markup import order_line_totals

        delivery_share = Decimal(int(order.delivery_cost_uzs or 0))
        merchant_sub, customer_goods, markup = order_line_totals(
            merchant_base_unit_uzs,
            int(order.quantity),
        )
        total_received = Decimal(customer_goods) + delivery_share
        return {
            **billing,
            "amount": int(total_received),
            "total_received": total_received,
            "product_subtotal": Decimal(customer_goods),
            "merchant_subtotal_uzs": merchant_sub,
            "platform_markup_uzs": markup,
            "delivery_share_uzs": delivery_share,
            "bts_quote_uzs": delivery_share,
            "yandex_quote_uzs": delivery_share,
        }

    async def _fulfill_banner_checkout(
        self,
        checkout: OrderCheckoutPaymentModel,
        *,
        provider_trans_id: str,
        billing: dict[str, Any],
    ) -> None:
        from uuid import UUID as _UUID

        from app.application.crm_banners.service import CrmBannerService

        meta = checkout.meta or {}
        banner_raw = meta.get("banner_id")
        if not banner_raw or not checkout.shop_id:
            raise ValueError("banner_checkout_invalid")
        banner_id = _UUID(str(banner_raw))
        await self._checkout_repo.mark_success(checkout, provider_trans_id=provider_trans_id)
        svc = CrmBannerService(self._session)
        await svc.activate_banner_after_online_payment(
            shop_id=checkout.shop_id,
            banner_id=banner_id,
            payment_method=str(billing.get("provider") or checkout.provider),
            external_reference=provider_trans_id,
        )

    async def _fulfill_debt_checkout(
        self,
        checkout: OrderCheckoutPaymentModel,
        *,
        provider_trans_id: str,
        billing: dict[str, Any],
    ) -> None:
        from app.application.billing.merchant_debt_service import MerchantDebtService

        if not checkout.shop_id:
            raise ValueError("debt_checkout_missing_shop")

        await self._checkout_repo.mark_success(checkout, provider_trans_id=provider_trans_id)
        idempotency = billing.get("idempotency_key") or f"debt_checkout:{checkout.id}"
        debt_svc = MerchantDebtService(self._session, self._settings)
        await debt_svc.apply_debt_payment(
            checkout.shop_id,
            int(checkout.amount_uzs),
            idempotency_key=str(idempotency),
            reference_type="checkout",
            reference_id=checkout.id,
        )

    async def _confirm_order_paid(
        self,
        order: OrderModel,
        billing: dict[str, Any],
        *,
        dispatch_courier: bool = True,
    ) -> None:
        if order.status in (OrderStatus.cancelled.value, OrderStatus.completed.value):
            return

        stmt = select(OrderModel).where(OrderModel.id == order.id).with_for_update()
        result = await self._session.execute(stmt)
        locked = result.scalar_one_or_none()
        if not locked:
            return

        product = await self._marketplace.get_product_by_id(locked.product_id)
        if not product:
            raise ValueError("product_not_found")

        billing = self._order_billing(
            locked,
            billing,
            merchant_base_unit_uzs=int(product.price),
        )

        prev_status = locked.status
        if locked.status == OrderStatus.reserved.value:
            locked.status = OrderStatus.confirmed.value
            await self._session.flush()
            from app.application.marketplace.customer_order_notifications import (
                CustomerOrderNotificationService,
            )

            await CustomerOrderNotificationService().push_order_status_change(
                order_id=locked.id,
                user_id=getattr(locked, "customer_user_id", None),
                phone=locked.customer_phone,
                product_name=product.name,
                new_status=OrderStatus.confirmed.value,
                prev_status=prev_status,
            )

        await self._splitter.process_order_payment_success(locked.id, billing)

        if dispatch_courier and (locked.fulfillment_type or "").lower() == "delivery":
            from app.application.delivery.delivery_dispatch_service import DeliveryDispatchService

            try:
                await DeliveryDispatchService(self._session).activate_courier_after_payment(locked.id)
            except Exception:
                logger.bind(order_id=str(locked.id)).warning("bts_dispatch_after_payment_failed")

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
