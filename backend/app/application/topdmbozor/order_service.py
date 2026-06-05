from __future__ import annotations

from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.topdmbozor.click_p2p import build_click_p2p_url
from app.core.config import Settings, get_settings
from app.infrastructure.repositories.topdmbozor_repo import TopdmbozorRepository
from app.models.topdmbozor import TdbDeliveryStatus, TdbOrder, TdbOrderStatus
from app.schemas.topdmbozor import CreateOrderResponse


class TopdmbozorOrderError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


class TopdmbozorOrderService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._repo = TopdmbozorRepository(session)

    async def create_order(
        self,
        *,
        phone_number: str,
        username: str | None,
        merchant_id: UUID,
        amount: int,
    ) -> CreateOrderResponse:
        merchant = await self._repo.get_merchant(merchant_id)
        if not merchant or not merchant.is_active:
            raise TopdmbozorOrderError("merchant_not_found", "Do'kon topilmadi yoki faol emas")

        user = await self._repo.get_or_create_user(phone_number=phone_number, username=username)

        order = await self._repo.create_order(
            user_id=user.id,
            merchant_id=merchant.id,
            amount=amount,
            click_p2p_url="",
        )
        try:
            order.click_p2p_url = build_click_p2p_url(
                order_id=order.id,
                amount_uzs=amount,
                settings=self._settings,
            )
        except ValueError as exc:
            await self._session.rollback()
            raise TopdmbozorOrderError("config_error", str(exc)) from exc

        await self._session.commit()
        await self._session.refresh(order)

        logger.info("tdb_order_created order_id={} merchant_id={} amount={}", order.id, merchant.id, amount)
        return _to_response(order)

    async def ship_order(self, order_id: UUID, *, tracking_number: str) -> TdbOrder:
        order = await self._repo.get_order_for_update(order_id)
        if not order:
            raise TopdmbozorOrderError("not_found", "Buyurtma topilmadi")
        if order.status != TdbOrderStatus.paid:
            raise TopdmbozorOrderError("invalid_status", "Faqat to'langan buyurtmani yuborish mumkin")

        order.tracking_number = tracking_number
        order.delivery_status = TdbDeliveryStatus.shipped
        await self._session.commit()
        await self._session.refresh(order)
        logger.info("tdb_order_shipped order_id={} tracking={}", order_id, tracking_number)
        return order


def _to_response(order: TdbOrder) -> CreateOrderResponse:
    return CreateOrderResponse(
        order_id=order.id,
        amount=order.amount,
        status=order.status,
        delivery_status=order.delivery_status,
        click_p2p_url=order.click_p2p_url or "",
        created_at=order.created_at,
    )
