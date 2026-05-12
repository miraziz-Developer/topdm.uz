from dataclasses import dataclass


@dataclass(slots=True)
class Product:
    id: str
    name: str
    price: float
    currency: str
    image_url: str | None
    shop_location: str | None
    ai_metadata: dict
