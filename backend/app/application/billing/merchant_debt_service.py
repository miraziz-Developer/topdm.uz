"""Do'kon qarzi: naqd/terminal pickup yakunlanganda 15% komissiya + avto-blok."""
from __future__ import annotations

import logging
import re
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.billing.business_rule_service import BusinessRuleService
from app.application.billing.transaction_ledger_service import TransactionLedgerService
from app.application.pricing.product_markup import platform_markup_uzs
from app.core.config import Settings, get_settings
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel
from app.infrastructure.repositories.order_payment_repo import OrderPaymentRepository

logger = logging.getLogger(__name__)

OFFLINE_PAYMENT_METHODS = frozenset({"cash", "terminal"})
_ONLINE_PAYMENT_METHODS = frozenset({"click"})
_PAYMENT_NOTE_RE = re.compile(
    r"To'lov:\s*(Naqd pul|Terminal|Click)",
    re.IGNORECASE,
)
_PAYMENT_LABEL_TO_CODE = {
    "naqd pul": "cash",
    "terminal": "terminal",
    "click": "click",
}


def parse_payment_method_from_note(note: str | None) -> str | None:
    if not note:
        return None
    match = _PAYMENT_NOTE_RE.search(note)
    if not match:
        return None
    return _PAYMENT_LABEL_TO_CODE.get(match.group(1).strip().lower())


def resolve_order_payment_method(order: OrderModel) -> str | None:
    raw = (getattr(order, "payment_method", None) or "").strip().lower()
    if raw:
        return raw
    return parse_payment_method_from_note(order.note)


def is_offline_pickup_payment(method: str | None) -> bool:
    return (method or "").lower() in OFFLINE_PAYMENT_METHODS


def commission_uzs_for_line(*, merchant_base_unit_uzs: int, quantity: int, settings: Settings | None = None) -> int:
    qty = max(1, int(quantity))
    unit_markup = platform_markup_uzs(int(merchant_base_unit_uzs), settings)
    return unit_markup * qty


class MerchantDebtService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._rules = BusinessRuleService(session, self._settings)
        self._ledger = TransactionLedgerService(session)
        self._checkout_repo = OrderPaymentRepository(session)

    async def block_threshold_uzs(self) -> int:
        return max(1, await self._rules.debt_block_threshold_uzs())

    async def get_shop_debt_status(self, shop_id: UUID) -> dict:
        shop = await self._session.get(ShopModel, shop_id)
        if shop is None:
            raise ValueError("shop_not_found")
        debt = int(shop.debt_balance or 0)
        threshold = await self.block_threshold_uzs()
        return {
            "shop_id": str(shop.id),
            "debt_balance_uzs": debt,
            "is_blocked": bool(shop.is_blocked),
            "block_threshold_uzs": threshold,
            "amount_until_block_uzs": max(0, threshold - debt) if not shop.is_blocked else 0,
            "markup_pct": float(self._settings.platform_product_markup_pct),
        }

    async def process_cash_pickup_completion(self, order_id: UUID) -> dict:
        """
        Buyurtma completed bo'lganda chaqiriladi.
        Faqat pickup + naqd/terminal: platforma 15% ni shop.debt_balance ga qo'shadi.
        """
        result = await self._session.execute(
            select(OrderModel)
            .options(
                selectinload(OrderModel.product),
                selectinload(OrderModel.shop),
            )
            .where(OrderModel.id == order_id)
            .with_for_update()
        )
        order = result.scalar_one_or_none()
        if order is None:
            return {"status": "skipped", "reason": "order_not_found"}

        if (order.status or "").lower() != "completed":
            return {"status": "skipped", "reason": "not_completed"}

        fulfillment = (order.fulfillment_type or "").lower()
        if fulfillment not in ("pickup", "delivery"):
            return {"status": "skipped", "reason": "not_fulfillment_order"}

        # BUG FIX: delivery buyurtmalar uchun komissiya hisoblanmaydi
        # (delivery to'lovi odatda onlayn bo'ladi va alohida hisoblanadi)
        if fulfillment == "delivery":
            return {"status": "skipped", "reason": "delivery_order_no_debt"}

        if order.debt_commission_recorded:
            return {"status": "skipped", "reason": "already_recorded"}

        payment_method = resolve_order_payment_method(order)
        if payment_method in _ONLINE_PAYMENT_METHODS:
            return {"status": "skipped", "reason": "online_payment"}

        if not is_offline_pickup_payment(payment_method):
            return {"status": "skipped", "reason": "not_offline_payment"}

        product = order.product
        if product is None:
            prod_row = await self._session.get(ProductModel, order.product_id)
            product = prod_row
        if product is None:
            return {"status": "error", "reason": "product_not_found"}

        commission = commission_uzs_for_line(
            merchant_base_unit_uzs=int(product.price),
            quantity=int(order.quantity),
            settings=self._settings,
        )
        if commission <= 0:
            order.debt_commission_recorded = True
            await self._session.flush()
            return {"status": "skipped", "reason": "zero_commission"}

        idempotency = f"debt_commission:order:{order.id}"
        ledger_row = await self._ledger.append_entry(
            shop_id=order.shop_id,
            entry_type="debit",
            category="debt_commission",
            amount_uzs=commission,
            idempotency_key=idempotency,
            reference_type="order",
            reference_id=order.id,
            meta={"payment_method": payment_method},
        )
        order.debt_commission_recorded = True

        shop = await self._session.get(ShopModel, order.shop_id)
        threshold = await self.block_threshold_uzs()
        blocked_now = False
        if shop:
            # BUG FIX: debt_balance ni ledger balance_after_uzs bilan yangilash
            shop.debt_balance = int(ledger_row.balance_after_uzs)
            if int(shop.debt_balance) >= threshold:
                shop.is_blocked = True
                blocked_now = True

        await self._session.flush()

        logger.info(
            "merchant_debt_accrued shop_id=%s order_id=%s commission=%s debt=%s blocked=%s",
            shop.id,
            order.id,
            commission,
            shop.debt_balance,
            shop.is_blocked,
        )

        return {
            "status": "success",
            "order_id": str(order.id),
            "shop_id": str(shop.id),
            "commission_uzs": commission,
            "current_debt_uzs": int(ledger_row.balance_after_uzs),
            "ledger_id": str(ledger_row.id),
            "is_blocked": bool(shop.is_blocked),
            "blocked_now": blocked_now,
            "payment_method": payment_method,
        }

    async def apply_debt_payment(
        self,
        shop_id: UUID,
        amount_uzs: int,
        *,
        idempotency_key: str | None = None,
        reference_type: str = "manual",
        reference_id: UUID | None = None,
    ) -> dict:
        """Qarzni kamaytiradi (ledger credit) — Click/Payme webhook yoki qo'lda."""
        paid = max(0, int(amount_uzs))
        if paid <= 0:
            raise ValueError("invalid_amount")

        result = await self._session.execute(
            select(ShopModel).where(ShopModel.id == shop_id).with_for_update()
        )
        shop = result.scalar_one_or_none()
        if shop is None:
            raise ValueError("shop_not_found")
        before = int(shop.debt_balance or 0)

        key = idempotency_key or f"debt_payment:{shop_id}:{paid}:{reference_id or 'manual'}"
        ledger_row = await self._ledger.append_entry(
            shop_id=shop_id,
            entry_type="credit",
            category="debt_payment",
            amount_uzs=paid,
            idempotency_key=key,
            reference_type=reference_type,
            reference_id=reference_id,
            meta={},
        )

        threshold = await self.block_threshold_uzs()
        if int(ledger_row.balance_after_uzs) < threshold:
            shop.is_blocked = False

        await self._session.commit()

        return {
            "status": "success",
            "shop_id": str(shop_id),
            "paid_uzs": paid,
            "debt_before_uzs": before,
            "debt_balance_uzs": int(ledger_row.balance_after_uzs),
            "is_blocked": bool(shop.is_blocked),
            "ledger_id": str(ledger_row.id),
        }

    async def create_debt_checkout(self, shop_id: UUID, *, provider: str) -> dict:
        if not self._settings.enable_online_checkout:
            raise ValueError("online_checkout_disabled")

        shop = await self._session.get(ShopModel, shop_id)
        if shop is None:
            raise ValueError("shop_not_found")
        debt = int(shop.debt_balance or 0)
        if debt <= 0:
            raise ValueError("no_debt")

        prov = provider.strip().lower()
        if prov not in ("click",):
            raise ValueError("invalid_provider")

        checkout = await self._checkout_repo.create_pending(
            order_ids=[],
            amount_uzs=debt,
            provider=prov,
            purpose="merchant_debt",
            shop_id=shop_id,
            meta={"debt_snapshot_uzs": debt},
        )
        await self._session.commit()
        return {
            "checkout_id": str(checkout.id),
            "amount_uzs": debt,
            "provider": prov,
            "purpose": "merchant_debt",
        }

    async def run_monthly_debt_block_pass(self) -> dict:
        """
        Har oy boshida: qarzi > 0 bo'lgan va hali bloklanmagan do'konlarni bloklaydi.
        """
        threshold = int(self._settings.merchant_debt_block_threshold_uzs)
        result = await self._session.execute(
            select(ShopModel)
            .where(ShopModel.debt_balance >= threshold, ShopModel.is_blocked.is_(False))
            .with_for_update()
        )
        shops = list(result.scalars().all())
        for shop in shops:
            shop.is_blocked = True
        await self._session.commit()

        logger.info("merchant_monthly_debt_block count=%s", len(shops))
        return {
            "status": "success",
            "blocked_vendors_count": len(shops),
            "shop_ids": [str(s.id) for s in shops],
        }


async def monthly_merchant_debt_block_task() -> dict:
    """Celery / cron uchun async entrypoint."""
    from app.infrastructure.db.session import AsyncSessionFactory

    async with AsyncSessionFactory() as session:
        svc = MerchantDebtService(session)
        return await svc.run_monthly_debt_block_pass()
