from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel

logger = logging.getLogger(__name__)


class InventoryError(ValueError):
    """Raised when stock cannot be reserved; message is user-facing Uzbek text."""


@dataclass(slots=True, frozen=True)
class ReservedPickupLine:
    order: OrderModel
    product: ProductModel
    shop: ShopModel


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
    status: str = "reserved",
) -> ReservedPickupLine:
    """
    Row-level lock on product, safe stock decrement, order insert.
    Caller must wrap calls in a single transaction (db.begin()).
    """
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
            extra={"product_id": str(product_id), "product_name": product.name},
        )

    shop = product.shop
    if shop is None:
        shop_result = await db.execute(select(ShopModel).where(ShopModel.id == product.shop_id))
        shop = shop_result.scalar_one_or_none()
    if shop is None:
        raise InventoryError("Do'kon topilmadi")

    line_total = int(product.price) * quantity
    order = OrderModel(
        customer_phone=customer_phone,
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
) -> ReservedPickupLine:
    """Row-level lock + delivery order insert (Yandex courier flow)."""
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

    shop = product.shop
    if shop is None:
        shop_result = await db.execute(select(ShopModel).where(ShopModel.id == product.shop_id))
        shop = shop_result.scalar_one_or_none()
    if shop is None:
        raise InventoryError("Do'kon topilmadi")

    line_total = int(product.price) * quantity
    order = OrderModel(
        customer_phone=customer_phone,
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
