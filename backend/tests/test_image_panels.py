from PIL import Image

from app.application.visual_search.image_panels import (
    find_vertical_panels,
    is_horizontal_strip_grid,
    panels_look_like_true_collage,
    ImagePanel,
)


def _tall_product_photo() -> Image.Image:
    """Bitta tufli — yashil fon, markazda pushti obyekt (qora chiziq yo'q)."""
    pil = Image.new("RGB", (400, 900), (60, 120, 70))
    for y in range(280, 620):
        for x in range(120, 280):
            pil.putpixel((x, y), (220, 140, 160))
    for y in range(500, 580):
        for x in range(100, 300):
            pil.putpixel((x, y), (160, 100, 60))
    return pil


def _true_collage() -> Image.Image:
    """Ikki turli panel — qora tutqich bilan."""
    pil = Image.new("RGB", (400, 900), (0, 0, 0))
    for y in range(0, 420):
        for x in range(0, 400):
            pil.putpixel((x, y), (220, 140, 160))
    for y in range(440, 900):
        for x in range(0, 400):
            pil.putpixel((x, y), (40, 40, 40))
    for x in range(0, 400):
        for y in range(420, 440):
            pil.putpixel((x, y), (0, 0, 0))
    return pil


def test_single_product_not_split_into_strips():
    panels = find_vertical_panels(_tall_product_photo())
    assert len(panels) == 1
    assert panels[0].w == 1.0


def test_true_collage_splits():
    panels = find_vertical_panels(_true_collage())
    assert len(panels) >= 2


def test_horizontal_strip_grid_detected():
    strips = [
        ImagePanel(0, 0.0, 1.0, 0.30),
        ImagePanel(0, 0.33, 1.0, 0.30),
        ImagePanel(0, 0.66, 1.0, 0.30),
    ]
    assert is_horizontal_strip_grid(strips) is True


def test_collage_panels_reject_uniform_strips():
    pil = _tall_product_photo()
    fake_strips = [
        ImagePanel(0, 0.0, 1.0, 0.33),
        ImagePanel(0, 0.33, 1.0, 0.33),
        ImagePanel(0, 0.66, 1.0, 0.33),
    ]
    assert panels_look_like_true_collage(pil, fake_strips) is False
