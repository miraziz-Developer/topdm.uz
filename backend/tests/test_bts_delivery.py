"""BTS yetkazish — narx va status mapping."""
from __future__ import annotations

from decimal import Decimal

from app.application.delivery.bts_delivery import BtsDeliveryService
from app.application.delivery.tariff_splitter import compute_tariff_from_lines, product_physics


class _FakeProduct:
    id = "00000000-0000-0000-0000-000000000001"
    name = "Test"
    price = 100_000
    weight_kg = Decimal("0.5")
    length_cm = 30
    width_cm = 30
    height_cm = 10


def test_bts_estimate_positive():
    svc = BtsDeliveryService()
    line = product_physics(_FakeProduct(), 1)  # type: ignore[arg-type]
    tariff = compute_tariff_from_lines([line])
    cost = svc.estimate_delivery_uzs(
        tariff=tariff,
        shop_lat=41.31,
        shop_lng=69.28,
        dest_lat=41.35,
        dest_lng=69.30,
    )
    assert cost >= 25_000


def test_bts_status_mapping_delivered():
    assert BtsDeliveryService.map_bts_status_to_claim(status_code="500", status_name="Yetkazildi") == "delivered"


def test_bts_status_mapping_cancelled():
    assert BtsDeliveryService.map_bts_status_to_claim(status_code="900", status_name="Bekor") == "cancelled"
