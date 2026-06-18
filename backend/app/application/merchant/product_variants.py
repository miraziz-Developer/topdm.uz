from __future__ import annotations

import re
from typing import Any

_LETTER_SIZE_ORDER = {"XXS": 0, "XS": 1, "S": 2, "M": 3, "L": 4, "XL": 5, "XXL": 6, "XXXL": 7}


def _norm_key(value: str) -> str:
    return value.strip().casefold()


def split_color_names(value: str) -> list[str]:
    raw = value.strip()
    if not raw:
        return []
    parts = re.split(r"[,;]+|\s+va\s+", raw, flags=re.IGNORECASE)
    out: list[str] = []
    for part in parts:
        name = part.strip().strip("., ")
        if name and name not in out:
            out.append(name)
    return out or [raw]


def sort_sizes(sizes: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for size in sizes:
        token = str(size).strip()
        if not token or token in seen:
            continue
        seen.add(token)
        unique.append(token)
    if not unique:
        return []
    if all(token.isdigit() for token in unique):
        return sorted(unique, key=int)
    if all(token.upper() in _LETTER_SIZE_ORDER for token in unique):
        return sorted(unique, key=lambda token: _LETTER_SIZE_ORDER[token.upper()])
    return sorted(unique, key=lambda token: token.casefold())


def _expand_color_rows(rows: list[dict[str, Any]], *, color_key: str) -> list[dict[str, Any]]:
    expanded: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        color = str(row.get(color_key) or "").strip()
        names = split_color_names(color)
        if len(names) <= 1:
            expanded.append(row)
            continue
        for name in names:
            expanded.append({**row, color_key: name})
    return expanded


def normalize_product_variant_attrs(attrs: dict[str, Any] | None) -> dict[str, Any]:
    """Fix legacy comma-joined color names and unsorted size lists for API consumers."""
    attrs = dict(attrs or {})

    variants = attrs.get("variants")
    if isinstance(variants, list):
        attrs["variants"] = _expand_color_rows([dict(v) for v in variants if isinstance(v, dict)], color_key="color")

    colors = attrs.get("colors")
    if isinstance(colors, list):
        normalized_colors: list[str] = []
        for color in colors:
            if not isinstance(color, str):
                continue
            for name in split_color_names(color):
                if name not in normalized_colors:
                    normalized_colors.append(name)
        attrs["colors"] = normalized_colors

    color_images = attrs.get("color_images")
    if isinstance(color_images, dict):
        remapped: dict[str, list[str]] = {}
        for color, urls in color_images.items():
            if not isinstance(urls, list):
                continue
            image_urls = [str(url).strip() for url in urls if str(url).strip()]
            for name in split_color_names(str(color)):
                remapped.setdefault(name, image_urls)
        attrs["color_images"] = remapped

    size_matrix = attrs.get("size_matrix")
    if isinstance(size_matrix, dict):
        remapped_matrix: dict[str, list[str]] = {}
        for color, sizes in size_matrix.items():
            size_list = sort_sizes([str(size).strip() for size in sizes if str(size).strip()]) if isinstance(sizes, list) else []
            for name in split_color_names(str(color)):
                remapped_matrix[name] = size_list
        attrs["size_matrix"] = remapped_matrix

    skus = attrs.get("skus")
    if isinstance(skus, list):
        attrs["skus"] = _expand_color_rows([dict(row) for row in skus if isinstance(row, dict)], color_key="color")

    for key in ("sizes", "size_options"):
        raw_sizes = attrs.get(key)
        if isinstance(raw_sizes, list):
            attrs[key] = sort_sizes([str(size).strip() for size in raw_sizes if str(size).strip()])

    return attrs


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
        "all_sizes": sort_sizes(list(all_sizes)),
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
    fallback_stock = max(0, int(catalog.get("fallback_stock") or 0))

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
        color_raw = str(row.get("name") or "").strip()
        if not color_raw:
            continue
        sizes = sort_sizes([str(s).strip() for s in (row.get("sizes") or []) if str(s).strip()])
        image_urls = [str(u).strip() for u in (row.get("image_urls") or []) if str(u).strip()]
        for color in split_color_names(color_raw):
            for s in sizes:
                if s not in all_sizes:
                    all_sizes.append(s)
            variants.append({"color": color, "images": image_urls, "sizes": sizes})
            if image_urls:
                color_images[color] = image_urls
            size_matrix[color] = sizes

            for size in sizes:
                key = f"{_norm_key(color)}|{_norm_key(size)}"
                stock = max(0, int(sku_stock_in.get(key) or sku_stock_in.get(f"{color}|{size}") or 0))
                skus.append({"color": color, "size": size, "stock": stock})
                total_stock += stock

    # Umumiy fallback faqat variant/rang yo'q bo'lsa — aks holda har SKU ga ko'payib ketardi
    if not skus and catalog.get("fallback_stock") is not None:
        total_stock = max(0, int(catalog["fallback_stock"]))

    patch = {
        **existing,
        "variants": variants,
        "color_images": color_images,
        "colors": [v["color"] for v in variants],
        "sizes": sort_sizes(all_sizes),
        "size_options": sort_sizes(all_sizes),
        "size_matrix": size_matrix,
        "skus": skus,
    }
    return patch, total_stock


def apply_warehouse_stock(attributes: dict[str, Any] | None, stock: int) -> tuple[dict[str, Any], int]:
    """
    Umumiy ombor zaxirasi (bot rejimi).
    SKU qatorlari saqlanadi, lekin stock=0 — reserve aggregate stock_count dan oladi.
    """
    stock = max(0, min(99_999, int(stock)))
    attrs = dict(attributes or {})
    skus = attrs.get("skus")
    if isinstance(skus, list):
        attrs["skus"] = [
            {**row, "stock": 0} if isinstance(row, dict) else row
            for row in skus
        ]
    return attrs, stock
