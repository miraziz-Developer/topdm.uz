from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.topdmbozor import TdbDeliveryStatus, TdbOrderStatus


class CreateOrderRequest(BaseModel):
    phone_number: str = Field(..., min_length=9, max_length=20)
    username: str | None = Field(default=None, max_length=64)
    merchant_id: UUID
    amount: int = Field(..., gt=0, le=500_000_000)

    @field_validator("phone_number")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return v.strip()


class CreateOrderResponse(BaseModel):
    order_id: UUID
    amount: int
    status: TdbOrderStatus
    delivery_status: TdbDeliveryStatus
    click_p2p_url: str
    created_at: datetime


class SmsWebhookRequest(BaseModel):
    """
    SMS-Gate Android ilovasidan keladigan xabar.

    Xavfsizlik: so'rov bilan birga HTTP sarlavhasida
    ``X-TDB-Signature: HMAC-SHA256(hex)`` yuboriladi — imzo xom JSON body ustida hisoblanadi.
    """

    message: str = Field(..., min_length=5, max_length=4000)
    sender: str | None = None
    received_at: str | None = None


class SmsWebhookResponse(BaseModel):
    ok: bool
    order_id: UUID | None = None
    matched_amount: int | None = None
    detail: str = ""


class ShipOrderRequest(BaseModel):
    tracking_number: str = Field(..., min_length=3, max_length=64)

    @field_validator("tracking_number")
    @classmethod
    def strip_tracking(cls, v: str) -> str:
        return v.strip().upper()


class ShipOrderResponse(BaseModel):
    order_id: UUID
    status: TdbOrderStatus
    delivery_status: TdbDeliveryStatus
    tracking_number: str
    celery_task_id: str | None = None


class CreateMerchantRequest(BaseModel):
    shop_name: str = Field(..., min_length=2, max_length=255)
    card_number: str = Field(..., min_length=16, max_length=19)
    phone_number: str | None = None
    username: str | None = None


class MerchantResponse(BaseModel):
    id: UUID
    shop_name: str
    card_number: str
    balance: str
    frozen_balance: str
    is_active: bool
