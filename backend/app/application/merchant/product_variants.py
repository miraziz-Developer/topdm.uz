from __future__ import annotations

from typing import Any


def _norm_key(value: str) -> str:
    return value.strip().casefold()


def parse_variant_catalog(attrs: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize stored attributes → CRM-friendly catalog."""
    attrs = dict(attrs or {})
    colors_out: list[dict[str, Any]] = []
    sku_stock: dict[str, int] = {}
    all_sizes: set[str] = set()
    size_matrix: dict[str, list[str]] = {}

    raw_matrix = attrs.get("size_matrix")
    if isinstance(raw_matrix, dict):
        for color, sizes in raw_matrix.items():
            if isinstance(sizes, list):
                size_matrix[str(color)] = [str(s).strip() for s in sizes if str(s).strip()]

    skus = attrs.get("skus") if isinstance(attrs.get("skus"), list) else []
    for row in skus:
        if not isinstance(row, dict):
            continue
        color = str(row.get("color") or "").strip()
        size = str(row.get("size") or "").strip()
        if not color or not size:
            continue
        key = f"{_norm_key(color)}|{_norm_key(size)}"
        sku_stock[key] = max(0, int(row.get("stock") or 0))
        all_sizes.add(size)

    variants = attrs.get("variants") if isinstance(attrs.get("variants"), list) else []
    color_images = attrs.get("color_images") if isinstance(attrs.get("color_images"), dict) else {}

    seen_colors: set[str] = set()
    for row in variants:
        if not isinstance(row, dict):
            continue
        color = str(row.get("color") or "").strip()
        if not color:
            continue
        seen_colors.add(_norm_key(color))
        images = row.get("images")
        if not isinstance(images, list):
            images = [row.get("image")] if row.get("image") else []
        image_urls = [str(u).strip() for u in images if str(u).strip()]
        sizes = row.get("sizes")
        if isinstance(sizes, list) and sizes:
            size_list = [str(s).strip() for s in sizes if str(s).strip()]
        else:
            size_list = list(size_matrix.get(color, []))
        for s in size_list:
            all_sizes.add(s)
        colors_out.append({"name": color, "sizes": size_list, "image_urls": image_urls})

    for color, urls in color_images.items():
        c = str(color).strip()
        if not c or _norm_key(c) in seen_colors:
            continue
        seen_colors.add(_norm_key(c))
        image_urls = [str(u).strip() for u in urls if str(u).strip()] if isinstance(urls, list) else []
        colors_out.append(
            {
                "name": c,
                "sizes": list(size_matrix.get(c, [])),
                "image_urls": image_urls,
            }
        )

    for s in attrs.get("sizes") or []:
        if str(s).strip():
            all_sizes.add(str(s).strip())
    for s in attrs.get("size_options") or []:
        if str(s).strip():
            all_sizes.add(str(s).strip())

    return {
        "all_sizes": sorted(all_sizes),
        "colors": colors_out,
        "sku_stock": sku_stock,
        "size_matrix": size_matrix,
    }


def build_attributes_from_catalog(
    catalog: dict[str, Any],
    *,
    existing: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], int]:
    """
    Build product.attributes from CRM catalog payload.
    Returns (attributes_patch, total_stock).
    """
    existing = dict(existing or {})
    colors_in = catalog.get("colors") if isinstance(catalog.get("colors"), list) else []
    all_sizes_in = catalog.get("all_sizes") if isinstance(catalog.get("all_sizes"), list) else []
    sku_stock_in = catalog.get("sku_stock") if isinstance(catalog.get("sku_stock"), dict) else {}

    all_sizes: list[str] = []
    for s in all_sizes_in:
        t = str(s).strip()
        if t and t not in all_sizes:
            all_sizes.append(t)

    variants: list[dict[str, Any]] = []
    color_images: dict[str, list[str]] = {}
    size_matrix: dict[str, list[str]] = {}
    skus: list[dict[str, Any]] = []
    total_stock = 0

    for row in colors_in:
        if not isinstance(row, dict):
            continue
        color = str(row.get("name") or "").strip()
        if not color:
            continue
        sizes = [str(s).strip() for s in (row.get("sizes") or []) if str(s).strip()]
        for s in sizes:
            if s not in all_sizes:
                all_sizes.append(s)
        image_urls = [str(u).strip() for u in (row.get("image_urls") or []) if str(u).strip()]
        variants.append({"color": color, "images": image_urls, "sizes": sizes})
        if image_urls:
            color_images[color] = image_urls
        size_matrix[color] = sizes

        for size in sizes:
            key = f"{_norm_key(color)}|{_norm_key(size)}"
            stock = max(0, int(sku_stock_in.get(key) or sku_stock_in.get(f"{color}|{size}") or 0))
            skus.append({"color": color, "size": size, "stock": stock})
            total_stock += stock

    # If no SKU grid but simple stock only — keep legacy
    if not skus and catalog.get("fallback_stock") is not None:
        total_stock = max(0, int(catalog["fallback_stock"]))

    patch = {
        **existing,
        "variants": variants,
        "color_images": color_images,
        "colors": [v["color"] for v in variants],
        "sizes": all_sizes,
        "size_options": all_sizes,
        "size_matrix": size_matrix,
        "skus": skus,
    }
    return patch, total_stock
