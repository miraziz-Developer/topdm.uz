"""Atomic marketplace payment splitter — escrow, wallet credits, release/refund."""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.delivery.yandex_quote import YandexDeliveryQuoteEngine
from app.application.finance.split_rules import (
    PaymentSplit,
    assert_split_integrity,
    compute_payment_split,
    compute_payment_split_with_markup,
)
from app.core.config import Settings, get_settings
from app.infrastructure.repositories.finance_repo import FinanceRepository
from app.models.finance import PlatformTransactionStatus

UZS_QUANT = Decimal("0.01")


class TransactionSplitterError(ValueError):
    pass


class TransactionSplitterService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._repo = FinanceRepository(session)
        self._delivery = YandexDeliveryQuoteEngine(self._settings)

    async def process_order_payment_success(
        self,
        order_id: UUID,
        billing_payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Idempotent escrow credit:
        - locks order + wallet rows
        - computes split
        - deposits merchant_share into frozen_balance
        """
        log = logger.bind(event="process_order_payment_success", order_id=str(order_id))
        log.info("payment split started", billing_keys=sorted(billing_payload.keys()))

        idempotency_key = self._extract_idempotency_key(billing_payload)
        if idempotency_key:
            existing = await self._repo.get_transaction_by_idempotency(idempotency_key)
            if existing:
                log.warning("idempotent replay — returning existing platform transaction", idempotency_key=idempotency_key)
                return self._result_payload(existing, idempotent_replay=True)

        try:
            order = await self._repo.get_order_for_update(order_id)
            if not order:
                raise TransactionSplitterError("order_not_found")

            existing_order_tx = await self._repo.get_transaction_by_order_for_update(order_id)
            if existing_order_tx:
                log.warning("order already has platform transaction", status=existing_order_tx.status)
                return self._result_payload(existing_order_tx, idempotent_replay=True)

            total_received = self._extract_total_received(billing_payload, order)
            product_subtotal = self._extract_product_subtotal(billing_payload, order, total_received)

            shop = await self._repo.get_shop(order.shop_id)
            delivery_share = await self._delivery.quote_delivery_uzs(
                order=order,
                shop=shop,
                billing_payload=billing_payload,
                session=self._session,
            )

            merchant_goods = billing_payload.get("merchant_subtotal_uzs")
            if merchant_goods is not None:
                split = compute_payment_split_with_markup(
                    total_amount_received=total_received,
                    merchant_goods_subtotal=Decimal(str(merchant_goods)),
                    delivery_share=delivery_share,
                )
            else:
                split = compute_payment_split(
                    total_amount_received=total_received,
                    product_subtotal=product_subtotal,
                    delivery_share=delivery_share,
                    settings=self._settings,
                )
            assert_split_integrity(split)

            log.info("split computed", **{k: str(v) for k, v in split.as_dict().items()})

            tx = await self._repo.create_platform_transaction(
                order_id=order.id,
                shop_id=order.shop_id,
                total_amount_received=split.total_amount_received,
                product_subtotal=split.product_subtotal,
                merchant_share=split.merchant_share,
                delivery_share=split.delivery_share,
                platform_commission=split.platform_commission,
                gateway_provider=self._extract_gateway_provider(billing_payload),
                gateway_reference=self._extract_gateway_reference(billing_payload),
                idempotency_key=idempotency_key,
                billing_snapshot=self._sanitize_billing_snapshot(billing_payload, split),
            )

            wallet = await self._repo.credit_frozen_balance(order.shop_id, split.merchant_share)
            await self._session.commit()

            log.info(
                "payment split committed",
                transaction_id=str(tx.id),
                frozen_balance=str(wallet.frozen_balance),
                merchant_share=str(split.merchant_share),
            )
            return self._result_payload(tx, split=split, wallet=wallet)
        except Exception:
            await self._session.rollback()
            log.exception("payment split failed — transaction rolled back")
            raise

    async def release_escrow_to_merchant(self, order_id: UUID) -> dict[str, Any]:
        """Move merchant_share from frozen_balance → current_balance after delivery."""
        log = logger.bind(event="release_escrow_to_merchant", order_id=str(order_id))
        try:
            tx = await self._repo.get_transaction_by_order_for_update(order_id)
            if not tx:
                raise TransactionSplitterError("platform_transaction_not_found")
            if tx.status == PlatformTransactionStatus.RELEASED_TO_MERCHANT.value:
                await self._session.commit()
                return self._result_payload(tx, idempotent_replay=True)
            if tx.status != PlatformTransactionStatus.HELD_IN_ESCROW.value:
                raise TransactionSplitterError(f"invalid_status_for_release:{tx.status}")

            wallet = await self._repo.release_frozen_to_current(tx.shop_id, tx.merchant_share)
            await self._repo.mark_transaction_released(tx)
            await self._session.commit()

            log.info(
                "escrow released",
                transaction_id=str(tx.id),
                current_balance=str(wallet.current_balance),
            )
            return self._result_payload(tx, wallet=wallet)
        except Exception:
            await self._session.rollback()
            log.exception("release escrow failed")
            raise

    async def refund_order_payment(self, order_id: UUID) -> dict[str, Any]:
        """Reverse escrow: remove merchant_share from frozen_balance."""
        log = logger.bind(event="refund_order_payment", order_id=str(order_id))
        try:
            tx = await self._repo.get_transaction_by_order_for_update(order_id)
            if not tx:
                raise TransactionSplitterError("platform_transaction_not_found")
            if tx.status == PlatformTransactionStatus.REFUNDED.value:
                await self._session.commit()
                return self._result_payload(tx, idempotent_replay=True)
            if tx.status == PlatformTransactionStatus.RELEASED_TO_MERCHANT.value:
                raise TransactionSplitterError("cannot_refund_after_release")

            wallet = await self._repo.debit_frozen_balance(tx.shop_id, tx.merchant_share)
            await self._repo.mark_transaction_refunded(tx)
            await self._session.commit()

            log.info(
                "payment refunded from escrow",
                transaction_id=str(tx.id),
                frozen_balance=str(wallet.frozen_balance),
            )
            return self._result_payload(tx, wallet=wallet)
        except Exception:
            await self._session.rollback()
            log.exception("refund failed")
            raise

    @staticmethod
    def _extract_total_received(billing_payload: dict[str, Any], order) -> Decimal:
        for key in ("total_amount_received", "amount_uzs", "amount", "total"):
            if key in billing_payload and billing_payload[key] is not None:
                return Decimal(str(billing_payload[key])).quantize(UZS_QUANT)
        return Decimal(str(order.total_price)).quantize(UZS_QUANT)

    @staticmethod
    def _extract_product_subtotal(
        billing_payload: dict[str, Any],
        order,
        total_received: Decimal,
    ) -> Decimal:
        if "product_subtotal" in billing_payload and billing_payload["product_subtotal"] is not None:
            return Decimal(str(billing_payload["product_subtotal"])).quantize(UZS_QUANT)
        if "product_subtotal_uzs" in billing_payload:
            return Decimal(str(billing_payload["product_subtotal_uzs"])).quantize(UZS_QUANT)
        fulfillment = (getattr(order, "fulfillment_type", None) or "delivery").strip().lower()
        if fulfillment == "delivery" and "delivery_share_uzs" in billing_payload:
            delivery = Decimal(str(billing_payload["delivery_share_uzs"])).quantize(UZS_QUANT)
            product = (total_received - delivery).quantize(UZS_QUANT)
            return max(Decimal("0.00"), product)
        return Decimal(str(order.total_price)).quantize(UZS_QUANT)

    @staticmethod
    def _extract_idempotency_key(billing_payload: dict[str, Any]) -> str | None:
        for key in ("idempotency_key", "gateway_trans_id", "click_trans_id", "payme_trans_id"):
            raw = billing_payload.get(key)
            if raw:
                return str(raw).strip()[:128]
        return None

    @staticmethod
    def _extract_gateway_provider(billing_payload: dict[str, Any]) -> str | None:
        raw = billing_payload.get("provider") or billing_payload.get("gateway") or billing_payload.get("payment_method")
        return str(raw).strip().lower()[:32] if raw else None

    @staticmethod
    def _extract_gateway_reference(billing_payload: dict[str, Any]) -> str | None:
        for key in ("gateway_trans_id", "click_trans_id", "payme_trans_id", "merchant_trans_id"):
            raw = billing_payload.get(key)
            if raw:
                return str(raw).strip()[:128]
        return None

    @staticmethod
    def _json_safe(value: Any) -> Any:
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, dict):
            return {str(k): TransactionSplitterService._json_safe(v) for k, v in value.items()}
        if isinstance(value, list):
            return [TransactionSplitterService._json_safe(v) for v in value]
        if isinstance(value, tuple):
            return [TransactionSplitterService._json_safe(v) for v in value]
        return value

    @staticmethod
    def _sanitize_billing_snapshot(billing_payload: dict[str, Any], split: PaymentSplit) -> dict[str, Any]:
        safe = {
            k: TransactionSplitterService._json_safe(v)
            for k, v in billing_payload.items()
            if k not in {"card_number", "cvv", "secret"}
        }
        safe["computed_split"] = split.as_dict()
        return safe

    @staticmethod
    def _result_payload(
        tx,
        *,
        split: PaymentSplit | None = None,
        wallet=None,
        idempotent_replay: bool = False,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "status": "ok",
            "idempotent_replay": idempotent_replay,
            "transaction": {
                "id": str(tx.id),
                "order_id": str(tx.order_id),
                "shop_id": str(tx.shop_id),
                "total_amount_received": float(tx.total_amount_received),
                "merchant_share": float(tx.merchant_share),
                "delivery_share": float(tx.delivery_share),
                "platform_commission": float(tx.platform_commission),
                "platform_status": tx.status,
            },
        }
        if split:
            payload["split"] = split.as_dict()
        if wallet:
            payload["wallet"] = {
                "shop_id": str(wallet.shop_id),
                "current_balance": float(wallet.current_balance),
                "frozen_balance": float(wallet.frozen_balance),
            }
        return payload


async def process_order_payment_success(
    session: AsyncSession,
    order_id: UUID,
    billing_payload: dict[str, Any],
    *,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Module-level entry for webhooks / payment gateways."""
    service = TransactionSplitterService(session, settings=settings)
    return await service.process_order_payment_success(order_id, billing_payload)
