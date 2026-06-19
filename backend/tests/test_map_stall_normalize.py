from app.application.map.merchant_location import parse_merchant_location
from app.application.map.store_locations import normalize_stall_number, shop_to_map_store


class _ShopStub:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def test_normalize_long_rasta_section():
    assert normalize_stall_number("A-blok • rasta AD123") == "AD123"
    assert normalize_stall_number("rasta 14") == "14"
    assert len(normalize_stall_number("x" * 40)) <= 16


def test_shop_to_map_store_stall_within_schema():
    shop = _ShopStub(
        id="888c4997-c474-4e76-bac9-00fe8d44a13a",
        name="REAL AVTO",
        slug="real-avto",
        is_active=True,
        rating=0,
        review_count=0,
        section="A-blok • rasta AD123",
        block_sector="A:BLOCK 2 QATOR",
        floor="1-qavat",
        market_zone="Ippodrom",
        ipadrom=None,
        indoor_pin_x=None,
        indoor_pin_y=None,
        latitude=None,
        longitude=None,
    )
    store = shop_to_map_store(shop)
    assert len(store["stall_number"]) <= 16
    assert store["stall_number"] == "AD123"
    loc = parse_merchant_location(shop)
    assert loc["stall_number"] == "AD123"
