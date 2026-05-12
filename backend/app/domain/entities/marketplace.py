from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass(slots=True)
class GlobalShop:
    id: UUID
    name: str
    latitude: float
    longitude: float
    block: str
    row: str
    metadata: dict


@dataclass(slots=True)
class UnifiedProduct:
    id: UUID
    shop_id: UUID
    name: str
    description: str | None
    price: Decimal
    currency: str
    ai_generated_tags: dict
    vision_attributes: dict
