from types import SimpleNamespace

from app.application.merchant.ai_moderator import ShopAiModeratorService


def _shop(**kwargs):
    defaults = {
        "name": "Test Do'kon",
        "market_zone": "Boshqa",
        "block_sector": "A-blok",
        "stall_number": "12",
        "location_comment": "Samarqand, Registon yonida",
        "latitude": 39.6542,
        "longitude": 66.9597,
        "location_accuracy": 25.0,
        "storefront_image_url": "https://example.com/shop.jpg",
        "owner_phone": "+998901234567",
        "is_verified": False,
        "is_blocked": False,
        "trust_metrics": {},
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_shop_rules_allow_boshqa_and_any_gps():
    moderator = ShopAiModeratorService()
    assert moderator._review_shop_rules(_shop(market_zone="Boshqa")) is None
    assert moderator._review_shop_rules(_shop(latitude=40.0, longitude=60.0)) is None


def test_shop_rules_reject_profanity_in_name():
    moderator = ShopAiModeratorService()
    verdict = moderator._review_shop_rules(_shop(name="Porn shop"))
    assert verdict is not None
    assert verdict.approved is False
    assert "profanity_text" in verdict.flags


def test_shop_rules_pass_valid_profile():
    moderator = ShopAiModeratorService()
    assert moderator._review_shop_rules(_shop()) is None


def test_product_rules_require_verified_shop():
    moderator = ShopAiModeratorService()
    import asyncio

    verdict = asyncio.run(
        moderator.review_product_publish(
            shop=_shop(is_verified=False),
            name="Ko'ylak",
            price_uzs=120_000,
            category_label="Ayollar ko'ylagi",
            image_bytes=b"fake-image-bytes",
        )
    )
    assert verdict.approved is False
    assert "shop_not_verified" in verdict.flags


def test_placeholder_storefront_rejected():
    moderator = ShopAiModeratorService()
    assert moderator.is_placeholder_image_url("https://bozorliii.uz/placeholder.svg") is True
    assert moderator.is_placeholder_image_url("/api/v1/media/products/x/y.jpg") is False


def test_detect_image_mime():
    assert ShopAiModeratorService.detect_image_mime(b"\x89PNG\r\n\x1a\n") == "image/png"
    assert ShopAiModeratorService.detect_image_mime(b"\xff\xd8\xff") == "image/jpeg"
