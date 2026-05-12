from dataclasses import dataclass


@dataclass(slots=True)
class Shop:
    id: str
    name: str
    latitude: float
    longitude: float
    block: str
    row: str
    contact_phone: str | None
