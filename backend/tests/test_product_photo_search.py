import io

from PIL import Image

from app.application.visual_search.bbox_refine import has_wearable_person
from app.application.visual_search.image_panels import find_vertical_panels
from app.application.visual_search.outfit_search import (
    _looks_like_default_body_slots,
    _looks_like_product_photo,
)


def _tall_shoe_product_photo() -> Image.Image:
    """Yashil fon, markazda pushti tufli + quti (portret)."""
    pil = Image.new("RGB", (400, 900), (60, 120, 70))
    for y in range(280, 620):
        for x in range(120, 280):
            pil.putpixel((x, y), (220, 140, 160))
    for y in range(500, 580):
        for x in range(100, 300):
            pil.putpixel((x, y), (160, 100, 60))
    return pil


def test_shoe_product_not_detected_as_person():
    pil = _tall_shoe_product_photo()
    assert has_wearable_person(pil) is False
    assert _looks_like_product_photo(pil) is True
    assert len(find_vertical_panels(pil)) == 1


def test_default_body_slots_helper():
    assert _looks_like_default_body_slots(
        [{"id": "top"}, {"id": "pants"}, {"id": "shoes"}]
    )
    assert not _looks_like_default_body_slots([{"id": "product"}])


def test_shoe_photo_bytes_png():
    pil = _tall_shoe_product_photo()
    buf = io.BytesIO()
    pil.save(buf, format="JPEG")
    assert len(buf.getvalue()) > 1000
