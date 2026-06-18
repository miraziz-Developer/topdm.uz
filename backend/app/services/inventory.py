from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.pricing.product_markup import order_line_totals
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel

logger = logging.getLogger(__name__)

ACTIVE_RESERVED_STATUSES = frozenset(
    {"pending", "reserved", "confirmed", "preparing", "ready"},
)


class InventoryError(ValueError):
    """Raised when stock cannot be reserved; message is user-facing Uzbek text."""


def _norm_key(value: str) -> str:
    return value.strip().casefold()


def _sku_rows(attributes: dict | None) -> list[dict]:
    skus = attributes.get("skus") if isinstance(attributes, dict) else None
    if not isinstance(skus, list):
        return []
    return [row for row in skus if isinstance(row, dict)]


def _all_skus_unstocked(attributes: dict | None) -> bool:
    rows = _sku_rows(attributes)
    return bool(rows) and all(max(0, int(row.get("stock") or 0)) <= 0 for row in rows)


def _sku_stock_from_attributes(attributes: dict | None, *, color: str | None, size: str | None) -> int | None:
    if not color or not size:
        return None
    rows = _sku_rows(attributes)
    if not rows:
        return None
    for row in rows:
        row_color = str(row.get("color") or "").strip()
        row_size = str(row.get("size") or "").strip()
        if _norm_key(row_color) == _norm_key(color) and _norm_key(row_size) == _norm_key(size):
            return max(0, int(row.get("stock") or 0))
    return None


def _use_aggregate_stock_fallback(product: ProductModel, *, sku_stock: int | None, quantity: int) -> bool:
    aggregate = int(product.stock_count or 0)
    if aggregate < quantity or sku_stock is None:
        return False
    if sku_stock >= quantity:
        return False
    attrs = product.attributes if isinstance(product.attributes, dict) else {}
    return sku_stock <= 0 and _all_skus_unstocked(attrs)


def _parse_variant_from_note(note: str | None) -> tuple[str | None, str | None]:
    if not note:
        return None, None
    color: str | None = None
    size: str | None = None
    for part in note.split("|"):
        chunk = part.strip()
        if chunk.startswith("Rang:"):
            color = chunk[5:].strip() or None
        elif chunk.startswith("Razmer:"):
            size = chunk[7:].strip() or None
    return color, size


def _increment_sku_stock(attributes: dict, *, color: str, size: str, quantity: int) -> tuple[dict, int]:
    skus = attributes.get("skus")
    if not isinstance(skus, list):
        return attributes, 0
    updated: list[dict] = []
    total = 0
    matched = False
    for row in skus:
        if not isinstance(row, dict):
            continue
        row_color = str(row.get("color") or "").strip()
        row_size = str(row.get("size") or "").strip()
        stock = max(0, int(row.get("stock") or 0))
        if _norm_key(row_color) == _norm_key(color) and _norm_key(row_size) == _norm_key(size):
            stock += quantity
            matched = True
        updated.append({"color": row_color, "size": row_size, "stock": stock})
        total += stock
    if not matched:
        updated.append({"color": color, "size": size, "stock": quantity})
        total += quantity
    patch = dict(attributes)
    patch["skus"] = updated
    return patch, total


def _decrement_sku_stock(attributes: dict, *, color: str, size: str, quantity: int) -> tuple[dict, int]:
    skus = attributes.get("skus")
    if not isinstance(skus, list):
        return attributes
    updated: list[dict] = []
    total = 0
    for row in skus:
        if not isinstance(row, dict):
            continue
        row_color = str(row.get("color") or "").strip()
        row_size = str(row.get("size") or "").strip()
        stock = max(0, int(row.get("stock") or 0))
        if _norm_key(row_color) == _norm_key(color) and _norm_key(row_size) == _norm_key(size):
            stock = max(0, stock - quantity)
        updated.append({"color": row_color, "size": row_size, "stock": stock})
        total += stock
    patch = dict(attributes)
    patch["skus"] = updated
    return patch, total


def _apply_stock_reservation(
    product: ProductModel,
    *,
    quantity: int,
    variant_color: str | None = None,
    variant_size: str | None = None,
) -> None:
    attrs = dict(product.attributes or {})
    sku_stock = _sku_stock_from_attributes(attrs, color=variant_color, size=variant_size)
    use_aggregate = _use_aggregate_stock_fallback(product, sku_stock=sku_stock, quantity=quantity)

    if sku_stock is not None and not use_aggregate:
        if sku_stock < quantity:
            label = f"{variant_color} / {variant_size}".strip(" /")
            raise InventoryError(
                f"'{product.name}' ({label}) uchun omborda yetarli zaxira yo'q (qolgan: {sku_stock})"
            )
        attrs, total_stock = _decrement_sku_stock(
            attrs,
            color=str(variant_color or ""),
            size=str(variant_size or ""),
            quantity=quantity,
        )
        product.attributes = attrs
        product.stock_count = total_stock
        if total_stock <= 0:
            product.is_available = False
            logger.info(
                "product_stock_depleted",
                extra={"product_id": str(product.id), "product_name": product.name},
            )
        return

    available_stock = int(product.stock_count)
    if available_stock < quantity:
        raise InventoryError(
            f"'{product.name}' uchun omborda yetarli zaxira yo'q (qolgan: {available_stock})"
        )

    new_stock = available_stock - quantity
    product.stock_count = new_stock
    if new_stock <= 0:
        product.stock_count = 0
        product.is_available = False
        logger.info(
            "product_stock_depleted",
            extra={"product_id": str(product.id), "product_name": product.name},
        )


def _apply_stock_release(
    product: ProductModel,
    *,
    quantity: int,
    variant_color: str | None = None,
    variant_size: str | None = None,
) -> None:
    attrs = dict(product.attributes or {})
    sku_stock = _sku_stock_from_attributes(attrs, color=variant_color, size=variant_size)

    if sku_stock is not None and variant_color and variant_size:
        attrs, total_stock = _increment_sku_stock(
            attrs,
            color=str(variant_color),
            size=str(variant_size),
            quantity=quantity,
        )
        product.attributes = attrs
        product.stock_count = total_stock
    else:
        product.stock_count = int(product.stock_count or 0) + quantity

    if not product.is_available and int(product.stock_count or 0) > 0:
        product.is_available = True

    logger.info(
        "order_stock_released",
        extra={
            "product_id": str(product.id),
            "quantity": quantity,
            "stock_remaining": int(product.stock_count or 0),
        },
    )


@dataclass(slots=True, frozen=True)
class ReservedPickupLine:
    order: OrderModel
    product: ProductModel
    shop: ShopModel


def _validate_product_order_quantity(product: ProductModel, quantity: int) -> str | None:
    from app.application.merchant.wholesale_pack import validate_order_quantity

    return validate_order_quantity(product, quantity)


async def _lock_product_for_order(
    db: AsyncSession,
    *,
    product_id: UUID,
    quantity: int,
) -> tuple[ProductModel, ShopModel]:
    if quantity < 1 or quantity > 99:
        raise InventoryError("Miqdor 1 dan 99 gacha bo'lishi kerak")

    result = await db.execute(
        select(ProductModel)
        .options(selectinload(ProductModel.shop).selectinload(ShopModel.ipadrom))
        .where(ProductModel.id == product_id)
        .with_for_update()
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise InventoryError("Mahsulot topilmadi")
    if not product.is_available:
        raise InventoryError(f"'{product.name}' hozir mavjud emas")

    shop = product.shop
    if shop is None:
        shop_result = await db.execute(select(ShopModel).where(ShopModel.id == product.shop_id))
        shop = shop_result.scalar_one_or_none()
    if shop is None:
        raise InventoryError("Do'kon topilmadi")
    if not shop.is_active:
        raise InventoryError("Do'kon hozir faol emas")
    if getattr(shop, "is_blocked", False):
        raise InventoryError("Do'kon vaqtincha bloklangan — buyurtma qabul qilinmaydi")
    return product, shop


async def reserve_pickup_line_locked(
    db: AsyncSession,
    *,
    product_id: UUID,
    quantity: int,
    customer_phone: str,
    customer_email: str | None,
    pickup_date: date,
    pickup_time: str,
    note: str | None,
    ref_token: str | None,
    payment_method: str | None = None,
    status: str = "reserved",
    variant_color: str | None = None,
    variant_size: str | None = None,
    customer_user_id: UUID | None = None,
) -> ReservedPickupLine:
    """
    Row-level lock on product, safe stock decrement, order insert.
    Caller must commit or rollback the session after all lines are reserved.
    """
    product, shop = await _lock_product_for_order(db, product_id=product_id, quantity=quantity)
    moq_err = _validate_product_order_quantity(product, quantity)
    if moq_err:
        raise InventoryError(moq_err)

    _apply_stock_reservation(
        product,
        quantity=quantity,
        variant_color=variant_color,
        variant_size=variant_size,
    )

    _merchant_sub, line_total, _markup = order_line_totals(int(product.price), quantity)
    order = OrderModel(
        customer_phone=customer_phone,
        customer_user_id=customer_user_id,
        product_id=product_id,
        shop_id=product.shop_id,
        quantity=quantity,
        total_price=line_total,
        note=note,
        ref_token=ref_token,
        pickup_date=pickup_date,
        pickup_time=pickup_time,
        fulfillment_type="pickup",
        customer_email=customer_email,
        payment_method=(payment_method or "").strip().lower() or None,
        status=status,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)

    logger.info(
        "pickup_line_reserved",
        extra={
            "order_id": str(order.id),
            "product_id": str(product_id),
            "quantity": quantity,
            "stock_remaining": int(product.stock_count),
        },
    )
    return ReservedPickupLine(order=order, product=product, shop=shop)


async def reserve_delivery_line_locked(
    db: AsyncSession,
    *,
    product_id: UUID,
    quantity: int,
    customer_phone: str,
    customer_email: str | None,
    note: str | None,
    ref_token: str | None,
    destination_address: str,
    destination_city: str,
    destination_lat: float,
    destination_lng: float,
    carrier_class: str,
    delivery_cost_uzs: int,
    delivery_eta_minutes: int | None,
    status: str = "reserved",
    payment_method: str | None = None,
    variant_color: str | None = None,
    variant_size: str | None = None,
    customer_user_id: UUID | None = None,
) -> ReservedPickupLine:
    """Row-level lock + delivery order insert (Yandex courier flow)."""
    product, shop = await _lock_product_for_order(db, product_id=product_id, quantity=quantity)
    moq_err = _validate_product_order_quantity(product, quantity)
    if moq_err:
        raise InventoryError(moq_err)

    _apply_stock_reservation(
        product,
        quantity=quantity,
        variant_color=variant_color,
        variant_size=variant_size,
    )

    _merchant_sub, line_total, _markup = order_line_totals(int(product.price), quantity)
    order = OrderModel(
        customer_phone=customer_phone,
        customer_user_id=customer_user_id,
        product_id=product_id,
        shop_id=product.shop_id,
        quantity=quantity,
        total_price=line_total,
        note=note,
        ref_token=ref_token,
        fulfillment_type="delivery",
        customer_email=customer_email,
        delivery_address=destination_address,
        delivery_city=destination_city,
        delivery_lat=destination_lat,
        delivery_lng=destination_lng,
        carrier_class=carrier_class,
        delivery_cost_uzs=int(delivery_cost_uzs),
        delivery_eta_minutes=delivery_eta_minutes,
        payment_method=(payment_method or "").strip().lower() or None,
        status=status,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)

    logger.info(
        "delivery_line_reserved",
        extra={
            "order_id": str(order.id),
            "product_id": str(product_id),
            "carrier_class": carrier_class,
        },
    )
    return ReservedPickupLine(order=order, product=product, shop=shop)


async def release_order_reserved_stock(db: AsyncSession, *, order_id: UUID) -> bool:
    """Restore inventory when an active reservation is cancelled (caller commits)."""
    result = await db.execute(
        select(OrderModel).where(OrderModel.id == order_id).with_for_update()
    )
    order = result.scalar_one_or_none()
    if order is None:
        return False
    if (order.status or "").lower() not in ACTIVE_RESERVED_STATUSES:
        return False

    product_result = await db.execute(
        select(ProductModel).where(ProductModel.id == order.product_id).with_for_update()
    )
    product = product_result.scalar_one_or_none()
    if product is None:
        return False

    variant_color, variant_size = _parse_variant_from_note(order.note)
    _apply_stock_release(
        product,
        quantity=int(order.quantity),
        variant_color=variant_color,
        variant_size=variant_size,
    )
    await db.flush()
    return True
