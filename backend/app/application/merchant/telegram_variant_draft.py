from __future__ import annotations

from typing import Any


def empty_variant_draft() -> dict[str, Any]:
    return {"colors": [], "all_sizes": [], "fallback_stock": 0}


def _norm_color(value: str) -> str:
    return value.strip()


def get_variant_draft(attrs: dict[str, Any] | None) -> dict[str, Any]:
    raw = (attrs or {}).get("variant_draft")
    if not isinstance(raw, dict):
        return empty_variant_draft()
    colors = raw.get("colors") if isinstance(raw.get("colors"), list) else []
    all_sizes = raw.get("all_sizes") if isinstance(raw.get("all_sizes"), list) else []
    return {
        "colors": [dict(c) for c in colors if isinstance(c, dict)],
        "all_sizes": [str(s).strip() for s in all_sizes if str(s).strip()],
        "fallback_stock": max(0, int(raw.get("fallback_stock") or 0)),
    }


def set_variant_draft(attrs: dict[str, Any], draft: dict[str, Any]) -> dict[str, Any]:
    merged = dict(attrs)
    merged["variant_draft"] = draft
    return merged


def init_color_from_photo(*, color_name: str, telegram_file_id: str) -> dict[str, Any]:
    name = _norm_color(color_name) or "Asosiy"
    return {
        "name": name,
        "telegram_file_ids": [telegram_file_id],
        "sizes": [],
    }


def ensure_first_color(draft: dict[str, Any], *, color_name: str, telegram_file_id: str) -> dict[str, Any]:
    out = get_variant_draft({"variant_draft": draft})
    colors = list(out["colors"])
    if not colors:
        colors.append(init_color_from_photo(color_name=color_name, telegram_file_id=telegram_file_id))
    else:
        first = dict(colors[0])
        file_ids = list(first.get("telegram_file_ids") or [])
        if telegram_file_id and telegram_file_id not in file_ids:
            file_ids.insert(0, telegram_file_id)
        first["telegram_file_ids"] = file_ids
        if color_name and not str(first.get("name") or "").strip():
            first["name"] = _norm_color(color_name)
        colors[0] = first
    out["colors"] = colors
    return out


def add_color_photo(draft: dict[str, Any], *, color_name: str, telegram_file_id: str) -> dict[str, Any]:
    out = get_variant_draft({"variant_draft": draft})
    name = _norm_color(color_name)
    if not name:
        raise ValueError("color_name_required")
    colors = list(out["colors"])
    for idx, row in enumerate(colors):
        if str(row.get("name") or "").strip().casefold() == name.casefold():
            file_ids = list(row.get("telegram_file_ids") or [])
            if telegram_file_id not in file_ids:
                file_ids.append(telegram_file_id)
            colors[idx] = {**row, "name": name, "telegram_file_ids": file_ids}
            out["colors"] = colors
            return out
    colors.append(init_color_from_photo(color_name=name, telegram_file_id=telegram_file_id))
    out["colors"] = colors
    return out


def toggle_size(draft: dict[str, Any], size: str) -> dict[str, Any]:
    out = get_variant_draft({"variant_draft": draft})
    t = str(size).strip().upper()
    if not t:
        return out
    all_sizes = list(out["all_sizes"])
    if t in all_sizes:
        all_sizes = [s for s in all_sizes if s != t]
    else:
        all_sizes.append(t)
    out["all_sizes"] = all_sizes
    colors = []
    for row in out["colors"]:
        sizes = list(row.get("sizes") or [])
        if t in sizes:
            sizes = [s for s in sizes if s != t]
        else:
            sizes.append(t)
        colors.append({**row, "sizes": sizes})
    out["colors"] = colors
    return out


def set_fallback_stock(draft: dict[str, Any], stock: int) -> dict[str, Any]:
    out = get_variant_draft({"variant_draft": draft})
    out["fallback_stock"] = max(0, min(99_999, int(stock)))
    return out


def apply_all_sizes_to_colors(draft: dict[str, Any]) -> dict[str, Any]:
    out = get_variant_draft({"variant_draft": draft})
    sizes = list(out["all_sizes"])
    out["colors"] = [{**row, "sizes": sizes} for row in out["colors"]]
    return out


def draft_summary(draft: dict[str, Any]) -> tuple[str, str]:
    out = get_variant_draft({"variant_draft": draft})
    color_bits: list[str] = []
    image_count = 0
    for row in out["colors"]:
        name = str(row.get("name") or "").strip() or "—"
        files = row.get("telegram_file_ids") or []
        image_count += len(files)
        color_bits.append(f"{name} ({len(files)})")
    images_line = f"{image_count} ta rasm"
    if color_bits:
        images_line += f" — {', '.join(color_bits)}"
    sizes = out["all_sizes"]
    sizes_line = ", ".join(sizes) if sizes else "tanlanmagan"
    return images_line, sizes_line


def draft_to_catalog_payload(draft: dict[str, Any]) -> dict[str, Any]:
    out = get_variant_draft({"variant_draft": draft})
    colors = []
    for row in out["colors"]:
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        sizes = [str(s).strip() for s in (row.get("sizes") or out["all_sizes"]) if str(s).strip()]
        colors.append(
            {
                "name": name,
                "sizes": sizes,
                "image_urls": [],
                "telegram_file_ids": list(row.get("telegram_file_ids") or []),
            }
        )
    return {
        "all_sizes": out["all_sizes"],
        "colors": colors,
        "sku_stock": {},
        "fallback_stock": out["fallback_stock"],
    }
