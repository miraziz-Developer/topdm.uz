"""Deterministic order payment split rules (UZS, 2 decimal places)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.core.config import Settings, get_settings

UZS_QUANT = Decimal("0.01")
ZERO = Decimal("0.00")


@dataclass(frozen=True, slots=True)
class PaymentSplit:
    total_amount_received: Decimal
    product_subtotal: Decimal
    delivery_share: Decimal
    platform_commission: Decimal
    merchant_share: Decimal

    def as_dict(self) -> dict[str, str]:
        return {
            "total_amount_received": str(self.total_amount_received),
            "product_subtotal": str(self.product_subtotal),
            "delivery_share": str(self.delivery_share),
            "platform_commission": str(self.platform_commission),
            "merchant_share": str(self.merchant_share),
        }


def _q(value: Decimal) -> Decimal:
    return value.quantize(UZS_QUANT)


def _to_decimal(value: Decimal | int | float | str) -> Decimal:
    return _q(Decimal(str(value)))


def compute_payment_split(
    *,
    total_amount_received: Decimal,
    product_subtotal: Decimal,
    delivery_share: Decimal,
    commission_rate_pct: Decimal | None = None,
    settings: Settings | None = None,
) -> PaymentSplit:
    """
    merchant_share = total - delivery - commission
    commission = product_subtotal * rate%  (platform fee on goods, not delivery)
    """
    cfg = settings or get_settings()
    rate = commission_rate_pct if commission_rate_pct is not None else _to_decimal(cfg.finance_order_commission_rate_pct)

    total = _to_decimal(total_amount_received)
    product = _to_decimal(product_subtotal)
    delivery = _to_decimal(delivery_share)

    if total < ZERO:
        raise ValueError("total_amount_received must be >= 0")
    if product < ZERO or delivery < ZERO:
        raise ValueError("product_subtotal and delivery_share must be >= 0")
    if product + delivery > total + UZS_QUANT:
        raise ValueError("product_subtotal + delivery_share exceeds total_amount_received")

    commission = _q((product * rate) / Decimal("100"))
    merchant = _q(total - delivery - commission)

    if merchant < ZERO:
        raise ValueError(
            f"merchant_share negative after split: total={total} delivery={delivery} commission={commission}"
        )

    # Penny-safe reconciliation: absorb rounding drift into platform commission.
    drift = _q(total - (merchant + delivery + commission))
    if drift != ZERO:
        commission = _q(commission + drift)
        merchant = _q(total - delivery - commission)

    split = PaymentSplit(
        total_amount_received=total,
        product_subtotal=product,
        delivery_share=delivery,
        platform_commission=commission,
        merchant_share=merchant,
    )
    assert_split_integrity(split)
    return split


def assert_split_integrity(split: PaymentSplit) -> None:
    lhs = _q(split.merchant_share + split.delivery_share + split.platform_commission)
    if lhs != split.total_amount_received:
        raise AssertionError(
            f"split integrity failed: {lhs} != {split.total_amount_received} ({split.as_dict()})"
        )
