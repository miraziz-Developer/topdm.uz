from __future__ import annotations

from dataclasses import dataclass
from typing import Any

RULE_LABELS_UZ: dict[str, str] = {
    "merchant_redirect": "Sotuvchi",
    "active_pickup": "Faol bron",
    "returning_shopper": "Qaytgan mijoz",
    "resume_shop": "Oxirgi do'kon",
    "wholesale_buyer": "Optom xaridor",
    "favorites_curator": "Sevimlilar",
    "market_local": "Bozor tanlovi",
    "logged_explorer": "Ro'yxatdan o'tgan",
    "new_guest": "Yangi mehmon",
    "default_explorer": "Kashfiyot",
}


@dataclass
class UserSignals:
    is_logged_in: bool = False
    visit_count: int = 1
    has_phone: bool = False
    active_orders_count: int = 0
    completed_orders_count: int = 0
    total_orders_count: int = 0
    last_shop_slug: str | None = None
    last_shop_name: str | None = None
    preferred_market: str | None = None
    locale: str = "uz"
    has_active_reservation: bool = False
    liked_products_count: int = 0
    recent_views_count: int = 0
    is_merchant: bool = False
    sale_mode: str | None = None
    active_order_map_href: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


# Yuqori prioritet yuqorida — birinchi mos qoida tanlanadi.
RULES: list[dict[str, Any]] = [
    {
        "id": "merchant_redirect",
        "when": {"is_merchant": True},
        "banner": None,
        "ctas": [{"id": "crm", "label": "Do'kon paneli (CRM)", "href": "/login", "variant": "primary"}],
        "section_order": ["toolbar", "categories", "spotlight", "products"],
    },
    {
        "id": "active_pickup",
        "when": {"active_orders_min": 1},
        "banner": {
            "tone": "electric",
            "title": "Buyurtmangiz tayyorlanmoqda",
            "body": "Do'konga boring — xaritada yo'l va buyurtma holati shu yerda.",
            "icon": "package",
        },
        "ctas": [
            {"id": "orders", "label": "Buyurtmalarim", "href": "/orders", "variant": "primary"},
            {"id": "map", "label": "Do'konga yo'l", "href_tpl": "{active_order_map_href}", "variant": "secondary"},
        ],
        "section_order": ["banner", "toolbar", "spotlight", "stories", "banners", "products"],
        "highlight": "orders",
    },
    {
        "id": "returning_shopper",
        "when": {"completed_orders_min": 1, "active_orders_max": 0},
        "banner": {
            "tone": "gold",
            "title": "Yana xush kelibsiz",
            "body": "Oldin buyurtma bergansiz — AI Stilist yoki sevimli do'koningizdan davom eting.",
            "icon": "sparkles",
        },
        "ctas": [
            {"id": "stylist", "label": "AI Stilist", "href": "/stylist", "variant": "primary"},
            {"id": "orders", "label": "Buyurtmalar tarixi", "href": "/orders", "variant": "secondary"},
        ],
        "section_order": ["banner", "visual_search", "stories", "spotlight", "products"],
    },
    {
        "id": "resume_shop",
        "when": {"last_shop_slug_set": True, "active_orders_max": 0, "visit_count_min": 2},
        "banner": {
            "tone": "neutral",
            "title_tpl": "{last_shop_name}",
            "body": "Oxirgi ko'rgan do'koningiz — mahsulotlar va narxlar yangilangan bo'lishi mumkin.",
            "icon": "store",
        },
        "ctas": [
            {
                "id": "resume",
                "label_tpl": "Do'konga kirish",
                "href_tpl": "/shop/{last_shop_slug}",
                "variant": "primary",
            },
            {"id": "map", "label": "Bozor xaritasi", "href": "/map", "variant": "secondary"},
        ],
        "section_order": ["banner", "visual_search", "toolbar", "spotlight", "products"],
    },
    {
        "id": "wholesale_buyer",
        "when": {"sale_mode": "Optom"},
        "banner": {
            "tone": "indigo",
            "title": "Optom rejim",
            "body": "Ko'p miqdorda bron — filtrlardan blok va bozorni tanlang.",
            "icon": "search",
        },
        "ctas": [{"id": "catalog", "label": "Katalogni ko'rish", "href": "#catalog", "variant": "primary"}],
        "section_order": ["toolbar", "categories", "visual_search", "spotlight", "products"],
        "catalog": {"sale_mode": "Optom"},
    },
    {
        "id": "favorites_curator",
        "when": {"liked_products_min": 3},
        "banner": {
            "tone": "gold",
            "title": "Sevimlilaringiz",
            "body": "Saqlangan mahsulotlaringizga o'xshash yangi takliflar katalogda.",
            "icon": "sparkles",
        },
        "ctas": [
            {"id": "search", "label": "Rasm qidirish", "href": "/search", "variant": "primary"},
            {"id": "stylist", "label": "Stilist", "href": "/stylist", "variant": "secondary"},
        ],
        "section_order": ["banner", "visual_search", "stories", "products", "spotlight"],
    },
    {
        "id": "market_local",
        "when": {"preferred_market_set": True},
        "banner": {
            "tone": "neutral",
            "title_tpl": "{preferred_market}",
            "body": "Tanlangan bozor bo'yicha do'konlar va mahsulotlar.",
            "icon": "store",
        },
        "ctas": [{"id": "map", "label": "Xarita", "href": "/map", "variant": "primary"}],
        "section_order": ["toolbar", "categories", "banners", "spotlight", "products"],
        "catalog": {"market_zone": "{preferred_market}"},
    },
    {
        "id": "logged_explorer",
        "when": {"is_logged_in": True, "total_orders_max": 0},
        "banner": {
            "tone": "indigo",
            "title": "Profil tayyor",
            "body": "Telefon ulangan — bron va AI stylist to'liq ishlaydi.",
            "icon": "user",
        },
        "ctas": [
            {"id": "stylist", "label": "AI Stilist", "href": "/stylist", "variant": "primary"},
            {"id": "map", "label": "Xarita", "href": "/map", "variant": "secondary"},
        ],
        "section_order": ["visual_search", "banners", "stories", "spotlight", "products"],
    },
    {
        "id": "new_guest",
        "when": {"is_logged_in": False, "visit_count_max": 4},
        "banner": {
            "tone": "indigo",
            "title": "Topdim — Toshkent bozori onlayn",
            "body": "Telefon bilan kiring — buyurtma, xarita va AI stylist bir joyda.",
            "icon": "user",
        },
        "ctas": [
            {"id": "auth", "label": "Bepul kirish", "href": "/auth", "variant": "primary"},
            {"id": "map", "label": "Xaritani ko'rish", "href": "/map", "variant": "secondary"},
        ],
        "section_order": ["visual_search", "banners", "stories", "spotlight", "products"],
    },
    {
        "id": "default_explorer",
        "when": {},
        "banner": {
            "tone": "indigo",
            "title": "Nima qidiryapsiz?",
            "body": "Rasm yuboring, xaritadan do'kon toping yoki AI stylistdan so'rang.",
            "icon": "search",
        },
        "ctas": [
            {"id": "visual", "label": "Rasm qidirish", "href": "/search", "variant": "primary"},
            {"id": "map", "label": "Bozor xaritasi", "href": "/map", "variant": "secondary"},
        ],
        "section_order": ["visual_search", "toolbar", "categories", "banners", "stories", "spotlight", "products"],
    },
]

DEFAULT_SECTION_ORDER = [
    "banner",
    "visual_search",
    "toolbar",
    "categories",
    "banners",
    "stories",
    "spotlight",
    "products",
]


def _match_condition(signals: UserSignals, cond: dict[str, Any]) -> bool:
    if not cond:
        return True
    for key, expected in cond.items():
        if key == "is_logged_in" and signals.is_logged_in != expected:
            return False
        if key == "is_merchant" and signals.is_merchant != expected:
            return False
        if key == "visit_count_max" and signals.visit_count > int(expected):
            return False
        if key == "visit_count_min" and signals.visit_count < int(expected):
            return False
        if key == "active_orders_min" and signals.active_orders_count < int(expected):
            return False
        if key == "active_orders_max" and signals.active_orders_count > int(expected):
            return False
        if key == "completed_orders_min" and signals.completed_orders_count < int(expected):
            return False
        if key == "total_orders_max" and signals.total_orders_count > int(expected):
            return False
        if key == "liked_products_min" and signals.liked_products_count < int(expected):
            return False
        if key == "last_shop_slug_set" and not signals.last_shop_slug:
            return False
        if key == "preferred_market_set" and not signals.preferred_market:
            return False
        if key == "has_phone" and signals.has_phone != expected:
            return False
        if key == "sale_mode" and (signals.sale_mode or "") != str(expected):
            return False
    return True


def _format_tpl(value: str, signals: UserSignals) -> str:
    market = signals.preferred_market or "Ippodrom"
    return (
        value.replace("{last_shop_slug}", signals.last_shop_slug or "")
        .replace("{last_shop_name}", signals.last_shop_name or "Do'kon")
        .replace("{preferred_market}", market)
        .replace("{active_order_map_href}", signals.active_order_map_href or "/map")
    )


def _format_action(obj: Any, signals: UserSignals) -> Any:
    if isinstance(obj, str):
        return _format_tpl(obj, signals)
    if isinstance(obj, list):
        return [_format_action(x, signals) for x in obj]
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            if k.endswith("_tpl") and isinstance(v, str):
                out[k[:-4]] = _format_tpl(v, signals)
            else:
                out[k] = _format_action(v, signals)
        return out
    return obj


def evaluate_experience(signals: UserSignals) -> dict[str, Any]:
    matched_rule_id = "default_explorer"
    banner: dict[str, Any] | None = None
    ctas: list[dict[str, Any]] = []
    section_order = list(DEFAULT_SECTION_ORDER)
    catalog_hints: dict[str, Any] = {}
    highlight: str | None = None

    for rule in RULES:
        if not _match_condition(signals, rule.get("when") or {}):
            continue
        matched_rule_id = str(rule["id"])
        raw_banner = rule.get("banner")
        if raw_banner:
            banner = _format_action(raw_banner, signals)
        elif rule.get("banner") is None and rule["id"] == "merchant_redirect":
            banner = None
        ctas = _format_action(rule.get("ctas") or [], signals)
        section_order = list(rule.get("section_order") or DEFAULT_SECTION_ORDER)
        if rule.get("catalog"):
            catalog_hints = _format_action(rule["catalog"], signals)
        highlight = rule.get("highlight")
        break

    # CTA href fallback: empty map href → /map
    for cta in ctas:
        if cta.get("href") in ("", "#"):
            cta["href"] = "/map"

    return {
        "rule_id": matched_rule_id,
        "rule_label": RULE_LABELS_UZ.get(matched_rule_id, matched_rule_id),
        "signals": signals.to_dict(),
        "banner": banner,
        "ctas": ctas,
        "section_order": section_order,
        "catalog_hints": catalog_hints,
        "highlight": highlight,
        "show_chat": matched_rule_id not in ("merchant_redirect",),
        "show_visual_search_first": "visual_search" in section_order[:2],
    }
