import re
from datetime import datetime
from decimal import Decimal

from app.application.stories.constants import story_is_hot
from app.core.client_context import apply_currency_to_product_dict
from app.core.config import get_settings

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _category_label(product) -> str | None:
    attrs = getattr(product, "attributes", None) or {}
    if isinstance(attrs, dict):
        for key in ("category", "category_name", "category_uz"):
            value = attrs.get(key)
            if value and not _UUID_RE.match(str(value).strip()):
                return str(value).strip()
    return None


def _as_number(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _ipadrom_name(shop) -> str:
    if shop is None:
        return "Bozor"
    rel = getattr(shop, "ipadrom", None)
    if rel and getattr(rel, "name", None):
        return str(rel.name)
    if getattr(shop, "ipadrom_id", None):
        return "Bozor"
    return "Bozor"


def format_store_location(shop) -> str:
    """Human-readable pickup address (mirrors frontend formatShopAddress)."""
    if shop is None:
        return "Toshkent bozori"
    market = _ipadrom_name(shop).replace(" bozori", "").replace(" bozor", "").strip() or "Ippodrom"
    floor = (shop.floor or "").strip()
    stall = (shop.section or "").strip()
    parts: list[str] = []
    if market and market.lower() != "bozor":
        parts.append(f"{market} bloki")
    if floor:
        parts.append(floor)
    if stall:
        parts.append(stall)
    return ", ".join(parts) if parts else "Toshkent bozori"


def build_store_address_payload(shop) -> dict[str, str]:
    """Structured bazaar address for reservation success UI."""
    if shop is None:
        return {
            "block": "Toshkent bozori",
            "floor": "",
            "stall": "",
            "formatted": "Toshkent bozori",
        }
    market = _ipadrom_name(shop).replace(" bozori", "").replace(" bozor", "").strip()
    floor = (shop.floor or "").strip()
    stall = (shop.section or "").strip()
    block = f"{market} bloki" if market and market.lower() != "bozor" else (market or "Bozor")
    return {
        "block": block,
        "floor": floor,
        "stall": stall,
        "formatted": format_store_location(shop),
    }


def product_to_dict(product, *, for_merchant: bool = False, category_meta: dict | None = None) -> dict:
    from app.application.pricing.product_markup import (
        customer_sale_price_uzs,
        merchant_base_uzs,
        platform_markup_uzs,
    )

    shop = product.shop if hasattr(product, "shop") else None
    attrs = getattr(product, "attributes", None) or {}
    if not isinstance(attrs, dict):
        attrs = {}
    from app.application.merchant.product_variants import normalize_product_variant_attrs

    attrs = normalize_product_variant_attrs(attrs)
    meta = category_meta or {}
    category_name = meta.get("category_name") or _category_label(product)
    root_category_name = meta.get("root_category_name") or attrs.get("root_category")
    sub_category = meta.get("sub_category") or attrs.get("sub_category")
    root_category = meta.get("root_category") or attrs.get("root_category")
    category_id = meta.get("category_id") or (
        str(product.category_id) if getattr(product, "category_id", None) else None
    )
    from app.application.merchant.wholesale_pack import resolve_product_pricing

    pricing = resolve_product_pricing(product)
    sale_type = pricing["sale_type"]
    min_qty = pricing["min_order_quantity"]
    base_merchant = merchant_base_uzs(int(product.price))
    sale_uzs = customer_sale_price_uzs(base_merchant)
    display_price = float(base_merchant if for_merchant else sale_uzs)
    base = {
        "id": str(product.id),
        "name": product.name,
        "price": display_price,
        "merchant_price_uzs": base_merchant,
        "sale_price_uzs": sale_uzs,
        "platform_markup_uzs": platform_markup_uzs(base_merchant),
        "platform_markup_pct": float(get_settings().platform_product_markup_pct),
        "weight_kg": _as_number(getattr(product, "weight_kg", 0) or 0),
        "length_cm": int(getattr(product, "length_cm", 0) or 0),
        "width_cm": int(getattr(product, "width_cm", 0) or 0),
        "height_cm": int(getattr(product, "height_cm", 0) or 0),
        "sale_type": str(sale_type),
        "min_order_quantity": int(min_qty),
        "pricing_unit": pricing["pricing_unit"],
        "units_per_pack": pricing["units_per_pack"],
        "pack_composition": pricing["pack_composition"],
        "pack_label": pricing["pack_label"],
        "price_is_pack": pricing["price_is_pack"],
        "wholesale_pack": attrs.get("wholesale_pack"),
        "images": list(product.images or []),
        "attributes": attrs,
        "category": category_name,
        "category_id": category_id,
        "category_name": category_name,
        "root_category": root_category,
        "root_category_name": root_category_name,
        "sub_category": sub_category,
        "market_zone": attrs.get("market_zone") or (getattr(shop, "market_zone", None) if shop else None),
        "block_sector": attrs.get("block_sector") or (getattr(shop, "block_sector", None) if shop else None),
        "is_available": product.is_available,
        "is_featured": product.is_featured,
        "view_count": product.view_count,
        "sold_count": int(getattr(product, "sold_count", 0) or 0),
        "stock_count": int(getattr(product, "stock_count", 0) or 0),
        "shop": {
            "id": str(shop.id) if shop else "",
            "name": shop.name if shop else "",
            "slug": shop.slug if shop else "",
            "logo_url": shop.logo_url if shop else None,
            "ipadrom": _ipadrom_name(shop),
            "floor": shop.floor if shop else "",
            "shop_number": shop.section if shop and shop.section else "",
            "section": shop.section if shop else "",
            "market_zone": getattr(shop, "market_zone", None) or attrs.get("market_zone"),
            "block_sector": getattr(shop, "block_sector", None) or attrs.get("block_sector"),
            "location_label": getattr(shop, "location_comment", None) or attrs.get("location"),
        }
        if shop
        else {},
    }
    return apply_currency_to_product_dict(base)


def story_to_dict(story) -> dict:
    shop = getattr(story, "shop", None)
    created_at: datetime | None = getattr(story, "created_at", None)
    expires_at: datetime | None = getattr(story, "expires_at", None)
    created_iso = created_at.isoformat() if created_at else None
    expires_iso = expires_at.isoformat() if expires_at else None
    slug = shop.slug if shop else ""
    return {
        "id": str(story.id),
        "shop_id": str(story.shop_id),
        "image_url": story.image_url,
        "level_context": story.level_context,
        "created_at": created_iso,
        "expires_at": expires_iso,
        "is_hot": story_is_hot(created_at) if created_at else False,
        "shop": {
            "id": str(shop.id) if shop else "",
            "name": shop.name if shop else "",
            "slug": slug,
            "logo_url": shop.logo_url if shop else None,
            "floor": shop.floor if shop else "",
            "section": shop.section if shop else "",
            "shop_number": shop.section if shop else "",
            "ipadrom": _ipadrom_name(shop),
        }
        if shop
        else {},
        "route_path": f"/map?shop={slug}" if slug else "/map",
    }


def _shop_rating_payloads(shop) -> tuple[dict, dict]:
    from app.application.merchant.shop_trust_service import ShopTrustService

    metrics = ShopTrustService.build_store_rating_metrics(shop)
    display = ShopTrustService.resolve_trust_metrics(shop)
    return metrics.model_dump(mode="json"), display.to_json()


def shop_to_dict(shop) -> dict:
    from app.application.map.store_locations import parse_shop_spatial, resolve_map_coordinates

    market_name = _ipadrom_name(shop)
    store_rating, trust_display = _shop_rating_payloads(shop)
    review_count = int(store_rating.get("total_reviews_count") or getattr(shop, "review_count", 0) or 0)
    rating = float(store_rating.get("average_rating") or shop.rating or 0)
    spatial = parse_shop_spatial(shop)
    map_x, map_y = resolve_map_coordinates(shop)

    return {
        "id": str(shop.id),
        "slug": shop.slug,
        "name": shop.name,
        "owner_display_name": getattr(shop, "owner_display_name", None),
        "owner_phone": getattr(shop, "owner_phone", None),
        "description": shop.description,
        "logo_url": shop.logo_url,
        "storefront_image_url": getattr(shop, "storefront_image_url", None),
        "floor": shop.floor,
        "floor_level": spatial["floor"],
        "section": shop.section,
        "block_id": spatial["block_id"],
        "stall_number": spatial["stall_number"],
        "latitude": getattr(shop, "latitude", None),
        "longitude": getattr(shop, "longitude", None),
        "map_x": map_x,
        "map_y": map_y,
        "address_label": spatial["address_label"],
        "is_verified": shop.is_verified,
        "rating": round(rating, 1) if rating else 0,
        "review_count": review_count,
        "store_rating_metrics": store_rating,
        "trust_metrics": trust_display,
        "ipadrom_id": str(shop.ipadrom_id) if shop.ipadrom_id else None,
        "ipadrom": market_name,
        "ipadrom_name": market_name,
        "is_featured": bool(getattr(shop, "is_featured", False)),
        "shop_type": getattr(shop, "shop_type", None) or "chakana",
        "market_zone": getattr(shop, "market_zone", None),
        "location_comment": getattr(shop, "location_comment", None),
        "block_sector": getattr(shop, "block_sector", None),
    }
