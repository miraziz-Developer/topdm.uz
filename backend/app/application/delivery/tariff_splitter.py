"""Volumetric weight and carrier class routing (TikTok-Shop style heavy cargo split)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Sequence

from app.infrastructure.db.models import ProductModel

DEFAULT_WEIGHT_KG = Decimal("0.5")
DEFAULT_LENGTH_CM = 30
DEFAULT_WIDTH_CM = 30
DEFAULT_HEIGHT_CM = 10
VOLUMETRIC_DIVISOR = Decimal("5000")  # L*W*H / 5000 -> volumetric kg
CARGO_WEIGHT_THRESHOLD_KG = Decimal("10")
CARGO_VOLUME_THRESHOLD_M3 = Decimal("0.05")


@dataclass(frozen=True, slots=True)
class CartLinePhysics:
    product_id: str
    quantity: int
    weight_kg: Decimal
    length_cm: int
    width_cm: int
    height_cm: int

    @property
    def line_weight_kg(self) -> Decimal:
        return self.weight_kg * Decimal(self.quantity)

    @property
    def line_volume_m3(self) -> Decimal:
        vol_cm3 = Decimal(self.length_cm * self.width_cm * self.height_cm) * Decimal(self.quantity)
        return (vol_cm3 / Decimal("1000000")).quantize(Decimal("0.000001"))

    @property
    def volumetric_weight_kg(self) -> Decimal:
        vol_cm3 = Decimal(self.length_cm * self.width_cm * self.height_cm) * Decimal(self.quantity)
        return (vol_cm3 / VOLUMETRIC_DIVISOR).quantize(Decimal("0.001"))


@dataclass(frozen=True, slots=True)
class TariffDecision:
    carrier_class: str  # express | cargo
    total_weight_kg: Decimal
    total_volume_m3: Decimal
    billable_weight_kg: Decimal
    cargo_loaders: int
    cargo_type: str | None
    taxi_class: str

    def client_requirements(self) -> dict:
        if self.carrier_class == "cargo":
            return {
                "taxi_class": "cargo",
                "cargo_loaders": self.cargo_loaders,
                "cargo_type": self.cargo_type or "van",
            }
        return {"taxi_class": "express"}


def _positive_or_default(value: Decimal | int | float | None, default: Decimal | int) -> Decimal | int:
    if value is None:
        return default
    try:
        numeric = Decimal(str(value))
    except Exception:
        return default
    return default if numeric <= 0 else value


def product_physics(product: ProductModel, quantity: int) -> CartLinePhysics:
    w = _positive_or_default(product.weight_kg, DEFAULT_WEIGHT_KG)
    length = int(_positive_or_default(product.length_cm, DEFAULT_LENGTH_CM))
    width = int(_positive_or_default(product.width_cm, DEFAULT_WIDTH_CM))
    height = int(_positive_or_default(product.height_cm, DEFAULT_HEIGHT_CM))
    return CartLinePhysics(
        product_id=str(product.id),
        quantity=quantity,
        weight_kg=Decimal(str(w)),
        length_cm=int(length),
        width_cm=int(width),
        height_cm=int(height),
    )


def compute_tariff_from_lines(lines: Sequence[CartLinePhysics]) -> TariffDecision:
    total_weight = sum((line.line_weight_kg for line in lines), Decimal("0"))
    total_volume = sum((line.line_volume_m3 for line in lines), Decimal("0"))
    billable = max(
        total_weight,
        sum((line.volumetric_weight_kg for line in lines), Decimal("0")),
    )

    use_cargo = total_weight > CARGO_WEIGHT_THRESHOLD_KG or total_volume >= CARGO_VOLUME_THRESHOLD_M3
    if use_cargo:
        return TariffDecision(
            carrier_class="cargo",
            total_weight_kg=total_weight,
            total_volume_m3=total_volume,
            billable_weight_kg=billable,
            cargo_loaders=1,
            cargo_type="van",
            taxi_class="cargo",
        )

    return TariffDecision(
        carrier_class="express",
        total_weight_kg=total_weight,
        total_volume_m3=total_volume,
        billable_weight_kg=billable,
        cargo_loaders=0,
        cargo_type=None,
        taxi_class="express",
    )
