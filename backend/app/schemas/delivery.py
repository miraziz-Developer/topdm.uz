from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from app.schemas.orders import PaymentMethod, ReserveOrderItemSchema


class DeliveryQuoteRequest(BaseModel):
    items: list[ReserveOrderItemSchema] = Field(min_length=1, max_length=20)
    user_phone: str = Field(min_length=13, max_length=20)
    destination_address: str = Field(min_length=5, max_length=500)
    destination_lat: float = Field(ge=-90, le=90)
    destination_lng: float = Field(ge=-180, le=180)
    destination_city: str = Field(default="Toshkent", max_length=120)

    @field_validator("user_phone")
    @classmethod
    def strip_phone(cls, value: str) -> str:
        return value.strip()


class DeliveryReserveRequest(DeliveryQuoteRequest):
    payment_method: PaymentMethod = PaymentMethod.cash
    user_email: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=500)
    ref_token: str | None = Field(default=None, max_length=50)
    carrier_class: str = Field(pattern="^(express|cargo)$")
    delivery_cost_uzs: int = Field(ge=0)
    delivery_eta_minutes: int | None = Field(default=None, ge=5, le=24 * 60)
    offer_payload: str | None = None
    # Mehmon (login'siz) buyurtma uchun telefon OTP tasdiq tokeni
    verification_token: str | None = Field(default=None, min_length=8, max_length=64)


class MerchantPayoutRequestBody(BaseModel):
    amount_uzs: float = Field(gt=0)
    destination: str = Field(default="bank_card", max_length=64)
    # Uzcard/Humo karta raqami (16 raqam) — reestr/payout uchun
    card_number: str = Field(min_length=16, max_length=19)

    @field_validator("card_number")
    @classmethod
    def normalize_card(cls, value: str) -> str:
        digits = "".join(ch for ch in value if ch.isdigit())
        if len(digits) != 16:
            raise ValueError("card_number must be 16 digits")
        return digits
