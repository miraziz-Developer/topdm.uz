from __future__ import annotations

from datetime import date
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class OrderStatus(str, Enum):
    reserved = "reserved"
    pending = "pending"
    confirmed = "confirmed"
    preparing = "preparing"
    ready = "ready"
    completed = "completed"
    cancelled = "cancelled"


RESERVATION_DEFAULT_STATUS = OrderStatus.reserved

ORDER_TRACKER_PIPELINE: tuple[OrderStatus, ...] = (
    OrderStatus.reserved,
    OrderStatus.confirmed,
    OrderStatus.preparing,
    OrderStatus.ready,
    OrderStatus.completed,
)

ORDER_STATUS_LABELS_UZ: dict[str, str] = {
    OrderStatus.reserved.value: "BRON QILINDI",
    OrderStatus.pending.value: "BRON QILINDI",
    OrderStatus.confirmed.value: "Tasdiqlandi",
    OrderStatus.preparing.value: "Tayyorlanmoqda",
    OrderStatus.ready.value: "Olib ketishga tayyor",
    OrderStatus.completed.value: "Yakunlandi",
    OrderStatus.cancelled.value: "Bekor qilindi",
}


class PaymentMethod(str, Enum):
    cash = "cash"
    terminal = "terminal"
    click = "click"


class StoreAddressSchema(BaseModel):
    block: str = ""
    floor: str = ""
    stall: str = ""
    formatted: str = ""


class ReserveOrderItemSchema(BaseModel):
    product_id: UUID
    quantity: int = Field(default=1, ge=1, le=99)
    color: str | None = Field(default=None, max_length=80)
    size: str | None = Field(default=None, max_length=40)


class OrderReserveRequest(BaseModel):
    items: list[ReserveOrderItemSchema] = Field(min_length=1, max_length=20)
    user_phone: str = Field(min_length=13, max_length=20)
    user_email: str | None = Field(default=None, max_length=255)
    pickup_date: date
    pickup_time: str = Field(min_length=4, max_length=10)
    payment_method: PaymentMethod = PaymentMethod.cash
    note: str | None = Field(default=None, max_length=500)
    ref_token: str | None = Field(default=None, max_length=50)
    # Mehmon (login'siz) buyurtma uchun telefon OTP tasdiq tokeni
    verification_token: str | None = Field(default=None, min_length=8, max_length=64)

    @field_validator("user_phone")
    @classmethod
    def strip_phone(cls, value: str) -> str:
        return value.strip()

    @field_validator("pickup_time")
    @classmethod
    def strip_pickup_time(cls, value: str) -> str:
        return value.strip()


class ReservationLineSchema(BaseModel):
    order_id: str
    product_id: str
    shop_id: str
    quantity: int
    total_price: float
    status: str = Field(default=OrderStatus.reserved.value)


class OrderReserveResponse(BaseModel):
    reservations: list[ReservationLineSchema]
    reservation_count: int
    total_price: float
    status: str = Field(default=OrderStatus.reserved.value)
    pickup_date: str
    pickup_time: str
    pickup_window_label: str
    payment_method: PaymentMethod
    payment_method_label: str
    store_location: str
    store_address: StoreAddressSchema
    merchant_phone: str
    shop_name: str
    shop_slug: str
    map_url: str
    checkout_id: str | None = None
    online_checkout_url: str | None = None

    model_config = {"use_enum_values": True}


class OrderTrackerStepSchema(BaseModel):
    status: str
    label: str


class LiveOrderSchema(BaseModel):
    id: str
    status: str
    quantity: int
    total_price: float
    note: str | None = None
    ref_token: str | None = None
    fulfillment_type: str = "pickup"
    pickup_date: str | None = None
    pickup_time: str | None = None
    pickup_window_label: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    product: dict
    shop: dict
    tracker_steps: list[OrderTrackerStepSchema]
    tracker_active_index: int
    tracker_progress_pct: int
    status_label: str


class LiveOrdersResponse(BaseModel):
    items: list[LiveOrderSchema]
