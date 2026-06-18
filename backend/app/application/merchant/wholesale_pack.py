"""Optom (pachka) mahsulot va do'kon turi biznes qoidalari."""
from __future__ import annotations

from typing import Any

SHOP_TYPES = frozenset({"chakana", "optom", "hybrid"})
PRICING_UNITS = frozenset({"piece", "pack"})
SALE_TYPES = frozenset({"Chakana", "Optom"})

SHOP_TYPE_LABELS_UZ: dict[str, str] = {
    "chakana": "Chakana do'kon",
    "optom": "Optomchi (pachka)",
    "hybrid": "Ikkalasi (chakana + optom)",
}


def normalize_shop_type(value: str | None) -> str:
    raw = (value or "chakana").strip().lower()
    return raw if raw in SHOP_TYPES else "chakana"


def default_sale_type_for_shop(shop_type: str | None) -> str:
    return "Optom" if normalize_shop_type(shop_type) == "optom" else "Chakana"


def default_pricing_unit(*, shop_type: str | None, sale_type: str | None = None) -> str:
    st = sale_type or default_sale_type_for_shop(shop_type)
    return "pack" if st == "Optom" else "piece"


def normalize_sale_type(value: str | None) -> str:
    raw = (value or "Chakana").strip()
    if raw.lower() in {"optom", "ulgurji", "wholesale"}:
        return "Optom"
    return "Chakana"


def normalize_pricing_unit(value: str | None, *, sale_type: str) -> str:
    raw = (value or "").strip().lower()
    if raw in PRICING_UNITS:
        return raw
    return "pack" if sale_type == "Optom" else "piece"


def parse_pack_composition(rows: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        size = str(row.get("size") or "").strip()
        if not size:
            continue
        qty = max(0, int(row.get("qty") or 0))
        if qty <= 0:
            continue
        out.append({"size": size, "qty": qty})
    return out


def composition_total(composition: list[dict[str, Any]]) -> int:
    return sum(int(r.get("qty") or 0) for r in composition)


def build_pack_label(*, units_per_pack: int, composition: list[dict[str, Any]]) -> str:
    if composition:
        parts = [f"{r['qty']}×{r['size']}" for r in composition]
        return f"{units_per_pack} dona/pachka ({', '.join(parts)})"
    return f"{units_per_pack} dona/pachka"


def merge_wholesale_pack_attrs(
    attrs: dict[str, Any],
    *,
    units_per_pack: int | None,
    composition: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    patch = dict(attrs)
    if not units_per_pack or units_per_pack < 1:
        patch.pop("wholesale_pack", None)
        return patch
    comp = parse_pack_composition(composition)
    patch["wholesale_pack"] = {
        "units_per_pack": int(units_per_pack),
        "composition": comp,
        "pack_label": build_pack_label(units_per_pack=int(units_per_pack), composition=comp),
    }
    return patch


def validate_wholesale_product(
    *,
    sale_type: str,
    pricing_unit: str,
    price: int,
    min_order_quantity: int,
    units_per_pack: int | None,
    composition: list[dict[str, Any]] | None,
) -> None:
    st = normalize_sale_type(sale_type)
    pu = normalize_pricing_unit(pricing_unit, sale_type=st)
    moq = max(1, int(min_order_quantity or 1))

    if not (0 < price < 100_000_000):
        raise ValueError("Narx 1 dan 99 999 999 gacha")

    if st == "Optom" and pu == "pack":
        upp = int(units_per_pack or 0)
        if upp < 2:
            raise ValueError("Pachkada kamida 2 dona bo'lishi kerak")
        comp = parse_pack_composition(composition)
        if comp:
            total = composition_total(comp)
            if total != upp:
                raise ValueError(
                    f"Pachka tarkibi ({total} dona) pachkadagi son ({upp}) bilan mos kelmaydi"
                )
        if moq < 1:
            raise ValueError("Minimal buyurtma kamida 1 pachka")


def resolve_product_pricing(product: Any) -> dict[str, Any]:
    attrs = getattr(product, "attributes", None) or {}
    if not isinstance(attrs, dict):
        attrs = {}
    pack = attrs.get("wholesale_pack") if isinstance(attrs.get("wholesale_pack"), dict) else {}

    sale_type = normalize_sale_type(getattr(product, "sale_type", None) or attrs.get("sale_type"))
    pricing_unit = normalize_pricing_unit(
        getattr(product, "pricing_unit", None) or attrs.get("pricing_unit"),
        sale_type=sale_type,
    )
    units_per_pack = int(
        getattr(product, "units_per_pack", None)
        or pack.get("units_per_pack")
        or 0
    )
    composition = parse_pack_composition(pack.get("composition"))
    min_qty = max(
        1,
        int(getattr(product, "min_order_quantity", None) or attrs.get("min_order_quantity") or 1),
    )

    is_pack = sale_type == "Optom" and pricing_unit == "pack"
    unit_label = "pachka" if is_pack else "dona"
    pack_label = str(pack.get("pack_label") or "")
    if is_pack and not pack_label and units_per_pack > 0:
        pack_label = build_pack_label(units_per_pack=units_per_pack, composition=composition)

    return {
        "sale_type": sale_type,
        "pricing_unit": pricing_unit,
        "is_pack_pricing": is_pack,
        "units_per_pack": units_per_pack if is_pack else None,
        "pack_composition": composition if is_pack else [],
        "pack_label": pack_label if is_pack else None,
        "min_order_quantity": min_qty,
        "unit_label": unit_label,
        "price_is_pack": is_pack,
    }


def validate_order_quantity(product: Any, quantity: int) -> str | None:
    """User-facing Uzbek error or None if OK."""
    qty = int(quantity)
    if qty < 1 or qty > 99:
        return "Miqdor 1 dan 99 gacha bo'lishi kerak"

    rules = resolve_product_pricing(product)
    moq = int(rules["min_order_quantity"])
    label = str(rules["unit_label"])

    if qty < moq:
        return f"Minimal buyurtma: {moq} {label}"

    return None


def stock_unit_label(product: Any) -> str:
    rules = resolve_product_pricing(product)
    return "pachka" if rules["is_pack_pricing"] else "dona"
