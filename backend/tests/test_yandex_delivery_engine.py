"""Unit tests for YandexDeliveryGateway routing and bazaar payloads."""
from decimal import Decimal

from app.application.delivery.tariff_splitter import compute_tariff_from_lines, product_physics
from app.services.yandex_delivery import (
    YandexDeliveryGateway,
    build_bazaar_source_comment,
    build_routing_requirements,
    resolve_carrier_class,
)


class _ProductStub:
    def __init__(self, **kwargs) -> None:
        self.id = kwargs.get("id", "00000000-0000-4000-8000-000000000001")
        self.weight_kg = kwargs.get("weight_kg", Decimal("0.5"))
        self.length_cm = kwargs.get("length_cm", 30)
        self.width_cm = kwargs.get("width_cm", 30)
        self.height_cm = kwargs.get("height_cm", 10)
        self.price = kwargs.get("price", 100_000)
        self.name = kwargs.get("name", "Test")


def test_resolve_carrier_express() -> None:
    assert resolve_carrier_class(total_weight_kg=5.0, total_volume_m3=0.01) == "express"


def test_resolve_carrier_cargo_by_weight() -> None:
    assert resolve_carrier_class(total_weight_kg=11.0, total_volume_m3=0.01) == "cargo"


def test_resolve_carrier_cargo_by_volume() -> None:
    assert resolve_carrier_class(total_weight_kg=2.0, total_volume_m3=0.05) == "cargo"


def test_build_routing_requirements_cargo() -> None:
    req = build_routing_requirements(total_weight_kg=12.0, total_volume_m3=0.06)
    assert req["taxi_class"] == "cargo"
    assert req["cargo_loaders"] == 1
    assert req["cargo_type"] == "van"


def test_bazaar_source_comment_format() -> None:
    comment = build_bazaar_source_comment(
        {
            "sector": "A",
            "block": "12",
            "rasta": "45",
            "phone": "+998901112233",
        }
    )
    assert comment.startswith("Bozor: Ippodrom")
    assert "Sektor: A" in comment
    assert "Blok: 12" in comment
    assert "Rasta: 45" in comment
    assert "Tel: +998901112233" in comment


def test_offline_estimate() -> None:
    gateway = YandexDeliveryGateway()
    result = gateway._offline_estimate(3.0, 0.01, "express")
    assert result["door_to_door"] is True
    assert result["delivery_cost_uzs"] > 0
    assert result["offline"] is True


def test_tariff_matches_gateway_thresholds() -> None:
    product = _ProductStub(length_cm=50, width_cm=50, height_cm=50, weight_kg=Decimal("2"))
    line = product_physics(product, 2)  # type: ignore[arg-type]
    tariff = compute_tariff_from_lines([line])
    carrier = resolve_carrier_class(
        total_weight_kg=float(tariff.total_weight_kg),
        total_volume_m3=float(tariff.total_volume_m3),
    )
    assert carrier == tariff.carrier_class
