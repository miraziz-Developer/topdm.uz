from app.application.merchant.category_size_presets import size_presets_for_hint
from app.application.merchant.telegram_variant_draft import (
    add_color_photo,
    draft_to_catalog_payload,
    ensure_first_color,
    toggle_size,
)


def test_size_presets_shoes():
    presets = size_presets_for_hint("poyabzal")
    assert "40" in presets
    assert "S" not in presets


def test_variant_draft_multi_color():
    draft = ensure_first_color(
        {"colors": [], "all_sizes": [], "fallback_stock": 5},
        color_name="Qora",
        telegram_file_id="file1",
    )
    draft = add_color_photo(draft, color_name="Oq", telegram_file_id="file2")
    draft = toggle_size(draft, "40")
    draft = toggle_size(draft, "41")
    catalog = draft_to_catalog_payload(draft)
    assert len(catalog["colors"]) == 2
    assert catalog["colors"][0]["telegram_file_ids"] == ["file1"]
    assert catalog["colors"][1]["telegram_file_ids"] == ["file2"]
    assert "40" in catalog["all_sizes"]
