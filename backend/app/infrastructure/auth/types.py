from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class AuthUser:
    id: UUID
    email: str | None = None
    telegram_id: int | None = None
    phone: str | None = None
    display_name: str | None = None
    role: str = "consumer"
    shop_id: UUID | None = None
