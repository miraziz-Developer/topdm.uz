from types import SimpleNamespace

from app.application.map.merchant_location import parse_merchant_location


def test_parse_rasta_ad123_section():
    shop = SimpleNamespace(
        market_zone="Ippodrom",
        block_sector="A:BLOCK 2 QATOR",
        floor="1-qavat",
        section="A-blok • rasta AD123",
        location_comment="test",
        ipadrom=None,
    )
    loc = parse_merchant_location(shop)
    assert loc["stall_number"] == "AD123"
    assert len(loc["stall_number"]) <= 16
    assert loc["block_id"] == "A"


def test_parse_numeric_do_kon():
    shop = SimpleNamespace(
        market_zone="Ippodrom",
        block_sector="B-blok",
        floor="1-qavat",
        section="112-do'kon",
        location_comment=None,
        ipadrom=None,
    )
    loc = parse_merchant_location(shop)
    assert loc["stall_number"] == "112"
