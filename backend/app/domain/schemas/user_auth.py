from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

_TELEGRAM_ID_MAX = 9_223_372_036_854_775_807
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class HybridUserFields(BaseModel):
    """Shared validation for hybrid auth identifiers."""

    email: str | None = Field(default=None, max_length=255)
    telegram_id: int | None = Field(default=None, ge=1, le=_TELEGRAM_ID_MAX)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        normalized = str(value).strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError("Invalid email format")
        return normalized

    @field_validator("telegram_id", mode="before")
    @classmethod
    def coerce_telegram_id(cls, value: object) -> int | None:
        if value is None or value == "":
            return None
        return int(value)


class EmailOtpSendSchema(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError("Invalid email format")
        return normalized


class EmailOtpVerifySchema(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError("Invalid email format")
        return normalized

    otp: str = Field(..., min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    phone: str | None = Field(default=None, max_length=20)


class TelegramLoginWidgetSchema(BaseModel):
    id: int = Field(..., ge=1, le=_TELEGRAM_ID_MAX)
    first_name: str = Field(..., min_length=1, max_length=128)
    last_name: str | None = Field(default=None, max_length=128)
    username: str | None = Field(default=None, max_length=64)
    photo_url: str | None = Field(default=None, max_length=512)
    auth_date: int = Field(..., ge=1)
    hash: str = Field(..., min_length=32, max_length=128)

    model_config = {"extra": "allow"}
